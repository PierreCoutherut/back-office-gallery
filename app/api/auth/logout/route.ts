import { sessionCookie } from '../../../../lib/auth-core';
import { sameOrigin } from '../../../../lib/studio-auth';
export async function POST(req:Request){
  if(!sameOrigin(req))return Response.json({error:'Origine refusée.'},{status:403});
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':sessionCookie('',0)}});
}
