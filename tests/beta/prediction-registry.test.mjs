import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {registryInput} from '../../lib/beta/prediction-registry.ts';
import {predictionReadiness} from '../../lib/beta/prediction-readiness.ts';
import {createHandler} from '../../lib/beta/server.ts';

test('candidate review rejects array states before storage',async()=>{
 const org=randomUUID(),actor=randomUUID();let writes=0;
 Object.assign(process.env,{BETA_ENABLED:'true',BETA_AUTH_LIFECYCLE:'false',BETA_PREDICTION_REGISTRY_ENABLED:'true',BETA_ORIGIN:'https://beta.example.invalid',SUPABASE_URL:'https://db.example.invalid',SUPABASE_ANON_KEY:'synthetic-public',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'});
 const handler=createHandler(async url=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:actor});
  if(url.includes('/memberships?'))return Response.json([{role:'owner'}]);
  writes++;return Response.json({saved:true});
 });
 for(const state of ['collecting_data','insufficient_labels','evaluating','paused','degraded']){
  const review={action:'review',id:randomUUID(),expected_revision:1,state,reason:'Synthetic review',published:false,public_label:null,public_reason:null};
  assert.equal(registryInput(review,org).state,state);
  const response=await handler(new Request(`https://beta.example.invalid/api/org/${org}/prediction-candidates`,{method:'POST',headers:{Origin:'https://beta.example.invalid',Cookie:'unify_session=synthetic','Content-Type':'application/json'},body:JSON.stringify({...review,state:[state]})}));
  assert.equal(response.status,400);assert.equal(writes,0);
 }
});

test('candidate lifecycle lists exact reviews, isolates tenants and publishes only reviewed unavailable status',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
   create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
   create table auth.identities(id uuid primary key,user_id uuid references auth.users,provider text);
   create function auth.uid() returns uuid language sql as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
   grant usage on schema auth,public to authenticated;`);
  const repair='20261107170000_candidate_list_fix.sql';
  for(const name of(await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')&&n!==repair).sort())await db.exec(await readFile('supabase/migrations/'+name,'utf8'));
  const org=randomUUID(),other=randomUUID(),owner=randomUUID(),viewer=randomUUID(),client=randomUUID(),project=randomUUID(),otherProject=randomUUID(),clientId=randomUUID();
  for(const [id,name] of [[owner,'owner'],[viewer,'viewer'],[client,'client']])await db.query('insert into auth.users values($1,$2,now())',[id,name+'@example.invalid']);
  await db.query("insert into organizations(id,name) values($1,'Synthetic registry'),($2,'Other tenant')",[org,other]);
  await db.query("insert into memberships values($1,$2,'owner'),($1,$3,'viewer')",[org,owner,viewer]);
  await db.query("insert into clients values($1,$2,'Synthetic client')",[org,clientId]);
  await db.query("insert into projects(org_id,id,client_id,name) values($1,$2,$3,'Shared'),($1,$4,$3,'Unshared')",[org,project,clientId,otherProject]);
  await db.query('insert into client_project_grants(org_id,project_id,client_id,user_id,granted_by) values($1,$2,$3,$4,$5)',[org,project,clientId,client,owner]);
  const dataset={schema_version:1,org_id:org,project_id:project,cohort:{procedure:'pick',procedure_version:'v1',configuration:'private configuration',environment:'private lab',provenance:'manual-reviewed',reality:'simulation'},target:{capability:'duration',metric:'duration',unit:'s',horizon_seconds:null},feature_version:'v1',label_version:'v1',split_at:'2026-10-15T00:00:00.000Z',evaluated_at:'2026-11-01T00:00:00.000Z',rows:[]};
  const command=(data,actor=owner,tenant=org)=>db.query('select prediction_command($1,$2,$3) result',[tenant,actor,JSON.stringify(data)]).then(r=>r.rows[0].result);
  const published=(actor=client,pid=project)=>db.query('select prediction_public_readiness($1,$2,$3) result',[org,pid,actor]).then(r=>r.rows[0].result);
  const register=registryInput({action:'register',dataset,reason:'Private review note'},org);
  const first=await command(register);
  assert.equal(first.available,false);
  assert.equal((await command(registryInput({action:'register',dataset,reason:'Retry'},org))).id,first.id);
  // Apply the repair to populated pre-fix tables and prove exact history survives.
  const history=()=>db.query(`select jsonb_build_object(
   'candidates',(select jsonb_agg(c order by c.id) from prediction_candidates c),
   'reviews',(select jsonb_agg(r order by r.candidate_id,r.revision) from prediction_reviews r)) records`).then(r=>r.rows[0].records);
  const before=await history();
  await db.exec(await readFile('supabase/migrations/'+repair,'utf8'));
  assert.deepEqual(await history(),before);
  const list={action:'list',project_id:project};
  const rows=await command(list);
  assert.equal(rows.length,1);assert.equal(rows[0].id,first.id);assert.equal(rows[0].revision,1);
  assert.deepEqual(await command(list,viewer),rows);
  assert.deepEqual(await command({...list,project_id:otherProject}),[]);
  await assert.rejects(command(list,owner,other),/forbidden/);
  await assert.rejects(command(list,client),/forbidden/);
  await assert.rejects(command(register,viewer),/forbidden/);
  assert.deepEqual(await published(),[]);
  const review=registryInput({action:'review',id:first.id,expected_revision:1,state:'paused',reason:'Private review detail',published:true,public_label:'Reviewed duration cohort',public_reason:'Evaluation pending'},org);
  await command(review);
  assert.equal((await command(list))[0].revision,2);
  await assert.rejects(command(review),/version_conflict/);
  await assert.rejects(command({...review,expected_revision:2,state:'available'}),/invalid_candidate_state/);
  await assert.rejects(command({...review,expected_revision:2},viewer),/forbidden/);
  const publicRows=await published(),readiness=predictionReadiness(publicRows);
  assert.equal(publicRows.length,1);assert.equal(publicRows[0].revision,2);
  assert.equal(readiness.capabilities.every(c=>c.available===false),true);
  assert.equal(/private configuration|private lab|Private review/.test(JSON.stringify(readiness)),false);
  await assert.rejects(published(client,otherProject),/forbidden/);
  await db.query('delete from client_project_grants where org_id=$1 and user_id=$2',[org,client]);
  await assert.rejects(published(),/forbidden/);
  await command({...review,expected_revision:2,published:false,public_label:null,public_reason:null});
  assert.deepEqual(await published(owner),[]);
  assert.equal((await db.query('select count(*)::int n from prediction_reviews')).rows[0].n,3);
  await assert.rejects(db.query("update prediction_reviews set reason='rewrite'"),/immutable/);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from prediction_candidates'),/permission denied/);
  await assert.rejects(command(list),/permission denied/);
  await db.exec('reset role');

  // Exercise the HTTP list path against the actual SQL, not a canned RPC response.
  Object.assign(process.env,{BETA_ENABLED:'true',BETA_AUTH_LIFECYCLE:'false',BETA_PREDICTION_REGISTRY_ENABLED:'true',BETA_ORIGIN:'https://beta.example.invalid',SUPABASE_URL:'https://db.example.invalid',SUPABASE_ANON_KEY:'synthetic-public',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'});
  const handle=createHandler(async(url,options)=>{
   const path=new URL(url).pathname;
   if(path==='/auth/v1/user')return Response.json({id:owner});
   if(path==='/rest/v1/memberships')return Response.json([{role:'owner'}]);
   if(path==='/rest/v1/rpc/prediction_command'){
    const args=JSON.parse(options.body);
    try{return Response.json(await command(args.p_data,args.p_actor,args.p_org));}
    catch(e){return Response.json({message:e.message},{status:400});}
   }
   throw Error('Unexpected route');
  });
  const response=await handle(new Request(`https://beta.example.invalid/api/org/${org}/prediction-candidates?project_id=${project}`,{headers:{Cookie:'unify_session=synthetic'}}));
  assert.equal(response.status,200);assert.equal((await response.json())[0].revision,3);
 }finally{await db.close();}
});
