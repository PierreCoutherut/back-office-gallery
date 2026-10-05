import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {readConfiguration} from './check-config.mjs';
const require=createRequire(import.meta.url);
try{
  const {port}=readConfiguration();
  const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','0.0.0.0','--port',String(port)],{stdio:'inherit',env:{...process.env,NODE_ENV:'production'}});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
  child.on('error',e=>{console.error('Démarrage impossible : '+e.message);process.exitCode=1;});
  child.on('exit',code=>{process.exitCode=code??1;});
}catch(e){console.error(e.message);process.exitCode=1;}
