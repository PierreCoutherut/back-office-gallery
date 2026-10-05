export const SESSION_COOKIE='__Host-pierre-studio';
export const SESSION_SECONDS=8*60*60;
export type StudioSession={username:string;accessToken:string;expiresAt:number};
const encoder=new TextEncoder();
const context=encoder.encode('pierre-studio/session/v1');

function encode(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function decode(value:string){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
async function key(secret:string){
  if(secret.length<32)throw new Error('SESSION_SECRET doit contenir au moins 32 caractères.');
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode(secret));
  return crypto.subtle.importKey('raw',digest,'AES-GCM',false,['encrypt','decrypt']);
}
export function tokenExpiry(token:string,now=Date.now()){
  let end=now+SESSION_SECONDS*1000;
  try{const payload=JSON.parse(new TextDecoder().decode(decode(token.split('.')[1])));if(typeof payload.exp==='number'&&Number.isFinite(payload.exp))end=Math.min(end,payload.exp*1000);}catch{/* Opaque upstream tokens use the local session limit. */}
  return end;
}
export async function sealSession(session:StudioSession,secret:string){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:context},await key(secret),encoder.encode(JSON.stringify(session)));
  const value='v1.'+encode(iv)+'.'+encode(new Uint8Array(encrypted));
  if(value.length>3600)throw new Error('Session trop volumineuse.');
  return value;
}
export async function openSession(value:string,secret:string,username:string,now=Date.now()):Promise<StudioSession|null>{
  if(!value||value.length>3600||!username)return null;
  try{
    const [version,iv,data,...extra]=value.split('.');
    if(version!=='v1'||extra.length||!iv||!data)return null;
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:context},await key(secret),decode(data));
    const session=JSON.parse(new TextDecoder().decode(plain)) as StudioSession;
    if(session.username!==username||typeof session.accessToken!=='string'||!session.accessToken||!Number.isFinite(session.expiresAt)||session.expiresAt<=now||session.expiresAt>now+SESSION_SECONDS*1000+60000)return null;
    return session;
  }catch{return null;}
}
export function readSessionCookie(headers:Headers){
  return headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1)||'';
}
export function sessionCookie(value:string,seconds:number){return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0,Math.floor(seconds))}`;}
export class LoginLimiter{
  private attempts:number[]=[];
  constructor(private limit=10,private windowMs=60_000){}
  take(now=Date.now()){
    this.attempts=this.attempts.filter(t=>now-t<this.windowMs);
    if(this.attempts.length>=this.limit)return Math.max(1,Math.ceil((this.windowMs-(now-this.attempts[0]))/1000));
    this.attempts.push(now);return 0;
  }
}
