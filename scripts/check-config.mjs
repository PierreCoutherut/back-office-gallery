import {existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function readConfiguration(){
  if(existsSync('.env'))process.loadEnvFile('.env');
  const errors=[];
  const [major,minor]=process.versions.node.split('.').map(Number);
  if(major<22||major===22&&minor<13)errors.push('Node.js 22.13 minimum requis (24 conseillé).');
  if(!process.env.PHOTO_USERNAME?.trim())errors.push('PHOTO_USERNAME manquant. Lance npm run setup.');
  if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)errors.push('SESSION_SECRET manquant ou trop court. Lance npm run setup.');
  try{const url=new URL(process.env.APP_URL);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error();}catch{errors.push('APP_URL doit être une origine HTTPS, par exemple https://back-office.pierre-coutherut.fr.');}
  const port=Number(process.env.PORT||3000);
  if(!Number.isInteger(port)||port<1||port>65535)errors.push('PORT invalide : utilise le port fourni par Infomaniak.');
  if(errors.length)throw new Error(errors.join('\n'));
  return {port};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{readConfiguration();console.log('Configuration valide. Aucun secret affiché.');}catch(e){console.error(e.message);process.exitCode=1;}}
