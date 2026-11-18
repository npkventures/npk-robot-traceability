import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {providerJSON,ProviderError,useOnshape,captureReference} from '../../lib/beta/onshape.ts';
import {seal} from '../../lib/beta/connector-secrets.ts';
import {connectorWorkerStep} from '../../lib/beta/connector-worker.ts';

const documentId='a'.repeat(24),elementId='b'.repeat(24),microversion='c'.repeat(24),versionId='d'.repeat(24);
const invalidName=Buffer.concat([Buffer.from('"private name '),Buffer.from([0xc3,0x28]),Buffer.from('"')]);
const response=body=>new Response(body,{headers:{'Content-Type':'application/json'}});
const invalidJSON=()=>response(Buffer.concat([Buffer.from('{"name":'),invalidName,Buffer.from('}') ]));
const providerFailure=write=>error=>error instanceof ProviderError&&error.status===502&&error.uncertain===write&&!error.message.includes('private');

test('provider decoder rejects damaged UTF-8 rather than altering metadata',async()=>{
 for(const write of [false,true])await assert.rejects(providerJSON(async()=>invalidJSON(),'https://provider.invalid',{},write),providerFailure(write));
 const elements=Buffer.concat([Buffer.from(`[{"id":"${elementId}","name":`),invalidName,Buffer.from('}]')]);
 await assert.rejects(captureReference({document_id:documentId},()=>providerJSON(async()=>response(elements),'https://provider.invalid',{}),{kind:'m',reference_id:microversion,element_id:elementId}),providerFailure(false));
});

test('provider JSON media type is exact and case-insensitive with optional parameters',async()=>{
 for(const type of ['application/json','Application/JSON','application/json; charset=utf-8']){
  assert.deepEqual(await providerJSON(async()=>new Response('{"ok":true}',{headers:{'Content-Type':type}}),'https://provider.invalid',{}),{ok:true});
 }
 for(const type of ['application/jsonp','application/json-extra','text/application/json','text/plain']){
  await assert.rejects(providerJSON(async()=>new Response('{"ok":true}',{headers:{'Content-Type':type}}),'https://provider.invalid',{}),providerFailure(false));
 }
});

test('provider body readers release locks on valid Unicode, malformed JSON, interruption and overflow',async()=>{
 const value={name:'Gripper \u00b5 \u{1f916}'};
 const bytes=Buffer.from(JSON.stringify(value));
 const unicode=new ReadableStream({start(c){for(const byte of bytes)c.enqueue(Uint8Array.of(byte));c.close();}});
 assert.deepEqual(await providerJSON(async()=>response(unicode),'https://provider.invalid',{}),value);
 assert.equal(unicode.locked,false);
 for(const kind of ['json','interrupted','oversized']){
  let cancelled=false;
  const body=new ReadableStream({start(c){
   if(kind==='interrupted')c.error(Error('private transport detail'));
   else if(kind==='oversized')c.enqueue(new Uint8Array(2097153));
   else {c.enqueue(Buffer.from('{'));c.close();}
  },cancel(){cancelled=true;throw Error('private cancellation detail');}});
  await assert.rejects(providerJSON(async()=>response(body),'https://provider.invalid',{},true),providerFailure(true));
  assert.equal(body.locked,false);
  if(kind==='oversized')assert.equal(cancelled,true);
 }
});

function fixture(){
 Object.assign(process.env,{CONNECTOR_KEYS:JSON.stringify({one:'1'.repeat(64)}),CONNECTOR_ACTIVE_KEY:'one'});
 const org=randomUUID(),connection=randomUUID();
 const job={id:randomUUID(),org_id:org,connection_id:connection,actor_id:randomUUID(),kind:'create_version',status:'queued',lease:randomUUID(),parameters:{workspace_id:versionId,microversion_id:microversion,name:'Synthetic'},attempts:0};
 const calls=[];
 const command=async(action,o,a,data)=>{
  calls.push({action,data});
  if(action==='claim_job')return job;
  if(action==='lease')return {document_id:documentId,write_enabled:true,lease:randomUUID(),secret:seal({access:'synthetic',refresh:'synthetic',expires:Date.now()+3600000},org+':'+connection)};
  if(action==='reserve_call')return {reserved:true};
 };
 return {org,connection,job,calls,command};
}

test('oversized provider responses reject without waiting for cancellation',async()=>{
 for(const write of [false,true])for(const fail of [false,true]){
  let settle,cancelled=false,timer;
  const pending=new Promise((resolve,reject)=>{settle=()=>fail?reject(Error('private cancellation detail')):resolve();});
  const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(2097153));},cancel(){cancelled=true;return pending;}});
  const result=providerJSON(async()=>response(body),'https://provider.invalid',{},write);
  const checked=assert.rejects(result,providerFailure(write));
  try{
   await Promise.race([checked,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Size rejection waited for cancellation')),250);})]);
   assert.equal(cancelled,true);assert.equal(body.locked,false);
  }finally{clearTimeout(timer);settle();await checked;}
 }
});

test('damaged write responses leave jobs unknown without retry and release the connection',async()=>{
 const {command,calls}=fixture();let posts=0;
 await connectorWorkerStep(command,async(url,init)=>{
  if(init.method!=='POST')return Response.json({microversion});
  posts++;
  return response(Buffer.concat([Buffer.from(`{"id":"${versionId}","microversion":"${microversion}","name":`),invalidName,Buffer.from('}') ]));
 });
 assert.equal(posts,1);
 assert.equal(calls.filter(c=>c.action==='dispatch_job').length,1);
 assert.equal(calls.filter(c=>c.action==='release').length,1);
 const finishes=calls.filter(c=>c.action==='finish_job');
 assert.equal(finishes.length,1);assert.equal(finishes[0].data.status,'unknown');
 assert.doesNotMatch(JSON.stringify(finishes),/private name/);
});

test('damaged reads retry within the existing bound and release the connection',async()=>{
 const {org,connection,job,command,calls}=fixture();let attempts=0;
 await assert.rejects(useOnshape(command,async()=>{attempts++;return invalidJSON();},org,job.actor_id,connection,async(c,call)=>call('/api/v10/documents/'+documentId)),providerFailure(false));
 assert.equal(attempts,3);assert.equal(calls.filter(c=>c.action==='release').length,1);
});

test('early provider rejection cancels unread bodies without awaiting cleanup',async()=>{
 for(const status of [401,429,503,200])for(const write of [false,true])for(const fail of [false,true]){
  let settle,cancelled=false,timer;
  const pending=new Promise((resolve,reject)=>{settle=()=>fail?reject(Error('private cleanup failure')):resolve();});
  const body=new ReadableStream({cancel(){cancelled=true;return pending;}});
  const result=providerJSON(async()=>new Response(body,{status,headers:{'Content-Type':'text/plain'}}),'https://provider.invalid',{},write);
  const checked=assert.rejects(result,error=>error instanceof ProviderError&&error.status===(status===200?502:status)&&error.uncertain===(write&&(status===200||status>=500))&&!error.message.includes('private'));
  try{
   await Promise.race([checked,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Provider rejection waited for cleanup')),250);})]);
   assert.equal(cancelled,true,`status ${status}`);assert.equal(body.locked,false);
  }finally{clearTimeout(timer);settle();await checked;}
 }
 for(const status of [401,503,200]){
  await assert.rejects(providerJSON(async()=>new Response(null,{status}),'https://provider.invalid',{},true),error=>error instanceof ProviderError&&error.status===(status===200?502:status));
 }
});
