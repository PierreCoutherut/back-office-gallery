import { setting } from '../../../lib/studio-runtime';
import { studioIdentity,sameOrigin } from '../../../lib/studio-auth';
import { sessionCookie } from '../../../lib/auth-core';
export const dynamic = 'force-dynamic';
const BASE='https://api.pierre-coutherut.fr';
let session:{token:string,until:number}|undefined;
const json=(value:unknown,status=200,headers:Record<string,string>={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});
function photo(p:any){return {id:p.id,name:p.name,description:p.description,alt:p.alt,tags:p.tags||[],is360:p.is360,status:p.status,source:p.source,urls:p.urls,dominantColors:p.dominantColors,galleries:p.galleries?.map((g:any)=>({id:g.id,name:g.name}))};}
function gallery(g:any,parentId?:string):any{return {id:g.id,name:g.name,desc:g.desc,slug:g.slug,status:g.status,ready:g.ready,tags:g.tags||[],uploadedAt:g.uploadedAt,eventDate:g.eventDate,parentId:g.parentGallery?.id||parentId,featuredPhoto:g.featuredPhoto?photo(g.featuredPhoto):null,photos:g.photos?.map(photo),subGalleries:g.subGalleries?.map((child:any)=>gallery(child,g.id))};}
async function token(){
 if(session&&session.until>Date.now())return session.token;
 const e={PHOTO_USERNAME:setting('PHOTO_USERNAME'),PHOTO_PASSWORD:setting('PHOTO_PASSWORD')};
 if(!e.PHOTO_USERNAME||!e.PHOTO_PASSWORD)throw new Error('La connexion à la photothèque doit être configurée.');
 const r=await fetch(BASE+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:e.PHOTO_USERNAME,password:e.PHOTO_PASSWORD}),signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error('Connexion à la photothèque refusée. Vérifie les identifiants du compte API.');
 const d:any=await r.json();if(!d.access_token)throw new Error('Session API indisponible.');
 session={token:d.access_token,until:Date.now()+5*60*1000};return session.token;
}
async function handle(req:Request){
 const identity=await studioIdentity(req.headers);
 if(!identity)return json({error:'Connecte-toi pour ouvrir ton studio.',code:'AUTH_REQUIRED'},401);
 const u=new URL(req.url),path=u.searchParams.get('path')||'/gallery';
 if(req.method!=='GET'&&!sameOrigin(req))return json({error:'Origine refusée.'},403);
 const allowed=/^\/(gallery(?:\/[a-f0-9-]{36}(?:\/photos|\/notify-client)?)?|photos(?:\/[a-f0-9-]{36}|\/upload)?)$/;
 if(!allowed.test(path))return json({error:'Action indisponible.'},400);
 if((path==='/photos'&&req.method!=='GET')||(req.method==='DELETE'&&path==='/gallery'))return json({error:'Action indisponible.'},405);
 try{
  const t=identity.mode==='sites'?await token():identity.accessToken,h=new Headers({Authorization:'Bearer '+t});
  const ct=req.headers.get('content-type');if(ct)h.set('Content-Type',ct);
  if(Number(req.headers.get('content-length')||0)>28*1024*1024)return json({error:'Image trop volumineuse (25 Mo maximum).'},413);
  // The normal gallery list includes parent/child metadata, but no photo arrays.
  const q=new URLSearchParams();
  if(req.method==='DELETE'&&/^\/gallery\/[a-f0-9-]{36}$/.test(path))q.set('deletePhotos','false');
  const response=await fetch(BASE+path+(q.size?'?'+q:''),{method:req.method,headers:h,body:req.method==='GET'?undefined:await req.arrayBuffer(),signal:AbortSignal.timeout(path==='/photos'||path==='/photos/upload'?120000:45000)});
  if(response.status===401){session=undefined;return identity.mode==='self-hosted'?json({error:'Ta session a expiré. Reconnecte-toi.',code:'AUTH_REQUIRED'},401,{'Set-Cookie':sessionCookie('',0)}):json({error:'La session API a expiré. Réessaie.'},401);}
  if(!response.ok){const raw=await response.text();let msg='';try{const d=JSON.parse(raw);msg=Array.isArray(d.message)?d.message.join(', '):d.message||'';}catch{}return json({error:msg||`L’API a refusé cette action (${response.status}).`},response.status);}
  if(path==='/photos'&&req.method==='GET'&&response.body){
   // Parse each array object independently: no full upstream JSON allocation.
   const reader=response.body.getReader(),decoder=new TextDecoder(),encoder=new TextEncoder();let depth=0,inString=false,escaped=false,part='';
   const stream=new ReadableStream({async pull(controller){try{for(;;){const {done,value}=await reader.read();if(done){if(depth!==0)throw new Error('Index incomplet');controller.close();return;}const text=decoder.decode(value,{stream:true});let output='';for(const ch of text){if(depth===0){if(ch==='{'){depth=1;part='{';}continue;}part+=ch;if(inString){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')inString=false;}else if(ch==='"')inString=true;else if(ch==='{')depth++;else if(ch==='}'&&--depth===0){output+=JSON.stringify(photo(JSON.parse(part)))+'\n';part='';}}if(output){controller.enqueue(encoder.encode(output));return;}}}catch(e){controller.error(e);await reader.cancel();}},cancel(){return reader.cancel();}});
   return new Response(stream,{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(response.status===204)return json({ok:true});
  const d:any=await response.json();
  if(req.method==='GET')return json(path==='/gallery'?d.map((g:any)=>gallery(g)):path.startsWith('/gallery/')?gallery(d):photo(d));
  return json({ok:true,id:d?.id});
 }catch(e){return json({error:e instanceof Error?e.message:'La photothèque est momentanément indisponible.'},502);}
}
export const GET=handle;export const POST=handle;export const PATCH=handle;export const DELETE=handle;
