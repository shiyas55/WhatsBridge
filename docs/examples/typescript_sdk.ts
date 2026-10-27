// Server only. Never put the key in NEXT_PUBLIC_ variables or browser bundles.
export class WhatsBridge {
  constructor(private base:string,private key:string){}
  async request(path:string,body?:unknown,idempotencyKey?:string){
    const response=await fetch(`${this.base}/api/v1/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json',...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error(`WhatsBridge request failed: ${response.status}`);
    return response.json();
  }
  send(connection:string,phone:string,body:string,idempotencyKey:string){return this.request('messages',{connection,phone,kind:'text',payload:{body}},idempotencyKey)}
}
