import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {BufferJSON,initAuthCreds,proto,type AuthenticationState} from '@whiskeysockets/baileys';
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function scopeId(org:string,project:string,connection:string){if(![org,project,connection].every(x=>UUID.test(x)))throw new Error('Invalid scope');return `${org}_${project}_${connection}`;}
export function seal(value:unknown,key:Buffer,aad:string){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(aad));const data=Buffer.concat([cipher.update(JSON.stringify(value,BufferJSON.replacer)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]);}
export function unseal(value:Buffer,key:Buffer,aad:string){const cipher=createDecipheriv('aes-256-gcm',key,value.subarray(0,12));cipher.setAAD(Buffer.from(aad));cipher.setAuthTag(value.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(value.subarray(28)),cipher.final()]).toString(),BufferJSON.reviver);}
export type Claim={fingerprint:string,status:string,provider_id?:string,created:number};
export class SessionStore {
 data:any;private tail=Promise.resolve();
 constructor(private root:string,private scope:string,private key:Buffer){}
 async load(){await mkdir(this.root,{recursive:true,mode:0o700});try{this.data=unseal(await readFile(join(this.root,this.scope+'.enc')),this.key,this.scope);}catch(e:any){if(e.code!=='ENOENT')throw e;this.data={creds:initAuthCreds(),keys:{},claims:{},receipts:{}};}return this;}
 async save(){const blob=seal(this.data,this.key,this.scope);this.tail=this.tail.then(async()=>{const path=join(this.root,this.scope+'.enc');await writeFile(path+'.tmp',blob,{mode:0o600});await rename(path+'.tmp',path);});return this.tail;}
 auth():AuthenticationState{return {creds:this.data.creds,keys:{get:async(type,ids)=>{const found:any={};for(const id of ids){let v=this.data.keys[`${type}:${id}`];if(type==='app-state-sync-key'&&v)v=proto.Message.AppStateSyncKeyData.fromObject(v);if(v)found[id]=v;}return found;},set:async(data)=>{for(const [type,values]of Object.entries(data)){for(const [id,value]of Object.entries(values??{})){if(value)this.data.keys[`${type}:${id}`]=value;else delete this.data.keys[`${type}:${id}`];}}await this.save();}}};}
 async clearAuth(){this.data.creds=initAuthCreds();this.data.keys={};await this.save();}
}
