import express from 'express';
import {timingSafeEqual,createHash} from 'node:crypto';
import makeWASocket,{DisconnectReason,Browsers,proto,type WASocket} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import {SessionStore,scopeId,UUID,type Claim} from './store.js';
const token = process.env.BAILEYS_TOKEN || '';
const key = Buffer.from(process.env.BAILEYS_ENCRYPTION_KEY || '', 'base64');
const root = process.env.BAILEYS_SESSION_DIR;
if(token.length < 32 || key.length !== 32 || !root) throw new Error('Configure private BAILEYS_TOKEN, 32-byte BAILEYS_ENCRYPTION_KEY and BAILEYS_SESSION_DIR');
type Session={store:SessionStore,sock?:WASocket,status:string,qr?:string,qrExpires?:number,error?:string,restarts:number,stopped:boolean,starting?:Promise<void>,lastSend:number,epoch:number};
const sessions=new Map<string,Session>();
const loading=new Map<string,Promise<Session>>();
async function load(scope:string):Promise<Session>{if(sessions.has(scope))return sessions.get(scope)!;if(loading.has(scope))return loading.get(scope)!;const promise=(async()=>{const session:Session={store:await new SessionStore(root!,scope,key).load(),status:'DISCONNECTED',restarts:0,stopped:false,lastSend:0,epoch:0};sessions.set(scope,session);return session;})();loading.set(scope,promise);try{return await promise;}finally{loading.delete(scope);}}
async function start(s:Session){
 if(s.starting)return s.starting;
 s.starting=(async()=>{
  s.stopped=false;s.status='PAIRING';s.error=undefined;s.qr=undefined;const epoch=++s.epoch;
  const sock=makeWASocket({auth:s.store.auth(),logger:pino({level:'silent'}),browser:Browsers.ubuntu('Chrome'),markOnlineOnConnect:false,syncFullHistory:false,shouldSyncHistoryMessage:()=>false,connectTimeoutMs:30000,retryRequestDelayMs:5000});
  s.sock=sock;
  sock.ev.on('creds.update',()=>{if(epoch===s.epoch&&!s.stopped)s.store.save().catch(()=>{s.error='Encrypted session storage failed';s.status='FAILED';sock.end(new Error('Storage unavailable'));});});
  sock.ev.on('connection.update',async update=>{
   if(epoch!==s.epoch||s.stopped)return;
   if(update.qr){s.qr=await QRCode.toDataURL(update.qr,{width:300,margin:2,errorCorrectionLevel:'M'});s.qrExpires=Date.now()+45000;s.status='PAIRING';}
   if(update.connection==='open'){s.status='CONNECTED';s.qr=undefined;s.error=undefined;s.restarts=0;await s.store.save();}
   if(update.connection==='close'){
    s.qr=undefined;const code=(update.lastDisconnect?.error as any)?.output?.statusCode;
    if(code===DisconnectReason.loggedOut){s.status='REVOKED';s.stopped=true;await s.store.clearAuth();return;}
    // One protocol-required post-pairing restart; no endless reconnect or evasion.
    if(code===DisconnectReason.restartRequired&&s.restarts<1){s.restarts++;s.status='RECONNECTING';setTimeout(()=>{if(!s.stopped)start(s).catch(()=>{s.status='FAILED';});},1000);}
    else{s.status='DISCONNECTED';s.error=`WhatsApp connection closed (${code ?? 'network error'}). Check gateway internet access and retry pairing.`;}
   }
  });
  sock.ev.on('messages.update',updates=>{for(const update of updates){if(update.key.fromMe&&update.key.id&&update.update.status){const value=update.update.status;const status=value>=proto.WebMessageInfo.Status.READ?'read':value>=proto.WebMessageInfo.Status.DELIVERY_ACK?'delivered':value>=proto.WebMessageInfo.Status.SERVER_ACK?'sent':undefined;if(status){const old=s.store.data.receipts[update.key.id];const ranks:any={sent:1,delivered:2,read:3};if(!old||ranks[status]>ranks[old])s.store.data.receipts[update.key.id]=status;}}}s.store.save().catch(()=>{s.error='Receipt persistence failed';});});
 })();try{await s.starting;}finally{s.starting=undefined;}
}
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'32kb'}));
app.get('/health',(_req,res)=>res.json({status:'ok',provider:'baileys',experimental:true}));
app.use((req,res,next)=>{
 res.setHeader('Cache-Control','no-store');
 const auth=req.headers.authorization??'';
 if(!auth.startsWith('Bearer ')){res.sendStatus(401);return;}
 const sent=auth.slice(7);
 if(Buffer.byteLength(sent)===Buffer.byteLength(token)&&timingSafeEqual(Buffer.from(sent),Buffer.from(token))){next();return;}
 res.sendStatus(401);
});
app.use('/sessions/:org/:project/:connection',async(req,res,next)=>{try{res.locals.scope=scopeId(req.params.org,req.params.project,req.params.connection);res.locals.session=await load(res.locals.scope);next();}catch{res.status(400).json({error:'Invalid or unavailable session'});}});
const route='/sessions/:org/:project/:connection';
app.post(route+'/pair',async(_req,res)=>{const s:Session=res.locals.session;if(s.status==='REVOKED')s.stopped=false;if(!['CONNECTED','PAIRING','RECONNECTING'].includes(s.status)){await start(s);}res.json({status:s.status});});
app.get(route,(_req,res)=>{const s:Session=res.locals.session;res.json({status:s.status,qr:s.qrExpires&&s.qrExpires>Date.now()?s.qr:null,qr_expires_at:s.qrExpires?new Date(s.qrExpires).toISOString():null,error:s.error??'',experimental:true});});
app.post(route+'/disconnect',async(_req,res)=>{const s:Session=res.locals.session;s.stopped=true;s.epoch++;s.qr=undefined;s.status='DISCONNECTED';try{await s.sock?.logout();}catch{}s.sock?.end(new Error('Disconnected by owner'));s.sock=undefined;await s.store.clearAuth();res.json({status:s.status});});
app.post(route+'/send',async(req,res)=>{
 const s:Session=res.locals.session;const b=req.body;
 if(!UUID.test(b.id??'')||!/^\+[1-9][0-9]{7,14}$/.test(b.phone??'')||b.kind!=='text'||typeof b.payload?.body!=='string'||b.payload.body.length<1||b.payload.body.length>4096){res.status(400).json({error:'WhatsApp connector supports text messages up to 4096 characters'});return;}
 const fingerprint=createHash('sha256').update(JSON.stringify([b.phone,b.kind,b.payload.body])).digest('hex');
 const claims=s.store.data.claims as Record<string,Claim>;
 if(claims[b.id]){if(claims[b.id].fingerprint!==fingerprint){res.sendStatus(409);return;}res.status(claims[b.id].status==='unknown'?202:200).json(claims[b.id]);return;}
 if(s.status!=='CONNECTED'||!s.sock){res.status(409).json({error:'Scan QR and connect your WhatsApp first'});return;}
 if(Date.now()-s.lastSend<5000){res.status(429).json({safe_to_retry:true,error:'Experimental per-connection cooldown'});return;}
 s.lastSend=Date.now();claims[b.id]={fingerprint,status:'unknown',created:Date.now()};await s.store.save();
 try{const sent=await s.sock.sendMessage(b.phone.slice(1)+'@s.whatsapp.net',{text:b.payload.body});if(!sent?.key.id)throw new Error('No provider id');claims[b.id]={fingerprint,status:'accepted',provider_id:sent.key.id,created:Date.now()};await s.store.save();res.json(claims[b.id]);}
 catch{res.status(202).json({status:'unknown'});}
});
app.get(route+'/receipts',(_req,res)=>{const s:Session=res.locals.session;res.json({receipts:s.store.data.receipts});});
app.use((_e:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(503).json({error:'Experimental connector unavailable'}));
app.listen(Number(process.env.PORT??14001),process.env.BAILEYS_HOST || '127.0.0.1',()=>console.log('Experimental WhatsApp QR connector ready; OTP disabled'));
