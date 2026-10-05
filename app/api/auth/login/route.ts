import { LoginLimiter,sealSession,sessionCookie,tokenExpiry } from '../../../../lib/auth-core';
import { authConfigured,IS_SITES,sameOrigin } from '../../../../lib/studio-auth';
import { setting } from '../../../../lib/studio-runtime';
export const dynamic='force-dynamic';
const limiter=new LoginLimiter();
const json=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});

export async function POST(req:Request){
  if(!sameOrigin(req))return json({error:'Origine refusée.'},403);
  if(IS_SITES)return json({error:'La connexion de cette version est gérée par ChatGPT.'},400);
  if(!authConfigured())return json({error:'Le studio doit être configuré sur le serveur avant la première connexion.'},503);
  const retry=limiter.take();
  if(retry)return json({error:'Trop de tentatives. Réessaie dans une minute.'},429,{'Retry-After':String(retry)});
  if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'Requête invalide.'},415);
  let credentials:{username?:unknown;password?:unknown};
  try{
    const reader=req.body?.getReader();if(!reader)throw new Error('empty');
    let bytes=0,text='';const decoder=new TextDecoder();
    for(;;){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.length;if(bytes>4096){await reader.cancel();return json({error:'Requête trop volumineuse.'},413);}text+=decoder.decode(chunk.value,{stream:true});}
    credentials=JSON.parse(text+decoder.decode());
  }catch{return json({error:'Requête invalide.'},400);}
  const username=typeof credentials?.username==='string'?credentials.username.trim():'';
  const password=typeof credentials?.password==='string'?credentials.password:'';
  if(username!==setting('PHOTO_USERNAME')||!password||password.length>1024)return json({error:'Identifiant ou mot de passe incorrect.'},401);
  try{
    const response=await fetch('https://api.pierre-coutherut.fr/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password}),cache:'no-store',signal:AbortSignal.timeout(20000)});
    if(response.status===401||response.status===403)return json({error:'Identifiant ou mot de passe incorrect.'},401);
    if(!response.ok)return json({error:'La photothèque est momentanément indisponible.'},502);
    const data=await response.json() as {access_token?:string};
    if(typeof data.access_token!=='string'||!data.access_token)return json({error:'La photothèque n’a pas créé de session.'},502);
    const expiresAt=tokenExpiry(data.access_token);
    if(expiresAt<=Date.now())return json({error:'La session reçue a expiré. Réessaie.'},502);
    const value=await sealSession({username,accessToken:data.access_token,expiresAt},setting('SESSION_SECRET'));
    return json({ok:true},200,{'Set-Cookie':sessionCookie(value,(expiresAt-Date.now())/1000)});
  }catch{return json({error:'Connexion impossible pour le moment. Réessaie.'},502);}
}
