import express from 'express';
import { timingSafeEqual, createHash } from 'node:crypto';
import { createClient } from 'redis';
import { SandboxAdapter, MetaAdapter, SendSchema, ProviderError } from './adapters.js';
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'64kb'}));
const token=process.env.GATEWAY_TOKEN;
if(!token||token.length<24)throw new Error('GATEWAY_TOKEN must contain at least 24 characters');
const redis=createClient({url:process.env.REDIS_URL??'redis://redis:6379/1'});
redis.on('error',()=>console.error(JSON.stringify({event:'redis_error'})));
await redis.connect();
app.get('/health',async(_req,res)=>{try{await redis.ping();res.json({status:'ok'});}catch{res.status(503).json({status:'unavailable'});}});
app.use((req,res,next)=>{
 const actual=Buffer.from(req.headers.authorization??'');const expected=Buffer.from('Bearer '+token);
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected)){res.sendStatus(401);return;}next();
});
app.post('/validate',async(req,res)=>{
 const {phone_number_id,access_token}=req.body;const version=process.env.META_GRAPH_VERSION??'';
 if(!/^\d+$/.test(phone_number_id??'')||typeof access_token!=='string'||!/^v\d+\.\d+$/.test(version)){res.sendStatus(400);return;}
 try{const result=await fetch(`https://graph.facebook.com/${version}/${phone_number_id}?fields=id,display_phone_number`,{headers:{Authorization:`Bearer ${access_token}`},signal:AbortSignal.timeout(10000)});res.status(result.ok?200:400).json({valid:result.ok});}catch{res.sendStatus(503);}
});
app.post('/send',async(req,res)=>{
 const parsed=SendSchema.safeParse(req.body);
 if(!parsed.success){res.status(400).json({error:'Invalid send request'});return;}
 const input=parsed.data;const key='send:'+input.id;
 const fingerprint=createHash('sha256').update(JSON.stringify({provider:input.provider,phone:input.phone,kind:input.kind,payload:input.payload,phone_number_id:input.phone_number_id})).digest('hex');
 // A durable claim survives process crashes. Claimed-but-incomplete sends remain
 // unknown and cannot automatically re-enter the external transport.
 const claim=await redis.set(key,JSON.stringify({fingerprint,status:'unknown'}),{NX:true});
 if(!claim){const cached=JSON.parse((await redis.get(key))??'{}');if(cached.fingerprint!==fingerprint){res.status(409).json({error:'Idempotency conflict'});return;}res.status(cached.status==='unknown'?202:200).json(cached);return;}
 try{
  const adapter=input.provider==='sandbox'?new SandboxAdapter():new MetaAdapter(process.env.META_GRAPH_VERSION??'');
  const result=await adapter.send(input);
  await redis.set(key,JSON.stringify({...result,fingerprint}));
  res.status(result.status==='unknown'?202:200).json(result);
 }catch(error){
  if(error instanceof ProviderError){
   if(error.safeToRetry)await redis.del(key);
   res.status(error.status).json({error:'Provider rejected request',safe_to_retry:error.safeToRetry});
  }else{res.status(202).json({status:'unknown'});}
 }
});
app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error(JSON.stringify({event:'request_failed'}));res.status(503).json({error:'Gateway unavailable',safe_to_retry:false});});
app.listen(Number(process.env.PORT??4000),'0.0.0.0',()=>console.log(JSON.stringify({event:'gateway_started'})));
