import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../../lib/beta/server.ts';
import { productDestination } from '../../lib/product-destination.ts';
const org = '00000000-0000-4000-8000-000000000001';
const user = '10000000-0000-4000-8000-000000000001';
Object.assign(process.env, { BETA_ENABLED:'true', BETA_ORIGIN:'https://beta.example.invalid', SUPABASE_URL:'https://auth.example.invalid', SUPABASE_ANON_KEY:'synthetic-public', SUPABASE_SERVICE_ROLE_KEY:'synthetic-service' });
const request = (path, body, headers = {}) => new Request('https://beta.example.invalid/api/' + path, { method: body === undefined ? 'GET' : 'POST', headers: { origin:'https://beta.example.invalid', 'content-type':'application/json', ...headers }, body:body === undefined ? undefined : JSON.stringify(body) });
test('anonymous protected reads, files, streams and operations never reach storage', async () => {
  let calls = 0;
  const handle = createHandler(async () => { calls++; throw Error('No upstream access expected'); });
  for (const path of [`org/${org}/workspace`, `org/${org}/export`, `org/${org}/export-history`, `org/${org}/history`, `org/${org}/members`, `org/${org}/access`, `client-projects`, `client-reports/${org}/${org}`, `client-updates/${org}/${org}`]) assert.equal((await handle(request(path))).status,401,path);
  for (const path of [`org/${org}/save`, `org/${org}/invite`, `org/${org}/member`, `org/${org}/integrations`, `org/${org}/commands`, `org/${org}/reports`, 'accept-invite']) assert.equal((await handle(request(path,{}))).status,401,path);
  assert.equal(calls,0);
});
test('a stale account tab cannot read or save using a different account cookie', async () => {
  const calls=[];
  const handle=createHandler(async url => { calls.push(url); return Response.json({id:user,email:'synthetic@example.invalid'}); });
  for (const [path,body] of [[`org/${org}/workspace`,undefined],[`org/${org}/save`,{}]]) {
    const r=await handle(request(path,body,{cookie:'unify_session=test','x-tavrik-account':'10000000-0000-4000-8000-000000000002'}));
    assert.equal(r.status,401);
  }
  assert.ok(calls.every(url=>url.endsWith('/auth/v1/user')));
});
test('viewer draft saves are rejected before privileged writes',async()=>{
  for(const role of ['viewer','internal_viewer']) {
    let writes=0;
    const handle=createHandler(async (url,options)=>{
      if(options.method==='POST')writes++;
      return Response.json(url.endsWith('/auth/v1/user')?{id:user,email:'synthetic@example.invalid'}:[{role}]);
    });
    assert.equal((await handle(request(`org/${org}/save`,{role:'owner',paid:true},{cookie:'unify_session=test'}))).status,403);
    assert.equal(writes,0);
  }
});
test('authentication destinations only retain supported team references',()=>{
  assert.equal(productDestination('/app?org='+org),'/app?org='+org);
  for(const input of ['https://evil.invalid','//evil.invalid','/app/../../api/logout','/app\\evil','/demo','/app?org=not-a-team','/app?paid=true&role=owner','/app#secret'])assert.equal(productDestination(input),'/app');
});
