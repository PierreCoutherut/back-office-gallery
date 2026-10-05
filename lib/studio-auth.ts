import { IS_SITES,setting } from './studio-runtime';
import { openSession,readSessionCookie } from './auth-core';

export { IS_SITES };
export async function studioIdentity(headers:Headers){
  if(IS_SITES)return headers.get('oai-authenticated-user-id')?{mode:'sites' as const,username:'Pierre Coutherut',accessToken:''}:null;
  const session=await openSession(readSessionCookie(headers),setting('SESSION_SECRET'),setting('PHOTO_USERNAME'));
  return session?{mode:'self-hosted' as const,...session}:null;
}
export function sameOrigin(req:Request){
  try{const configured=IS_SITES?new URL(req.url).origin:new URL(setting('APP_URL')).origin;return req.headers.get('origin')===configured;}catch{return false;}
}
export function authConfigured(){return IS_SITES||!!setting('PHOTO_USERNAME')&&setting('SESSION_SECRET').length>=32&&/^https:\/\//.test(setting('APP_URL'));}
