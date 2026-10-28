import {test} from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';import {seal,unseal,scopeId,SessionStore} from './store.js';
test('session ciphertext is authenticated and tenant-bound',()=>{const key=randomBytes(32);const blob=seal({secret:'session-key'},key,'tenant-a');assert(!blob.includes(Buffer.from('session-key')));assert.deepEqual(unseal(blob,key,'tenant-a'),{secret:'session-key'});assert.throws(()=>unseal(blob,key,'tenant-b'));blob[30]^=1;assert.throws(()=>unseal(blob,key,'tenant-a'));});
test('scope rejects traversal and malformed tenant IDs',()=>{assert.throws(()=>scopeId('../secrets','a','b'));const id='11111111-1111-4111-8111-111111111111';assert.equal(scopeId(id,id,id),`${id}_${id}_${id}`);});

test('paired auth survives reload and only tenant session files are restored', async()=>{
 const {storedScopes}=await import('./store.js');
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const root=await mkdtemp(join(tmpdir(),'wb-resume-'));
 const key=Buffer.alloc(32,7);
 const scope='00000000-0000-4000-8000-000000000001_00000000-0000-4000-8000-000000000002_00000000-0000-4000-8000-000000000003';
 try{
  const store=await new SessionStore(root,scope,key).load();store.data.creds.registered=true;await store.save();
  await writeFile(join(root,'unscoped.enc'),'invalid');
  assert.deepEqual(await storedScopes(root),[scope]);
  const restored=await new SessionStore(root,scope,key).load();assert.equal(restored.data.creds.registered,true);
  await restored.clearAuth();assert.equal((await new SessionStore(root,scope,key).load()).data.creds.registered,false);
 }finally{await rm(root,{recursive:true,force:true});}
});
