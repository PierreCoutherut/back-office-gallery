import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { studioIdentity,IS_SITES } from '../lib/studio-auth';
import Studio from './studio';
export const dynamic='force-dynamic';
export default async function Page(){
  if(!await studioIdentity(new Headers(await headers())))redirect('/login');
  return <Studio selfHosted={!IS_SITES}/>;
}
