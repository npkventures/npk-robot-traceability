import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {demoRecords} from '../../lib/demo/fixtures.ts';
import {commandInput} from '../../lib/beta/commands.ts';
import {createHandler} from '../../lib/beta/server.ts';

const future=()=>new Date(Date.now()+1800000).toISOString();
function request(gateway,snapshot){return {action:'request',id:randomUUID(),correlation_id:randomUUID(),gateway_id:gateway,snapshot_id:snapshot.id,snapshot_revision:snapshot.revision,expires_at:future(),kind:'simulation.check',parameters:{checks:2},reality:'simulation'};}
test('command contract rejects physical actions, unapproved fields and invented cancellation',()=>{
 const input=request(randomUUID(),{id:'snapshot',revision:1});
 assert.deepEqual(commandInput(input),input);
 for(const change of [{kind:'ur.move'},{reality:'real'},{parameters:{checks:2,script:'not allowed'}},{snapshot_revision:0},{approved:true},{expires_at:'2026-02-30T00:00:00.000Z'}])assert.throws(()=>commandInput({...input,...change}));
 assert.throws(()=>commandInput({action:'approve',id:input.id},true));
 assert.throws(()=>commandInput({action:'report',id:input.id,event_id:randomUUID(),state:'completed',outcome:'cancelled',stop_confirmed:false,reason:'test',observed_at:new Date().toISOString()},true));
});

const capacityMigration='20261109190000_command_capacity_fix.sql';
async function fixture(skipCapacityFix=false){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
 create table auth.identities(id uuid primary key,user_id uuid references auth.users,provider text);
 create function auth.uid() returns uuid language sql as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
 grant usage on schema auth,public to authenticated;`);
 for(const f of(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&(!skipCapacityFix||f!==capacityMigration)).sort())await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
 const org=randomUUID(),other=randomUUID(),owner=randomUUID(),operator=randomUUID(),viewer=randomUUID(),project=randomUUID();
 await db.query("insert into auth.users values($1,'owner@example.invalid',now()),($2,'operator@example.invalid',now()),($3,'viewer@example.invalid',now())",[owner,operator,viewer]);
 await db.query("insert into organizations(id,name) values($1,'Synthetic B10'),($2,'Other synthetic')",[org,other]);
 await db.query("insert into memberships values($1,$2,'owner'),($1,$3,'operator'),($1,$4,'viewer')",[org,owner,operator,viewer]);
 await db.query('insert into workspaces(org_id,incremental) values($1,true)',[org]);
 const run=demoRecords.runs[0],snapshot=demoRecords.snapshots.find(s=>s.id===run.snapshotId&&s.revision===run.snapshotRevision),robot=demoRecords.robots.find(r=>r.id===run.robotId);
 const bundle={format:'unify-local',version:1,synthetic:true,records:{robots:[robot],snapshots:[snapshot],runs:[run]},corrections:[]};
 await db.query('select append_records($1,$2,$3)',[org,owner,JSON.stringify({bundle,request_id:'seed',body_hash:'a'.repeat(64)})]);
 await db.query("insert into projects(org_id,id,name) values($1,$2,'Synthetic command project')",[org,project]);
 await db.query('insert into project_robots values($1,$2,$3)',[org,project,robot.id]);
 const machine=async(kind,hash)=>(await db.query('select machine_admin($1,$2,$3,$4) r',['create',org,owner,JSON.stringify({name:'Synthetic '+kind,kind,project_id:project,robot_id:robot.id,capabilities:['receipts:read'],per_minute:600,expires_days:30,token_hash:hash})])).rows[0].r;
 const gateway=await machine('gateway','b'.repeat(64)),service=await machine('api_client','c'.repeat(64));
 const call=(data,actor=owner,tenant=org)=>db.query('select command_control($1,$2,null,$3) r',[tenant,actor,JSON.stringify(data)]).then(x=>x.rows[0].r);
 const transport=(data,hash='b'.repeat(64))=>db.query('select command_control(null,null,$1,$2) r',[hash,JSON.stringify(data)]).then(x=>x.rows[0].r);
 await call({action:'grant',machine_id:gateway.id,request_enabled:false,dispatch_enabled:true});
 await call({action:'grant',machine_id:service.id,request_enabled:true,dispatch_enabled:false});
 const enqueue=async(actor=operator)=>{const input=request(gateway.id,snapshot);await call(input,actor);return input;};
 const report=(id,state,outcome=null)=>({action:'report',id,event_id:randomUUID(),state,outcome,reason:'Synthetic test observation',observed_at:new Date().toISOString(),stop_confirmed:outcome==='cancelled'});
 return {db,org,other,owner,operator,viewer,project,robot,snapshot,gateway,service,call,transport,enqueue,report};
}

test('database simulation flow preserves immutable requests, exact references, replay and cancellation distinction',async()=>{
 const f=await fixture();const {db,call,transport,enqueue,report,org,operator,viewer,gateway,snapshot}=f;
 try{
  const r=await enqueue();
  assert.equal((await call(r,operator)).duplicate,true);
  await assert.rejects(call({...r,parameters:{checks:3}},operator),/idempotency_conflict/);
  await assert.rejects(call(request(gateway.id,{...snapshot,revision:999})),/foreign key/);
  await assert.rejects(call(request(gateway.id,snapshot),viewer),/forbidden/);
  await assert.rejects(call({action:'approve',id:r.id},operator),/forbidden/);
  assert.equal((await transport({action:'dispatch',id:r.id})).state,'requested');
  assert.equal((await call({action:'approve',id:r.id})).state,'approved');
  const dispatched=await transport({action:'dispatch',id:r.id});
  assert.equal(dispatched.first_dispatch,true);assert.equal(dispatched.request.snapshot_revision,snapshot.revision);
  assert.equal((await transport({action:'dispatch',id:r.id})).first_dispatch,false);
  const ack=report(r.id,'acknowledged');await transport(ack);assert.equal((await transport(ack)).duplicate,true);
  await assert.rejects(transport({...ack,reason:'changed'}),/idempotency_conflict/);
  await assert.rejects(transport(report(r.id,'completed','succeeded')),/invalid_command_transition/);
  await transport(report(r.id,'executing'));
  const cancel=await call({action:'cancel',id:r.id},operator);
  assert.equal(cancel.state,'executing');assert.equal(cancel.stop_confirmed,false);
  const stopped=report(r.id,'completed','cancelled');
  assert.equal((await transport(stopped)).stop_confirmed,true);
  assert.equal((await transport(stopped)).stop_confirmed,true);
  const detail=await call({action:'get',id:r.id});
  assert.equal(detail.status.state,'completed');assert.equal(detail.status.stop_confirmed,true);
  assert.equal(detail.request.spec.reality,'simulation');assert.equal(detail.events.length,7);
  await assert.rejects(db.query('update command_requests set snapshot_revision=9 where org_id=$1',[org]),/immutable/);
  await assert.rejects(db.query("update command_events set payload='{}' where org_id=$1",[org]),/immutable/);
  await db.query('delete from organizations where id=$1',[org]);
  assert.equal((await db.query('select * from command_events')).rows.length,0);
 }finally{await db.close();}
});

test('dispatch rechecks requester, approver, opt-in grant and service token; tenant/client direct paths deny',async()=>{
 const f=await fixture();const {db,call,transport,enqueue,org,other,owner,operator,gateway,service,snapshot}=f;
 try{
  const a=await enqueue();await call({action:'approve',id:a.id});
  await db.query("update memberships set role='viewer' where org_id=$1 and user_id=$2",[org,operator]);
  assert.equal((await transport({action:'dispatch',id:a.id})).state,'rejected');
  await db.query("update memberships set role='operator' where org_id=$1 and user_id=$2",[org,operator]);
  const b=await enqueue();await call({action:'approve',id:b.id});
  await db.query("update memberships set role='engineer' where org_id=$1 and user_id=$2",[org,owner]);
  await assert.rejects(transport({action:'dispatch',id:b.id}),/forbidden/);
  await db.query("update memberships set role='owner' where org_id=$1 and user_id=$2",[org,owner]);
  const serviceRequest=request(gateway.id,snapshot);
  await transport(serviceRequest,'c'.repeat(64));await call({action:'approve',id:serviceRequest.id});
  await db.query('update collector_credentials set revoked_at=now() where id=$1',[service.credential_id]);
  assert.equal((await transport({action:'dispatch',id:serviceRequest.id})).state,'rejected');
  await assert.rejects(call({action:'get',id:b.id},owner,other),/forbidden/);
  await assert.rejects(call({action:'get',id:b.id},randomUUID()),/forbidden/);
  await call({action:'grant',machine_id:gateway.id,request_enabled:false,dispatch_enabled:false});
  await assert.rejects(transport({action:'dispatch',id:b.id}),/forbidden/);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from command_requests'),/permission denied/);
  await assert.rejects(call({action:'get',id:b.id}),/permission denied/);
  await db.exec('reset role');
 }finally{await db.close();}
});

test('expiry after dispatch is unknown; late durable completion reconciles without redispatch',async()=>{
 const f=await fixture();const {db,call,transport,enqueue,report,org}=f;
 try{
  const r=await enqueue();await call({action:'approve',id:r.id});await transport({action:'dispatch',id:r.id});
  await transport(report(r.id,'acknowledged'));await transport(report(r.id,'executing'));
  // Test-only clock fixture: immutable trigger is restored before exercising production RPCs.
  await db.exec('alter table command_requests disable trigger immutable');
  await db.query("update command_requests set expires_at=clock_timestamp()-interval '1 second' where org_id=$1 and id=$2",[org,r.id]);
  await db.exec('alter table command_requests enable trigger immutable');
  assert.equal((await call({action:'get',id:r.id})).status.state,'unknown');
  assert.equal((await transport({action:'dispatch',id:r.id})).first_dispatch,false);
  const completed=report(r.id,'completed','succeeded');
  assert.equal((await transport(completed)).state,'completed');assert.equal((await transport(completed)).duplicate,true);
  const pending=await enqueue();
  await db.exec('alter table command_requests disable trigger immutable');
  await db.query("update command_requests set expires_at=clock_timestamp()-interval '1 second' where id=$1",[pending.id]);
  await db.exec('alter table command_requests enable trigger immutable');
  assert.equal((await call({action:'approve',id:pending.id})).state,'expired');
  const ambiguous=await enqueue();await call({action:'approve',id:ambiguous.id});await transport({action:'dispatch',id:ambiguous.id});
  await transport(report(ambiguous.id,'unknown'));
  await assert.rejects(call({action:'resolve',id:ambiguous.id,outcome:'not-started',evidence:'Verified durable simulator journal; no start.'},f.operator),/forbidden/);
  assert.equal((await call({action:'resolve',id:ambiguous.id,outcome:'not-started',evidence:'Verified durable simulator journal; no start.'})).state,'rejected');
  assert.equal((await call({action:'get',id:ambiguous.id})).events.at(-1).payload.method,'manual simulation reconciliation');
 }finally{await db.close();}
});

test('start rechecks changed permission and cancellation after dispatch',async()=>{
 const f=await fixture();const {db,call,transport,enqueue,report,org,operator}=f;
 try{
  for(const change of ['cancel','permission']){
   const r=await enqueue();await call({action:'approve',id:r.id});await transport({action:'dispatch',id:r.id});await transport(report(r.id,'acknowledged'));
   if(change==='cancel')await call({action:'cancel',id:r.id});
   else await db.query("update memberships set role='viewer' where org_id=$1 and user_id=$2",[org,operator]);
   assert.equal((await transport(report(r.id,'executing'))).state,'rejected');
  }
 }finally{await db.close();}
});

test('expired undispatched requests do not exhaust capacity, but uncertain dispatches still do',async()=>{
 const {db,org,operator,gateway,snapshot,call,enqueue}=await fixture(true);
 try{
  const seed=await enqueue();
  // Synthetic historical rows: no production request or immutable event is rewritten.
  const seedHistory=async(count,expired)=>db.query(`with copies as materialized (
   select r.*,gen_random_uuid() new_id,gen_random_uuid() new_correlation,
    case when $3 then date_trunc('milliseconds',clock_timestamp()-interval '1 hour') else expires_at end deadline
   from command_requests r cross join generate_series(1,$2::integer) where id=$1)
   insert into command_requests(org_id,id,correlation_id,gateway_id,project_id,robot_id,snapshot_id,snapshot_revision,requested_by,spec,expires_at)
   select org_id,new_id,new_correlation,gateway_id,project_id,robot_id,snapshot_id,snapshot_revision,requested_by,
    spec||jsonb_build_object('id',new_id,'correlation_id',new_correlation,'expires_at',to_char(deadline at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),deadline from copies`,[seed.id,count,expired]);
  await seedHistory(1000,true);
  await db.query(`insert into command_states(org_id,id,state)
   select org_id,id,case when row_number() over(order by id)%2=0 then 'approved' else 'requested' end
   from command_requests where org_id=$1 and id<>$2`,[org,seed.id]);
  const before=(await db.query('select * from command_requests where org_id=$1 order by id',[org])).rows;
  for(const row of before){commandInput(row.spec);assert.equal(row.spec.id,row.id);assert.equal(row.spec.correlation_id,row.correlation_id);assert.equal(Date.parse(row.spec.expires_at),new Date(row.expires_at).getTime());}
  const eventsBefore=(await db.query('select * from command_events where org_id=$1 order by ordinal',[org])).rows;
  const next=request(gateway.id,snapshot);
  await assert.rejects(call(next,operator),/command_queue_full/);
  const statesBefore=(await db.query('select * from command_states where org_id=$1 order by id',[org])).rows;
  const grantsBefore=(await db.query('select * from command_grants where org_id=$1 order by machine_id',[org])).rows;
  await db.exec(await readFile('supabase/migrations/'+capacityMigration,'utf8'));
  assert.deepEqual((await db.query('select * from command_states where org_id=$1 order by id',[org])).rows,statesBefore);
  assert.deepEqual((await db.query('select * from command_grants where org_id=$1 order by machine_id',[org])).rows,grantsBefore);
  for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'public.command_control(uuid,uuid,text,jsonb)','execute') allowed",[role])).rows[0].allowed,false);
  assert.equal((await db.query("select has_function_privilege('service_role','public.command_control(uuid,uuid,text,jsonb)','execute') allowed")).rows[0].allowed,true);
  assert.equal((await call(next,operator)).duplicate,false);
  assert.deepEqual((await db.query('select * from command_requests where org_id=$1 and id<>$2 order by id',[org,next.id])).rows,before);
  assert.deepEqual((await db.query('select * from command_events where org_id=$1 and command_id<>$2 order by ordinal',[org,next.id])).rows,eventsBefore);
  // A prior dispatch remains unresolved even after its deadline; do not free those slots.
  for(const state of ['dispatched','acknowledged','executing','unknown']){
   await db.query('update command_states set state=$1 where org_id=$2 and id not in ($3,$4)',[state,org,seed.id,next.id]);
   await assert.rejects(call(request(gateway.id,snapshot),operator),/command_queue_full/);
  }
  // Unexpired requests alone still enforce the limit.
  await db.query("update command_states set state='completed' where org_id=$1 and id not in ($2,$3)",[org,seed.id,next.id]);
  await seedHistory(998,false);
  await db.query(`insert into command_states(org_id,id)
   select r.org_id,r.id from command_requests r left join command_states s using(org_id,id) where r.org_id=$1 and s.id is null`,[org]);
  await assert.rejects(call(request(gateway.id,snapshot),operator),/command_queue_full/);
 }finally{await db.close();}
});

test('human/machine API separates sessions, strict metadata, hashed credentials and feature gate',async()=>{
 Object.assign(process.env,{BETA_ENABLED:'true',BETA_AUTH_LIFECYCLE:'false',BETA_COMMANDS_ENABLED:'true',BETA_ORIGIN:'https://beta.example.invalid',SUPABASE_URL:'https://db.example.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'server'});
 const actor=randomUUID(),org=randomUUID();let writes=0,role='operator';
 const handle=createHandler(async(url,init)=>{
  const path=new URL(url).pathname;
  if(path==='/auth/v1/user')return Response.json({id:actor,email:'synthetic@example.invalid'});
  if(path==='/rest/v1/memberships')return Response.json(role?[{role}]:[]);
  if(path==='/rest/v1/rpc/command_control'){
   const body=JSON.parse(init.body);writes++;
   if(body.p_hash){assert.match(body.p_hash,/^[a-f0-9]{64}$/);assert.equal(body.p_actor,null);assert.equal(body.p_org,null);}
   else assert.equal(body.p_actor,actor);
   return Response.json({saved:true});
  }
  throw Error('Unexpected request');
 });
 const input=request(randomUUID(),{id:'snapshot',revision:1});
 const human=body=>new Request(`https://beta.example.invalid/api/org/${org}/commands`,{method:'POST',headers:{Origin:'https://beta.example.invalid',Cookie:'unify_session=test','Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await handle(human(input))).status,200);
 assert.equal((await handle(human({...input,raw_source:'not allowed'}))).status,400);
 role='';assert.equal((await handle(human(input))).status,403);role='operator';
 const machine=(token,body=input)=>new Request('https://beta.example.invalid/api/v1/commands',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await handle(machine('um_'+'a'.repeat(64)))).status,200);
 assert.equal((await handle(machine('wrong'))).status,401);
 const report={action:'report',id:input.id,event_id:randomUUID(),state:'completed',outcome:'succeeded',stop_confirmed:false,reason:'Synthetic observation',observed_at:new Date().toISOString()};
 for(const body of [
  ...['get','approve','cancel'].map(action=>({action:[action],id:input.id})),
  {action:'resolve',id:input.id,outcome:['succeeded'],evidence:'Synthetic reconciliation'},
 ]){
  assert.equal((await handle(human(body))).status,400,JSON.stringify(body));
  assert.equal(writes,2);
 }
 for(const body of [
  ...['get','dispatch'].map(action=>({action:[action],id:input.id})),
  {...report,state:['completed'],outcome:null},
  {...report,state:['acknowledged'],outcome:null},
  {...report,outcome:['succeeded']},
  {...report,outcome:['cancelled']},
 ]){
  assert.equal((await handle(machine('um_'+'a'.repeat(64),body))).status,400,JSON.stringify(body));
  assert.equal(writes,2);
 }
 for(const outcome of ['succeeded','failed','cancelled']){
  const valid={...report,outcome,stop_confirmed:outcome==='cancelled'};
  assert.deepEqual(commandInput(valid,true),valid);
 }
 process.env.BETA_COMMANDS_ENABLED='false';assert.equal((await handle(human(input))).status,503);
 assert.equal(writes,2);
});
