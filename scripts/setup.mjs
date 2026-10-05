import {existsSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {createInterface} from 'node:readline/promises';

if(existsSync('.env')){
  console.error('Un fichier .env existe déjà. Il est conservé. Utilise npm run doctor pour vérifier sa configuration.');
  process.exit(1);
}
const rl=createInterface({input:process.stdin,output:process.stdout});
try{
  console.log('Configuration de Pierre Studio. Aucun mot de passe API ne sera enregistré.');
  const origin=(await rl.question('Adresse HTTPS [https://back-office.pierre-coutherut.fr] : ')).trim()||'https://back-office.pierre-coutherut.fr';
  const url=new URL(origin);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Indique seulement l’adresse HTTPS du site.');
  const username=(await rl.question('Identifiant de ton compte API photo : ')).trim();
  if(!/^[\w.@+\-]{1,128}$/.test(username))throw new Error('Identifiant invalide.');
  const contents=['# Configuration privée : ne pas ajouter à Git.',`APP_URL=${url.origin}`,`PHOTO_USERNAME=${username}`,`SESSION_SECRET=${randomBytes(32).toString('hex')}`,''].join('\n');
  writeFileSync('.env',contents,{mode:0o600,flag:'wx'});
  console.log('Configuration créée. Ton mot de passe sera demandé uniquement sur la page de connexion.');
  console.log('Étape suivante : npm run doctor, puis construire et démarrer depuis le Manager Infomaniak.');
}catch(e){console.error('Configuration non créée : '+e.message);process.exitCode=1;}finally{rl.close();}
