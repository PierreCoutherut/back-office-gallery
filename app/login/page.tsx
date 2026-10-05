import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authConfigured,studioIdentity } from '../../lib/studio-auth';
import LoginForm from './login-form';
export const dynamic='force-dynamic';
export default async function Login(){
  if(await studioIdentity(new Headers(await headers())))redirect('/');
  return <LoginForm configured={authConfigured()}/>;
}
