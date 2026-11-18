import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createHandler,hash} from '../../lib/beta/server.ts';

const origin='https://beta.example.invalid',org='10000000-0000-4000-8000-000000000001',connection='20000000-0000-4000-8000-000000000001';
const key='synthetic-signing-key',documentId='a'.repeat(24),messageId='b'.repeat(24);
Object.assign(process.env,{BETA_ENABLED:'true',BETA_CONNECTORS_ENABLED:'true',BETA_ORIGIN:origin,SUPABASE_URL:'https://db.example.invalid',SUPABASE_ANON_KEY:'synthetic-public',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',ONSHAPE_WEBHOOK_KEYS:JSON.stringify([key])});
const payload={documentId,messageId,event:'onshape.model.lifecycle.changed'};
function request(body=payload,query=`org=${org}&connection=${connection}`,signed=true){
 const raw=JSON.stringify(body),timestamp=new Date().toISOString();
 return new Request(origin+'/api/onshape-webhook?'+query,{method:'POST',headers:{'Content-Type':'application/json','x-onshape-webhook-timestamp':timestamp,'x-onshape-webhook-signature-primary':signed?createHmac('sha256',key).update(timestamp+'.'+raw).digest('base64'):'invalid'},body:raw});
}
test('webhook upstream failures resolve to sanitized retryable API responses',async()=>{
 for(const failure of ['transport','read','write']){
  const handler=createHandler(async url=>{
   if(failure==='transport')throw Error('private upstream detail');
   if(url.includes('integration_connections')&&failure==='write')return Response.json([{document_id:documentId,created_by:org,status:'connected'}]);
   return Response.json({message:'private upstream detail'},{status:503});
  });
  const response=await handler(request());
  assert.equal(response.status,503);assert.match(response.headers.get('content-type'),/application\/json/);
  assert.equal(response.headers.get('cache-control'),'no-store');assert.doesNotMatch(await response.text(),/private upstream detail/);
 }
});
test('signed malformed notifications are rejected before database access',async()=>{
 let calls=0;const handler=createHandler(async()=>{calls++;return Response.json([]);});
 for(const body of [null,[],{},'text',{...payload,documentId:4},{...payload,event:null},{...payload,messageId:'bad'}]){
  assert.equal((await handler(request(body))).status,400);
 }
 for(const query of ['',`org=bad&connection=${connection}`,`org=${org}&connection=bad`])assert.equal((await handler(request(payload,query))).status,400);
 assert.equal(calls,0);
});
test('webhook configuration errors fail closed without leaking key material',async()=>{
 let calls=0;const handler=createHandler(async()=>{calls++;return Response.json([]);});
 try{
  for(const config of ['{private-key', 'null', '{}', '[]', '[123]', '[""]']){
   process.env.ONSHAPE_WEBHOOK_KEYS=config;
   const response=await handler(request());assert.equal(response.status,503);
   assert.deepEqual(await response.json(),{error:'Webhook verification is not configured.'});
  }
 }finally{process.env.ONSHAPE_WEBHOOK_KEYS=JSON.stringify([key]);}
 assert.equal(calls,0);
});
test('webhook signature and document checks precede notification writes',async()=>{
 const calls=[];let status='connected',doc=documentId;
 const handler=createHandler(async(url,options)=>{
  calls.push({url,options});
  if(url.includes('integration_connections'))return Response.json([{document_id:doc,created_by:org,status}]);
  const data=JSON.parse(options.body);assert.equal(data.p_action,'notification');assert.equal(data.p_org,org);
  assert.deepEqual(data.p_data,{connection_id:connection,message_id:messageId,body_hash:hash(JSON.stringify(payload))});
  return Response.json({saved:true});
 });
 assert.equal((await handler(request(payload,undefined,false))).status,401);assert.equal(calls.length,0);
 for(const state of ['disconnected','connected']){
  status=state;doc=state==='connected'?'c'.repeat(24):documentId;
  assert.equal((await handler(request())).status,403);
 }
 doc=documentId;assert.deepEqual(await (await handler(request({...payload,event:'unrecognized.event'}))).json(),{ignored:true});
 assert.equal(calls.some(c=>c.url.includes('/rpc/')),false);
 assert.deepEqual(await (await handler(request())).json(),{saved:true});
 assert.equal(calls.filter(c=>c.url.includes('/rpc/')).length,1);
});
