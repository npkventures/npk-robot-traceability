import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspaceApi, bindAccount, discardRequests } from '../../beta/app/workspace-api.ts';

test('account changes during renewal cannot replay an old mutation as the new account',async()=>{
  const original=globalThis.fetch;let release;const renewal=new Promise(resolve=>release=resolve);const calls=[];
  bindAccount('account-a');
  globalThis.fetch=async(path,options)=>{
    calls.push({path,account:options.headers['X-Tavrik-Account']});
    if(path==='/api/refresh')return renewal;
    return Response.json({error:'expired'},{status:401});
  };
  try{
    const result=workspaceApi('org/team/save',{draft:'synthetic'});
    await new Promise(resolve=>setImmediate(resolve));
    bindAccount('account-b');release(Response.json({}));
    await assert.rejects(result,/Account or workspace changed/);
    assert.deepEqual(calls.map(c=>c.path),['/api/org/team/save','/api/refresh']);
    assert.equal(calls[0].account,'account-a');
  }finally{globalThis.fetch=original;bindAccount('');}
});

test('records parsed after sign-out are discarded rather than returned to the old view',async()=>{
  const original=globalThis.fetch;let release;const parsed=new Promise(resolve=>release=resolve);
  bindAccount('account-a');globalThis.fetch=async()=>({ok:true,status:200,json:()=>parsed});
  try{
    const result=workspaceApi('org/team/workspace');
    await new Promise(resolve=>setImmediate(resolve));
    discardRequests();bindAccount('');release({privateRecord:'synthetic'});
    await assert.rejects(result,/Account or workspace changed/);
  }finally{globalThis.fetch=original;bindAccount('');}
});
