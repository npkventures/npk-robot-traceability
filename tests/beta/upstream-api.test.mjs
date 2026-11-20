import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../../lib/beta/server.ts';
import {emptyBundle} from '../../lib/local/records.ts';

const org='00000000-0000-4000-8000-000000000001',user='10000000-0000-4000-8000-000000000001';
Object.assign(process.env,{BETA_ENABLED:'true',BETA_AUTH_LIFECYCLE:'false',BETA_HISTORY_ENABLED:'false',BETA_ORIGIN:'https://beta.example.invalid',SUPABASE_URL:'https://db.example.invalid',SUPABASE_ANON_KEY:'synthetic-public',SUPABASE_SERVICE_ROLE_KEY:'synthetic-private'});
const request=(path,body)=>new Request('https://beta.example.invalid/api/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:'https://beta.example.invalid',Cookie:'unify_session=synthetic','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
const brokenResponse=status=>new Response(new ReadableStream({start(c){c.enqueue(Buffer.from('{"private":"partial'));c.error(Error('private transport detail'));}}),{status,headers:{'Content-Type':'application/json'}});
function backend(target,reply){
 const calls=[];
 const handle=createHandler(async(url,options)=>{
  const path=new URL(url).pathname;calls.push({path,method:options.method});
  if(path===target)return reply();
  if(path==='/auth/v1/user')return Response.json({id:user,email:'synthetic@example.invalid'});
  if(path==='/rest/v1/memberships')return Response.json([{role:'member'}]);
  if(path==='/rest/v1/workspaces')return Response.json([{version:0,bundle:emptyBundle()}]);
  throw Error('Unexpected upstream call: '+path);
 });
 return {handle,calls};
}
const cases=[
 {name:'sign-in',target:'/auth/v1/token',path:'login',body:{email:'synthetic@example.invalid',password:'synthetic-password'}},
 {name:'workspace read',target:'/rest/v1/workspaces',path:`org/${org}/workspace`},
 {name:'save acknowledgement',target:'/rest/v1/rpc/beta_command',path:`org/${org}/save`,body:{bundle:emptyBundle(),expected_version:0,request_id:'synthetic-save'}},
];
for(const scenario of cases)test(`${scenario.name} maps unreadable upstream responses to a redacted 503 without replay`,async()=>{
 for(const reply of [()=>brokenResponse(200),()=>brokenResponse(503),()=>new Response('{"private":"truncated'),()=>new Response('<html>private proxy error</html>')]){
  const {handle,calls}=backend(scenario.target,reply);
  const result=await handle(request(scenario.path,scenario.body));
  assert.equal(result.status,503);
  assert.deepEqual(await result.json(),{error:'Service unavailable. Retry later.'});
  assert.equal(result.headers.get('set-cookie'),null);
  assert.equal(result.headers.get('cache-control'),'no-store');
  assert.equal(calls.filter(c=>c.path===scenario.target).length,1);
 }
});

test('readable auth and database errors retain their existing status mapping',async()=>{
 for(const [payload,status,expected] of [[{error_code:'invalid_credentials'},400,401],[{error_code:'email_not_confirmed'},400,403],[{error_code:'signup_disabled'},400,503]]){
  const {handle}=backend('/auth/v1/token',()=>Response.json(payload,{status}));
  assert.equal((await handle(request('login',cases[0].body))).status,expected);
 }
 for(const [message,status,expected] of [['version_conflict',400,409],['forbidden',403,403],['private upstream error',500,503]]){
  const {handle}=backend('/rest/v1/rpc/beta_command',()=>Response.json({message},{status}));
  const result=await handle(request(cases[2].path,cases[2].body));
  assert.equal(result.status,expected);assert.doesNotMatch(await result.text(),/private upstream/);
 }
});

test('empty successful upstream responses remain valid for recovery and logout',async()=>{
 const recovery=backend('/auth/v1/recover',()=>new Response(null,{status:204}));
 assert.equal((await recovery.handle(request('recover',{email:'synthetic@example.invalid'}))).status,200);
 const logout=backend('/auth/v1/logout',()=>new Response(null,{status:204}));
 const result=await logout.handle(request('logout',{}));
 assert.equal(result.status,200);assert.match(result.headers.get('set-cookie'),/Max-Age=0/);
});

for(const scenario of cases)test(`${scenario.name} rejects malformed UTF-8 without accepting replacement text`,async()=>{
 const payload=scenario.name==='sign-in'?{access_token:'damaged-marker',expires_in:3600}:scenario.name==='workspace read'?[{version:0,bundle:emptyBundle(),updated_at:'damaged-marker'}]:{saved:true,receipt:'damaged-marker'};
 const [prefix,suffix]=JSON.stringify(payload).split('damaged-marker');
 const bytes=Buffer.concat([Buffer.from(prefix),Buffer.from([0xc3,0x28]),Buffer.from(suffix)]);
 const {handle,calls}=backend(scenario.target,()=>new Response(bytes,{headers:{'Content-Type':'application/json'}}));
 const result=await handle(request(scenario.path,scenario.body));
 assert.equal(result.status,503);
 assert.deepEqual(await result.json(),{error:'Service unavailable. Retry later.'});
 assert.equal(result.headers.get('set-cookie'),null);
 assert.equal(calls.filter(c=>c.path===scenario.target).length,1);
});

test('workspace responses preserve valid Unicode across byte chunks and a UTF-8 BOM',async()=>{
 const payload=[{version:0,bundle:emptyBundle(),label:'Bras robotisé 🤖',literalReplacement:'\uFFFD'}];
 const bytes=Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(JSON.stringify(payload))]);
 const {handle}=backend('/rest/v1/workspaces',()=>new Response(new ReadableStream({start(c){for(const byte of bytes)c.enqueue(Uint8Array.of(byte));c.close();}})));
 const result=await handle(request(`org/${org}/workspace`));
 assert.equal(result.status,200);
 assert.deepEqual(await result.json(),{...payload[0],role:'member'});
});

test('login rejects unusable session metadata before cookies or session approval',async()=>{
 const previous=process.env.BETA_AUTH_LIFECYCLE;
 try{
  for(const lifecycle of ['false','true']){
   process.env.BETA_AUTH_LIFECYCLE=lifecycle;
   for(const payload of [null,[],{},
    ...['','   ',null,42,[]].map(access_token=>({access_token,expires_in:3600})),
    ...[0,-1,0.5,3600.5,'3600',null].map(expires_in=>({access_token:'synthetic-access',expires_in})),
   ]){
    const {handle,calls}=backend('/auth/v1/token',()=>Response.json(payload));
    const result=await handle(request('login',cases[0].body));
    assert.equal(result.status,503,JSON.stringify(payload));
    assert.deepEqual(await result.json(),{error:'Invalid authentication response.'});
    assert.equal(result.headers.get('set-cookie'),null);assert.equal(calls.length,1);
   }
  }
  process.env.BETA_AUTH_LIFECYCLE='false';
  for(const expires_in of [1,3600,7200]){
   const {handle}=backend('/auth/v1/token',()=>Response.json({access_token:'synthetic-access',expires_in}));
   const result=await handle(request('login',cases[0].body));
   assert.equal(result.status,200);assert.match(result.headers.get('set-cookie'),new RegExp(`Max-Age=${Math.min(expires_in,3600)}(?:;|$)`));
  }
 }finally{if(previous===undefined)delete process.env.BETA_AUTH_LIFECYCLE;else process.env.BETA_AUTH_LIFECYCLE=previous;}
});
