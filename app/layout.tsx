import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata={title:'Pierre Studio · Photothèque',description:'Le studio privé de Pierre Coutherut. Photos, galeries et livraison client.',applicationName:'Pierre Studio',appleWebApp:{capable:true,title:'Pierre Studio',statusBarStyle:'default'},icons:{icon:[{url:'/favicon.svg',type:'image/svg+xml'},{url:'/icons/icon-192.png',sizes:'192x192',type:'image/png'}],apple:[{url:'/icons/apple-touch-icon.png',sizes:'180x180'}]}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#202124'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fr"><head><link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials"/></head><body>{children}</body></html>}
