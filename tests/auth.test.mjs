import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import ts from 'typescript';

function moduleURL(file,imports={}){
  let code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  for(const [from,to]of Object.entries(imports))code=code.replaceAll("'"+from+"'",JSON.stringify(to)).replaceAll('"'+from+'"',JSON.stringify(to));
  return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
const coreURL=moduleURL('lib/auth-core.ts');
const runtimeURL='data:text/javascript;base64,'+Buffer.from('export const IS_SITES=false;export const setting=k=>process.env[k]||"";').toString('base64');
const authURL=moduleURL('lib/studio-auth.ts',{'./studio-runtime':runtimeURL,'./auth-core':coreURL});
const core=await import(coreURL),auth=await import(authURL);
const login=await import(moduleURL('app/api/auth/login/route.ts',{'../../../../lib/auth-core':coreURL,'../../../../lib/studio-auth':authURL,'../../../../lib/studio-runtime':runtimeURL}));
const logout=await import(moduleURL('app/api/auth/logout/route.ts',{'../../../../lib/auth-core':coreURL,'../../../../lib/studio-auth':authURL}));
const studio=await import(moduleURL('app/api/studio/route.ts',{'../../../lib/auth-core':coreURL,'../../../lib/studio-auth':authURL,'../../../lib/studio-runtime':runtimeURL}));
const origin='https://back-office.pierre-coutherut.fr',username='studio-test',secret=randomBytes(32).toString('hex');
const previousEnv=Object.fromEntries(['PHOTO_USERNAME','SESSION_SECRET','APP_URL'].map(k=>[k,process.env[k]]));
const originalFetch=globalThis.fetch;
before(()=>{process.env.PHOTO_USERNAME=username;process.env.SESSION_SECRET=secret;process.env.APP_URL=origin;});
after(()=>{globalThis.fetch=originalFetch;for(const [k,v]of Object.entries(previousEnv)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
const jwt=(expires=Date.now()+3600_000)=>'header.'+Buffer.from(JSON.stringify({exp:Math.floor(expires/1000)})).toString('base64url')+'.upstream-signature';
async function cookie(){return core.SESSION_COOKIE+'='+await core.sealSession({username,accessToken:jwt(),expiresAt:Date.now()+3600_000},secret);}
function request(path,method='POST',body,headers={}){return new Request(origin+path,{method,headers:{origin,'content-type':'application/json',...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});}

test('encrypted session round trip, tamper, key rotation, account change and expiry',async()=>{
  const session={username,accessToken:jwt(),expiresAt:Date.now()+3600_000};
  const value=await core.sealSession(session,secret);
  assert.ok(!value.includes(session.accessToken));assert.deepEqual(await core.openSession(value,secret,username),session);
  const parts=value.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
  assert.equal(await core.openSession(parts.join('.'),secret,username),null);
  assert.equal(await core.openSession(value,'x'.repeat(64),username),null);
  assert.equal(await core.openSession(value,secret,'different'),null);
  assert.equal(await core.openSession(value,secret,username,session.expiresAt+1),null);
  assert.equal(core.tokenExpiry(jwt(Date.now()-1000))<Date.now(),true);
});
test('Node ignores forged ChatGPT identity headers',async()=>{
  const headers=new Headers({'oai-authenticated-user-id':'fake-owner'});
  assert.equal(await auth.studioIdentity(headers),null);
  let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Must not run');};
  const response=await studio.GET(new Request(origin+'/api/studio?path=/gallery',{headers}));
  assert.equal(response.status,401);assert.equal(calls,0);
});
test('proxy origin is checked against APP_URL; Sites keeps its trusted platform session',async()=>{
  assert.equal(auth.sameOrigin(new Request('http://127.0.0.1:3000/api/studio',{headers:{origin}})),true);
  const sitesRuntime='data:text/javascript;base64,'+Buffer.from('export const IS_SITES=true;export const setting=()=>"";').toString('base64');
  const sites=await import(moduleURL('lib/studio-auth.ts',{'./studio-runtime':sitesRuntime,'./auth-core':coreURL}));
  assert.equal(await sites.studioIdentity(new Headers()),null);
  assert.equal((await sites.studioIdentity(new Headers({'oai-authenticated-user-id':'platform-owner'}))).mode,'sites');
});
test('login rejects cross-origin, bad credentials and oversized input',async()=>{
  assert.equal((await login.POST(request('/api/auth/login','POST',{}, {origin:'https://outside.example'}))).status,403);
  assert.equal((await login.POST(request('/api/auth/login','POST',{username:'wrong',password:'test-only'}))).status,401);
  assert.equal((await login.POST(request('/api/auth/login','POST',{username,password:'x'.repeat(5000)}))).status,413);
});
test('successful login sends credentials only upstream and returns a secure opaque cookie',async()=>{
  let seen;globalThis.fetch=async(url,init)=>{seen={url,init};return Response.json({access_token:jwt()});};
  const response=await login.POST(request('/api/auth/login','POST',{username,password:'test-only'}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
  assert.equal(seen.url,'https://api.pierre-coutherut.fr/auth/login');
  assert.deepEqual(JSON.parse(seen.init.body),{username,password:'test-only'});
  const setCookie=response.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert.ok(setCookie.includes(flag));
  const session=await auth.studioIdentity(new Headers({cookie:setCookie.split(';')[0]}));assert.equal(session.username,username);
});
test('signed-in API forwards the session token and rejects cross-origin writes and bulk wipe',async()=>{
  const c=await cookie();let calls=0;
  globalThis.fetch=async(url,init)=>{calls++;assert.equal(url,'https://api.pierre-coutherut.fr/gallery');assert.ok(init.headers.get('authorization').startsWith('Bearer header.'));return Response.json([]);};
  const response=await studio.GET(request('/api/studio?path=/gallery','GET',undefined,{cookie:c}));assert.equal(response.status,200);assert.deepEqual(await response.json(),[]);
  assert.equal((await studio.PATCH(request('/api/studio?path=/gallery','PATCH',{}, {cookie:c,origin:'https://outside.example'}))).status,403);
  assert.equal((await studio.DELETE(request('/api/studio?path=/gallery','DELETE',undefined,{cookie:c}))).status,405);
  assert.equal(calls,1);
});
test('upstream expiry clears the local cookie; logout is same-origin only',async()=>{
  globalThis.fetch=async()=>Response.json({error:'expired'},{status:401});
  const response=await studio.GET(request('/api/studio?path=/gallery','GET',undefined,{cookie:await cookie()}));
  assert.equal(response.status,401);assert.equal((await response.json()).code,'AUTH_REQUIRED');assert.ok(response.headers.get('set-cookie').includes('Max-Age=0'));
  assert.equal((await logout.POST(request('/api/auth/logout','POST',undefined,{origin:'https://outside.example'}))).status,403);
  const out=await logout.POST(request('/api/auth/logout'));assert.ok(out.headers.get('set-cookie').includes('Max-Age=0'));
});
test('login burst is bounded and recovers after its window',()=>{
  const limiter=new core.LoginLimiter(2,1000);assert.equal(limiter.take(100),0);assert.equal(limiter.take(101),0);assert.equal(limiter.take(102),1);assert.equal(limiter.take(1102),0);
});
