import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {beginGoogle,oauthState,recentAuthentication} from '../../lib/beta/auth.ts';
import {createHandler} from '../../lib/beta/server.ts';
const user='10000000-0000-4000-8000-000000000001',sid='20000000-0000-4000-8000-000000000001',google='30000000-0000-4000-8000-000000000001',org='40000000-0000-4000-8000-000000000001';
const cfg={origin:'https://beta.example.invalid',url:'https://auth.example.invalid',key:'public',service:'private-test-key'};
Object.assign(process.env,{BETA_ENABLED:'true',BETA_AUTH_LIFECYCLE:'true',BETA_GOOGLE_ENABLED:'true',BETA_ORIGIN:cfg.origin,SUPABASE_URL:cfg.url,SUPABASE_ANON_KEY:cfg.key,SUPABASE_SERVICE_ROLE_KEY:cfg.service});
const token=(method='password',time=Math.floor(Date.now()/1000))=>'head.'+Buffer.from(JSON.stringify({sub:user,session_id:sid,exp:Math.floor(Date.now()/1000)+3600,amr:[{method,timestamp:time}]})).toString('base64url')+'.sig';
const request=(path,body,cookie='')=>new Request(cfg.origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:cfg.origin,Cookie:cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
test('PKCE is browser-bound, expires and cannot accept a forged linking approval',()=>{
 const begin=beginGoogle(cfg,user),cookie=begin.headers.get('set-cookie').split(';')[0];
 assert.equal(oauthState(cfg,request('oauth-callback',undefined,cookie)).expectedUser,user);
 assert.equal(oauthState(cfg,request('oauth-callback',undefined,cookie+'tamper')),null);
 assert.equal(oauthState({...cfg,service:'rotated'},request('oauth-callback',undefined,cookie)),null);
 const now=Date.now;try{Date.now=()=>now()+601000;assert.equal(oauthState(cfg,request('oauth-callback',undefined,cookie)),null);}finally{Date.now=now;}
 assert.equal(recentAuthentication(token()),true);assert.equal(recentAuthentication(token('password',1)),false);
});
test('Google callback success, cancellation, linking mismatch and token secrecy',async()=>{
 let approved=0;
 const handler=createHandler(async(url,options)=>{
  if(url.includes('grant_type=pkce')){assert.ok(JSON.parse(options.body).code_verifier);return Response.json({access_token:token('oauth'),refresh_token:'app-refresh',expires_in:3600,provider_token:'never-return'});}
  if(url.endsWith('/auth/v1/user'))return Response.json({id:user,email_confirmed_at:'2026-10-22',identities:[{provider:'google',identity_id:google}]});
  if(url.endsWith('/approve_app_session')){approved++;assert.equal(JSON.parse(options.body).p_google,google);return Response.json(true);}
  throw Error('Unexpected request');
 });
 const cookie=beginGoogle(cfg).headers.get('set-cookie').split(';')[0];
 const response=await handler(request('oauth-callback?code=one&next=https://evil.invalid',undefined,cookie));
 assert.equal(response.status,303);assert.equal(response.headers.get('location'),cfg.origin+'/');assert.ok(!response.headers.get('set-cookie').includes('never-return'));assert.equal(approved,1);
 for(const path of ['oauth-callback?error=access_denied','oauth-callback?code=one']){const result=await handler(request(path));assert.equal(result.headers.get('location'),cfg.origin+'/?auth_error=google');}
 const mismatch=beginGoogle(cfg,'10000000-0000-4000-8000-000000000009').headers.get('set-cookie').split(';')[0];
 assert.match((await handler(request('oauth-callback?code=two',undefined,mismatch))).headers.get('location'),/auth_error/);assert.equal(approved,1);
});
test('refresh requires already-approved session; OAuth cannot enter through email adapter',async()=>{
 let allowed=true;
 const handler=createHandler(async url=>{
 if(url.includes('grant_type=refresh_token'))return Response.json({access_token:token(),refresh_token:'rotated',expires_in:3600});
 if(url.endsWith('/auth/v1/user'))return Response.json({id:user,email_confirmed_at:'2026-10-22'});
 if(url.endsWith('/app_session_allowed'))return Response.json(allowed);
 throw Error('Unexpected call');});
 const result=await handler(request('refresh',{},'unify_refresh=old'));assert.equal(result.status,200);assert.match(result.headers.get('set-cookie'),/unify_refresh=rotated/);
 allowed=false;assert.equal((await handler(request('refresh',{},'unify_refresh=old'))).status,401);
 assert.equal((await handler(request('auth-session',{access_token:token('oauth')}))).status,403);
});
test('logout revokes the approved session even after the access cookie expired',async()=>{
 let revoked=false;
 const handler=createHandler(async(url,options)=>{
 if(url.includes('grant_type=refresh_token'))return Response.json({access_token:token(),refresh_token:'next',expires_in:3600});
 if(url.endsWith('/auth/v1/user'))return options.headers.Authorization==='Bearer '?Response.json({}, {status:401}):Response.json({id:user});
 if(url.endsWith('/revoke_app_session')){revoked=true;assert.equal(JSON.parse(options.body).p_session,sid);return Response.json(null);}
 if(url.includes('/auth/v1/logout'))return new Response(null,{status:204});
 throw Error('Unexpected call');});
 const result=await handler(request('logout',{},'unify_refresh=old'));assert.equal(result.status,200);assert.equal(revoked,true);assert.match(result.headers.get('set-cookie'),/unify_refresh=;.*Max-Age=0/);
});

for(const flow of ['login','refresh','oauth'])test(`${flow} rejects malformed sessions before user lookup or approval`,async()=>{
 const valid={access_token:token(),refresh_token:'synthetic-refresh',expires_in:3600};
 const malformed=[{...valid,expires_in:3600.5},null,[],{},
  ...['','   ',null,42,[]].map(access_token=>({...valid,access_token})),
  ...[0,-1,0.5,'3600',null,Number.MAX_SAFE_INTEGER+1].map(expires_in=>({...valid,expires_in})),
  ...[{},[],42,true,'   '].map(refresh_token=>({...valid,refresh_token})),
 ];
 for(const payload of malformed){
  const calls=[];
  const handler=createHandler(async(url)=>{
   calls.push(url);
   if(url.includes('/auth/v1/token?'))return Response.json(payload);
   if(url.endsWith('/auth/v1/user'))return Response.json({id:user,email_confirmed_at:'2026-10-22',identities:[{provider:'google',identity_id:google}]});
   if(url.endsWith('/approve_app_session')||url.endsWith('/app_session_allowed'))return Response.json(true);
   throw Error('Unexpected call');
  });
  const callbackCookie=beginGoogle(cfg).headers.get('set-cookie').split(';')[0];
  const result=await handler(flow==='oauth'?request('oauth-callback?code=synthetic',undefined,callbackCookie):request(flow,flow==='login'?{email:'synthetic@example.invalid',password:'synthetic-password'}:{},'unify_refresh=old'));
  if(flow==='oauth'){
   assert.equal(result.status,303);
   assert.equal(result.headers.get('location'),cfg.origin+'/?auth_error=google');
   assert.ok(result.headers.getSetCookie().every(value=>value.includes('Max-Age=0')));
  }else{
   assert.equal(result.status,503,JSON.stringify(payload));
   assert.deepEqual(await result.json(),{error:'Invalid authentication response.'});
   assert.equal(result.headers.get('set-cookie'),null);
  }
  assert.equal(calls.length,1,'Invalid sessions must not reach user lookup or approval');
 }
});

test('valid session cookies preserve tokens, expiry caps and optional refresh behavior',async()=>{
 for(const flow of ['login','refresh','oauth'])for(const expires_in of [1,3600,7200])for(const refresh_token of [undefined,null,'','synthetic+/=refresh']){
  const access_token=token(flow==='oauth'?'oauth':'password');let checks=0;
  const handler=createHandler(async(url,options)=>{
   if(url.includes('/auth/v1/token?'))return Response.json({access_token,expires_in,refresh_token});
   if(url.endsWith('/auth/v1/user')){
    assert.equal(options.headers.Authorization,'Bearer '+access_token);
    return Response.json({id:user,email_confirmed_at:'2026-10-22',identities:[{provider:'google',identity_id:google}]});
   }
   if(url.endsWith('/approve_app_session')||url.endsWith('/app_session_allowed')){checks++;return Response.json(true);}
   throw Error('Unexpected call');
  });
  const callbackCookie=beginGoogle(cfg).headers.get('set-cookie').split(';')[0];
  const result=await handler(flow==='oauth'?request('oauth-callback?code=synthetic',undefined,callbackCookie):request(flow,flow==='login'?{email:'synthetic@example.invalid',password:'synthetic-password'}:{},'unify_refresh=old'));
  assert.equal(result.status,flow==='oauth'?303:200);assert.equal(checks,1);
  if(flow==='oauth')assert.equal(result.headers.get('location'),cfg.origin+'/');
  else assert.deepEqual(await result.json(),{signedIn:true});
  const cookies=result.headers.getSetCookie();
  assert.equal(cookies.find(c=>c.startsWith('unify_session=')),`unify_session=${encodeURIComponent(access_token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.min(3600,expires_in)}; Secure`);
  assert.equal(cookies.find(c=>c.startsWith('unify_refresh=')),`unify_refresh=${encodeURIComponent(refresh_token??'')}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${refresh_token?2592000:0}; Secure`);
 }
});

test('session authorization requires literal true for refresh, requests and repeated checks',async()=>{
 const oldPortal=process.env.BETA_PORTAL_ENABLED;process.env.BETA_PORTAL_ENABLED='true';
 try {
 for(const invalid of [false,null,'false','true',1,[],{}, {allowed:true}]){
  for(const path of ['refresh','session',`client-updates/${org}/${google}`,`org/${org}/history`]){
   let checks=0,downstream=0;
   const repeated=path.includes('client-updates')||path.endsWith('/history');
   const handler=createHandler(async(url)=>{
    if(url.includes('grant_type=refresh_token'))return Response.json({access_token:token(),refresh_token:'rotated',expires_in:3600});
    if(url.endsWith('/auth/v1/user'))return Response.json({id:user,email_confirmed_at:'2026-10-22'});
    if(url.endsWith('/app_session_allowed'))return Response.json(++checks===1&&repeated?true:invalid);
    if(url.includes('/memberships'))return Response.json([{role:'owner'}]);
    downstream++;
    return Response.json([]);
   });
   const response=await handler(request(path,path==='refresh'?{}:undefined,`unify_session=${token()}; unify_refresh=old`));
   assert.equal(response.status,401,`${path}: ${JSON.stringify(invalid)}`);
   assert.equal(response.headers.get('set-cookie'),null);
   assert.equal(checks,repeated?2:1);
   assert.equal(downstream,0);
  }
 }
 }finally{if(oldPortal===undefined)delete process.env.BETA_PORTAL_ENABLED;else process.env.BETA_PORTAL_ENABLED=oldPortal;}
});
test('database refuses unapproved auto-linked sessions and revokes direct RLS access',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
 create table auth.identities(id uuid primary key,user_id uuid references auth.users,provider text);
 create function auth.uid() returns uuid language sql as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
 grant usage on schema auth,public to authenticated;
 insert into auth.users values('${user}','synthetic@example.invalid',now());`);
 for(const file of(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec(`insert into auth.sessions values('${sid}','${user}',null);insert into auth.identities values('${google}','${user}','google'),('30000000-0000-4000-8000-000000000002','${user}','email');insert into organizations(id,name) values('${org}','Synthetic');insert into memberships values('${org}','${user}','owner');`);
 await assert.rejects(db.query('select approve_app_session($1,$2,$3,false)',[user,sid,google]),/linking_required/);
 async function visible(){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,session_id:sid})]);try{return(await db.query('select * from organizations')).rows.length;}finally{await db.exec('reset role');}}
 assert.equal(await visible(),0);
 await db.query('select approve_app_session($1,$2,$3,true)',[user,sid,google]);assert.equal(await visible(),1);
 await db.query('select revoke_app_session($1,$2,false)',[user,sid]);assert.equal(await visible(),0);
 assert.equal((await db.query('select approve_app_session($1,$2,$3,true) allowed',[user,sid,google])).rows[0].allowed,false);
 }finally{await db.close();}
});
