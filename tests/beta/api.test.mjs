import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,readBody} from '../../lib/beta/server.ts';
import {emptyBundle,appendInvestigation} from '../../lib/local/records.ts';
import {demoRecords} from '../../lib/demo/fixtures.ts';
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002', user='10000000-0000-4000-8000-000000000001';
Object.assign(process.env,{BETA_ENABLED:'true',BETA_ORIGIN:'https://beta.example.invalid',SUPABASE_URL:'https://auth.example.invalid',SUPABASE_ANON_KEY:'synthetic-public-key',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key'});
function request(path,body,headers={}){return new Request(`https://beta.example.invalid/api/${path}`,{method:body===undefined?'GET':'POST',headers:{Origin:'https://beta.example.invalid',Cookie:'unify_session=synthetic-session','Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});}
function backend(role='member'){
 const calls=[];
 const handle=createHandler(async(url,options)=>{
  calls.push({url,options});const path=new URL(url).pathname;
  if(path==='/auth/v1/user')return Response.json({id:user,email:'synthetic@example.invalid'});
  if(path==='/auth/v1/token')return Response.json({access_token:'synthetic-session',expires_in:3600});
  if(path==='/auth/v1/logout')return new Response(null,{status:204});
  if(path==='/rest/v1/memberships')return Response.json(url.includes(B)?[]:[{role}]);
  if(path==='/rest/v1/workspaces')return Response.json([{version:0,bundle:emptyBundle()}]);
  if(path==='/rest/v1/rpc/beta_command')return Response.json({version:1,duplicate:false});
  return Response.json({error:'Unknown stub route'},{status:404});
 });return {handle,calls};
}
test('JSON media type is exact and case-insensitive before upstream access',async()=>{
 for(const type of ['application/json','Application/JSON','application/json; charset=utf-8']){
  const {handle,calls}=backend();
  assert.equal((await handle(request('login',{email:'test@example.invalid',password:'synthetic-password'},{'Content-Type':type}))).status,200);
  assert.equal(calls.length,1);
 }
 for(const type of ['application/jsonp','application/json-extra','text/plain']){
  const {handle,calls}=backend();
  assert.equal((await handle(request('login',{email:'test@example.invalid',password:'synthetic-password'},{'Content-Type':type}))).status,415);
  assert.equal(calls.length,0);
 }
});
test('interrupted request bodies return a sanitized client error and release the reader',async()=>{
 let calls=0;
 const handle=createHandler(async()=>{calls++;return Response.json({});});
 const body=new ReadableStream({pull(controller){controller.error(Error('private transport detail'));}});
 const req=new Request('https://beta.example.invalid/api/login',{method:'POST',headers:{Origin:'https://beta.example.invalid','Content-Type':'application/json'},body,duplex:'half'});
 const response=await handle(req);
 assert.equal(response.status,400);assert.doesNotMatch(await response.text(),/private transport detail/);
 assert.equal(calls,0);assert.equal(body.locked,false);
});
test('body cancellation failures preserve the payload limit and successful reads release locks',async()=>{
 let cancelled=false;
 const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(1025));},cancel(){cancelled=true;throw Error('private cancellation detail');}});
 const req=new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body,duplex:'half'});
 await assert.rejects(readBody(req,1024),error=>error.status===413&& !error.message.includes('private'));
 assert.equal(cancelled,true);assert.equal(body.locked,false);
 const valid=new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"valid":true}'});
 assert.deepEqual(await readBody(valid),{valid:true});assert.equal(valid.body.locked,false);
});
test('pilot API enforces owner access, validates measurements and fails clearly without migration',async()=>{
 for(const role of ['member','viewer']){
  const {handle,calls}=backend(role);
  assert.equal((await handle(request(`org/${A}/pilot`))).status,403);
  assert.equal((await handle(request(`org/${A}/pilot-review`,{}))).status,403);
  assert.equal(calls.some(c=>c.url.includes('pilot_command')),false);
 }
 const {handle}=backend('owner');
 assert.equal((await handle(request(`org/${A}/pilot-review`,{week:1}))).status,400);
 const unavailable=await handle(request(`org/${A}/pilot`));assert.equal(unavailable.status,503);assert.match((await unavailable.json()).error,/Stage 8 migration/);
 assert.equal((await handle(request(`org/${B}/pilot`))).status,403);
});

test('oversized requests reject before stalled cancellation settles',async()=>{
 for(const fail of [false,true]){
  let settle,cancelled=false,timer,calls=0;
  const pending=new Promise((resolve,reject)=>{settle=()=>fail?reject(Error('private cancellation detail')):resolve();});
  const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(8193));},cancel(){cancelled=true;return pending;}});
  const req=new Request('https://beta.example.invalid/api/login',{method:'POST',headers:{Origin:'https://beta.example.invalid','Content-Type':'application/json'},body,duplex:'half'});
  const result=createHandler(async()=>{calls++;return Response.json({});})(req);
  try{
   const response=await Promise.race([result,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Size rejection waited for cancellation')),250);})]);
   assert.equal(response.status,413);assert.deepEqual(await response.json(),{error:'Payload is too large.'});
   assert.equal(cancelled,true);assert.equal(body.locked,false);assert.equal(calls,0);
  }finally{clearTimeout(timer);settle();await result;}
 }
});
test('unconfigured beta fails closed without contacting services',async()=>{
 const old=process.env.BETA_ENABLED;process.env.BETA_ENABLED='false';let called=false;
 try{assert.equal((await createHandler(async()=>{called=true;})(request('status'))).status,503);assert.equal(called,false);}finally{process.env.BETA_ENABLED=old;}
});
test('configuration status explicitly does not verify upstream connectivity',async()=>{
 const {handle,calls}=backend();
 const response=await handle(request('status',undefined,{Cookie:''}));
 assert.deepEqual(await response.json(),{configured:true,connectivity:'not_checked'});
 assert.equal(calls.length,0);
});

test('signup and recovery use public auth API with fixed redirect, without membership writes',async()=>{
 const calls=[]; const handle=createHandler(async(url,options)=>{calls.push({url,options});return Response.json({});});
 for(const path of ['signup','recover','resend-confirmation']){
  const response=await handle(request(path,{email:'demo@example.invalid',password:'long-synthetic-passphrase',role:'owner',redirect_to:'https://attacker.invalid'},{Cookie:''}));
  assert.equal(response.status,200);assert.ok(!(await response.text()).includes('synthetic-passphrase'));
 }
 assert.equal(calls.length,3);
 for(const c of calls){assert.equal(new URL(c.url).searchParams.get('redirect_to'),'https://beta.example.invalid/');assert.equal(c.options.headers.apikey,'synthetic-public-key');assert.equal(JSON.parse(c.options.body).role,undefined);}
 assert.equal((await handle(request('signup',{email:'demo@example.invalid',password:'short'}))).status,400);
 assert.equal((await handle(request('signup',{email:'demo@example.invalid',password:'seven77'}))).status,400);
 assert.equal((await handle(request('signup',{email:'demo@example.invalid',password:'eight888'}))).status,200);
 assert.equal((await handle(request('recover',{email:'invalid'}))).status,400);
});

test('email-link session requires verified Auth user and expiry before setting secure cookie',async()=>{
 const access='header.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.signature';
 const handle=createHandler(async()=>Response.json({id:user,email_confirmed_at:'2026-10-18T00:00:00Z'}));
 const r=await handle(request('auth-session',{access_token:access,user_id:B},{Cookie:''}));
 assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);assert.match(r.headers.get('set-cookie'),/Secure/);assert.ok(!(await r.text()).includes(access));
 assert.equal((await handle(request('auth-session',{access_token:'malformed'},{Cookie:''}))).status,401);
 const unconfirmed=createHandler(async()=>Response.json({id:user}));
 assert.equal((await unconfirmed(request('auth-session',{access_token:access},{Cookie:''}))).status,403);
 const invalid=createHandler(async()=>Response.json({error:'invalid token'},{status:401}));
 assert.equal((await invalid(request('auth-session',{access_token:access},{Cookie:''}))).headers.get('set-cookie'),null);
});

test('password changes require a session, update only that user and clear the cookie',async()=>{
 const {handle,calls}=backend();
 assert.equal((await handle(request('password',{password:'new-synthetic-passphrase'},{Cookie:''}))).status,401);
 assert.equal((await handle(request('password',{password:'seven77'}))).status,400);
 const r=await handle(request('password',{password:'new-synthetic-passphrase',user_id:B}));
 assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);
 const change=calls.find(c=>c.options.method==='PUT');assert.equal(new URL(change.url).pathname,'/auth/v1/user');assert.equal(change.options.headers.Authorization,'Bearer synthetic-session');assert.deepEqual(JSON.parse(change.options.body),{password:'new-synthetic-passphrase'});
 assert.equal(calls.some(c=>c.url.includes('/admin/')||c.url.includes('/rpc/')),false);
 assert.equal((await handle(request('password',{password:'eight888'}))).status,200);
});
test('CSRF, missing session and invalid identifiers rejected before any write',async()=>{
 const {handle,calls}=backend();
 assert.equal((await handle(request(`org/${A}/save`,{}, {Origin:'https://attacker.invalid'}))).status,403);
 assert.equal((await handle(request('session',undefined,{Cookie:''}))).status,401);
 assert.equal((await handle(request('org/not-an-id/workspace'))).status,400);
 assert.equal(calls.filter(c=>c.options.method==='POST').length,0);
});
test('malformed or empty session cookies reject access and can still be signed out',async()=>{
 for(const value of ['%', '%E0%A4%A', '']){
  const {handle,calls}=backend();
  const headers={Cookie:'unify_session='+value};
  assert.equal((await handle(request('session',undefined,headers))).status,401);
  const logout=await handle(request('logout',{},headers));
  assert.equal(logout.status,200);
  assert.match(logout.headers.get('set-cookie'),/unify_session=;.*Max-Age=0/);
  assert.equal(calls.length,0);
 }
});
test('API denies cross-org reads/exports and viewer writes',async()=>{
 const {handle,calls}=backend('viewer');
 for(const path of ['workspace','export','members'])assert.equal((await handle(request(`org/${B}/${path}`))).status,403);
 assert.equal((await handle(request(`org/${A}/save`,{bundle:emptyBundle(),expected_version:0,request_id:'test'}))).status,403);
 assert.equal(calls.some(c=>c.url.includes('/rpc/')),false);
 const allowed=await handle(request(`org/${A}/export`));assert.equal(allowed.status,200);assert.deepEqual(await allowed.json(),emptyBundle());assert.equal(allowed.headers.get('cache-control'),'no-store');
});
test('save uses verified identity and validates schema before privileged RPC',async()=>{
 const {handle,calls}=backend();
 const bad={...emptyBundle(),credentials:'synthetic-secret'};
 const rejected=await handle(request(`org/${A}/save`,{bundle:bad,expected_version:0,request_id:'bad'}));assert.equal(rejected.status,400);assert.ok(!(await rejected.text()).includes('synthetic-secret'));
 assert.equal((await handle(request(`org/${A}/save`,{bundle:emptyBundle(),expected_version:0,request_id:'good',actor:B}))).status,200);
 const rpc=calls.find(c=>c.url.includes('/rpc/'));assert.equal(JSON.parse(rpc.options.body).p_actor,user);assert.equal(rpc.options.headers.Authorization,'Bearer synthetic-service-key');
 for(const c of calls.filter(c=>c.url.includes('/memberships')||c.url.includes('/workspaces')))assert.equal(c.options.headers.Authorization,'Bearer synthetic-session');
});
test('login cookies are HttpOnly, Secure, strict and short-lived; logout clears',async()=>{
 const {handle}=backend();const r=await handle(request('login',{email:'synthetic@example.invalid',password:'synthetic-password'}));
 assert.equal(r.status,200);for(const part of ['HttpOnly','Secure','SameSite=Strict','Max-Age=3600'])assert.ok(r.headers.get('set-cookie').includes(part));assert.ok(!(await r.text()).includes('synthetic-session'));
 assert.ok((await handle(request('logout',{}))).headers.get('set-cookie').includes('Max-Age=0'));
});
test('request size bounded even without a Content-Length header',async()=>{
 await assert.rejects(readBody(new Request('https://example.invalid',{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(1025)}),1024),/too large/);
});
test('collector endpoint requires correct token shape and credential scope',async()=>{
 const {handle,calls}=backend();assert.equal((await handle(request(`ingest/${A}`,{}))).status,401);assert.equal(calls.length,0);
});
test('investigation saves fail closed when the migration relation is unavailable',async()=>{
 const {handle,calls}=backend();
 const bundle=appendInvestigation({format:'unify-local',version:1,synthetic:true,records:structuredClone(demoRecords),corrections:[]},{id:'20000000-0000-4000-8000-000000000001',revision:1,runId:'run-043',baselineId:'run-042',state:'investigating',author:'Synthetic engineer',recordedAt:'2026-10-16T04:00:00Z',note:'Inspect evidence.',evidenceNote:'',retestId:''});
 const response=await handle(request(`org/${A}/save`,{bundle,expected_version:0,request_id:'investigation'}));
 assert.equal(response.status,503);assert.match((await response.json()).error,/Stage 7 migration/);assert.equal(calls.some(c=>c.url.includes('/rpc/')),false);
});
