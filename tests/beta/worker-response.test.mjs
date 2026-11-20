import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {workerJSON} from '../../lib/beta/worker-response.ts';

test('worker JSON preserves complete Unicode metadata and normal null claims',async()=>{
 const bytes=Buffer.from('\ufeff{"label":"机器人"}');
 const response=new Response(new ReadableStream({start(c){for(const byte of bytes)c.enqueue(Uint8Array.of(byte));c.close();}}));
 assert.deepEqual(await workerJSON(response),{label:'机器人'});assert.equal(response.body.locked,false);
 assert.equal(await workerJSON(new Response('null')),null);
 const boundary='"'+'x'.repeat(2097150)+'"';assert.equal((await workerJSON(new Response(boundary))).length,2097150);
});

test('worker JSON rejects malformed, oversized and interrupted responses without private details',async()=>{
 const interrupted=new Response(new ReadableStream({start(c){c.enqueue(Buffer.from('{"private":'));c.error(Error('private-source'));}}));
 for(const response of [new Response('{"private":'),new Response(Uint8Array.of(0xff)),new Response('"'+'x'.repeat(2097151)+'"'),interrupted,new Response(null)]){
  await assert.rejects(workerJSON(response),{message:'Worker database response unavailable.'});
  assert.equal(response.body?.locked??false,false);
 }
});

test('worker response rejection requests cancellation without awaiting stalled cleanup',async()=>{
 for(const status of [200,503]){
  let cancelled=false,finish;
  const response=new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(2097153));},cancel(){cancelled=true;return new Promise(r=>{finish=r;});}}),{status});
  try{await assert.rejects(workerJSON(response),{message:'Worker database response unavailable.'});assert.equal(cancelled,true);assert.equal(response.body.locked,false);}finally{finish?.();}
 }
});

for(const worker of ['connector','report'])test(`${worker} worker accepts a valid empty claim in its actual entry point`,()=>{
 const fixture=`globalThis.fetch=async()=>new Response('null');`;
 const result=spawnSync(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(fixture),`scripts/${worker}-worker.mjs`,'--once'],{
  encoding:'utf8',timeout:10000,env:{...process.env,BETA_CONNECTORS_ENABLED:'true',BETA_REPORTS_ENABLED:'true',SUPABASE_URL:'https://synthetic.example.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-only',WORKER_HEALTH_PATH:''},
 });
 assert.equal(result.status,0,result.stdout+result.stderr);
 const state=JSON.parse(result.stdout.trim().split('\n').at(-1));assert.equal(state.state,'idle');assert.equal(state.consecutive_failures,0);
});

for(const worker of ['connector','report'])test(`${worker} worker rejects damaged upstream bytes in its actual entry point`,()=>{
 const fixture=`globalThis.fetch=async()=>new Response(Buffer.concat([Buffer.from('{"skipped":true,"note":"private-'),Buffer.from([0xff]),Buffer.from('"}')]),{headers:{'Content-Type':'application/json'}});`;
 const result=spawnSync(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(fixture),`scripts/${worker}-worker.mjs`,'--once'],{
  encoding:'utf8',timeout:10000,env:{...process.env,BETA_CONNECTORS_ENABLED:'true',BETA_REPORTS_ENABLED:'true',SUPABASE_URL:'https://synthetic.example.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-only',WORKER_HEALTH_PATH:''},
 });
 assert.equal(result.status,1,result.stdout+result.stderr);
 const states=result.stdout.trim().split('\n').map(s=>JSON.parse(s));
 assert.equal(states.at(-1).state,'error');assert.equal(states.at(-1).processed_steps,0);
 assert.equal(states.at(-1).consecutive_failures,1);assert.doesNotMatch(result.stdout,/private-|synthetic-only/);
});
