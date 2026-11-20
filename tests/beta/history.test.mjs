import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boundedHistory,streamHistory} from '../../lib/beta/history.ts';
import {createHandler} from '../../lib/beta/server.ts';
import {demoRecords} from '../../lib/demo/fixtures.ts';
import {MAX_BYTES,parseBundle,validateBundle} from '../../lib/local/records.ts';
const bundle=()=>structuredClone({format:'unify-local',version:1,synthetic:true,records:demoRecords,corrections:[]});
function growingHistory(count=450){
 const snapshot=demoRecords.snapshots.find(s=>s.revision===1);
 return {format:'unify-local',version:2,synthetic:true,records:{robots:demoRecords.robots.filter(r=>r.id===snapshot.robotId),snapshots:Array.from({length:count},(_,i)=>({...structuredClone(snapshot),id:'snapshot-'+String(i).padStart(4,'0')})),runs:[]},corrections:[],mappings:[],investigations:[]};
}
function historyReader(b){
 return async({collection,after='',watermark=1})=>{
  const items=b.records[collection]??(collection==='investigation_revisions'?b.investigations:b[collection])??[];
  const remaining=items.filter(item=>item.id>after),rows=remaining.slice(0,100).map(payload=>({key:payload.id,revision:payload.revision??0,payload,submitted_version:1}));
  return {rows,watermark,next:remaining.length>100?rows.at(-1):null};
 };
}
test('history switches to archive mode when formatted export exceeds the local limit',async()=>{
 const b=growingHistory();validateBundle(b);
 assert.ok(Buffer.byteLength(JSON.stringify(b))<MAX_BYTES-1024);
 assert.ok(Buffer.byteLength(JSON.stringify(b,null,2))>MAX_BYTES);
 // Each append is valid; only the accumulated history exceeds the editor format.
 for(let i=0;i<b.records.snapshots.length;i+=100)parseBundle(JSON.stringify({...b,records:{...b.records,snapshots:b.records.snapshots.slice(i,i+100)}}));
 assert.equal(await boundedHistory(historyReader(b),true,1),null);
 const small=growingHistory(2);
 assert.deepEqual(await boundedHistory(historyReader(small),true,1),small);
});
test('large history remains browsable and complete archive retains every exact snapshot',async()=>{
 Object.assign(process.env,{BETA_HISTORY_ENABLED:'true',BETA_AUTH_LIFECYCLE:'false',BETA_LIFECYCLE_ENABLED:'false',BETA_ENABLED:'true',BETA_ORIGIN:'https://beta.example.invalid',SUPABASE_URL:'https://db.example.invalid',SUPABASE_ANON_KEY:'synthetic-public',SUPABASE_SERVICE_ROLE_KEY:'synthetic-private'});
 const b=growingHistory(),page=historyReader(b),org='00000000-0000-4000-8000-000000000001',actor='10000000-0000-4000-8000-000000000001';
 const handle=createHandler(async(url,options)=>{
  const path=new URL(url).pathname;
  if(path==='/auth/v1/user')return Response.json({id:actor});
  if(path==='/rest/v1/memberships')return Response.json([{role:'member'}]);
  if(path==='/rest/v1/workspaces')return Response.json([{version:1,incremental:true,history_synthetic:true}]);
  if(path==='/rest/v1/rpc/history_page')return Response.json(await page(JSON.parse(options.body).p_data));
  throw Error('Unexpected call');
 });
 const request=path=>new Request(`https://beta.example.invalid/api/org/${org}/${path}`,{headers:{Cookie:'unify_session=synthetic'}});
 const workspace=await handle(request('workspace'));assert.equal(workspace.status,200);
 const state=await workspace.json();assert.equal(state.historyOnly,true);assert.equal(state.incremental,true);assert.equal(state.version,1);
 assert.equal(state.bundle.records.snapshots.length,0);
 const compact=await handle(request('export'));assert.equal(compact.status,413);assert.match((await compact.json()).error,/Export complete history/);
 const archive=await handle(request('export-history'));assert.equal(archive.status,200);
 const lines=(await archive.text()).trim().split('\n').map(JSON.parse);
 assert.deepEqual(lines.filter(row=>row.collection==='snapshots').map(row=>row.payload),b.records.snapshots);
 assert.deepEqual(lines.at(-1),{complete:true,watermark:1});
});
test('bounded history still propagates access failures and invalid records',async()=>{
 await assert.rejects(boundedHistory(async()=>{throw Error('revoked');},true,1),/revoked/);
 const b=growingHistory(1);b.records.snapshots[0].robotId='missing-robot';
 await assert.rejects(boundedHistory(historyReader(b),true,1));
});
test('bounded adapter never labels a truncated history complete; streaming stops on revocation',async()=>{
 const page=async({collection})=>({rows:collection==='robots'?Array.from({length:1001},(_,i)=>({key:String(i),revision:0,payload:{id:String(i)},submitted_version:1})):[],next:null,watermark:1});
 assert.equal(await boundedHistory(page,true,1),null);
 let calls=0;
 const stream=streamHistory(async()=>{if(++calls>1)throw Error('forbidden');return{rows:[],next:null,watermark:1};},true,1);
 const reader=stream.getReader();assert.match(new TextDecoder().decode((await reader.read()).value),/unify-history/);
 await assert.rejects(async()=>{while(!(await reader.read()).done){}},/Export interrupted/);
});
test('incremental application save fetches metadata only, validates input and uses verified actor',async()=>{
 Object.assign(process.env,{BETA_HISTORY_ENABLED:'true',BETA_ENABLED:'true',BETA_ORIGIN:'https://beta.example.invalid',SUPABASE_URL:'https://auth.example.invalid',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private'});
 const org='00000000-0000-4000-8000-000000000001',actor='10000000-0000-4000-8000-000000000001',calls=[];
 const handle=createHandler(async(url,options)=>{calls.push({url,options});const path=new URL(url).pathname;
 if(path==='/auth/v1/user')return Response.json({id:actor});
 if(path==='/rest/v1/memberships')return Response.json([{role:'member'}]);
 if(path==='/rest/v1/workspaces'){assert.equal(new URL(url).searchParams.get('select'),'version,incremental');return Response.json([{version:2000,incremental:true}]);}
 if(path==='/rest/v1/rpc/append_records'){const data=JSON.parse(options.body);assert.equal(data.p_actor,actor);assert.equal(data.p_org,org);assert.equal(data.p_data.expected_version,undefined);return Response.json({version:2001});}
 throw Error('Unexpected call');});
 const request=b=>new Request(`https://beta.example.invalid/api/org/${org}/save`,{method:'POST',headers:{Origin:'https://beta.example.invalid',Cookie:'unify_session=test','Content-Type':'application/json'},body:JSON.stringify({bundle:b,expected_version:1,request_id:'one'})});
 assert.equal((await handle(request(bundle()))).status,200);
 assert.equal((await handle(request({}))).status,400);
 assert.equal(calls.filter(c=>c.url.includes('append_records')).length,1);
});
