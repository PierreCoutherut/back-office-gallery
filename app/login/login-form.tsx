'use client';
import {useState,type FormEvent} from 'react';
import {Aperture,ArrowRight,Eye,EyeOff,LoaderCircle,LockKeyhole} from 'lucide-react';

export default function LoginForm({configured=true}:{configured?:boolean}){
  const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function login(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');const form=new FormData(event.currentTarget);
    try{
      const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:form.get('username'),password:form.get('password')})});
      const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||'Connexion impossible.');
      let hash='';try{hash=sessionStorage.getItem('studio-return-hash')||'';sessionStorage.removeItem('studio-return-hash');}catch{}
      window.location.replace('/'+(/^#(?:galeries|photos|a-completer|gallery\/[a-f0-9-]{36})$/.test(hash)?hash:''));
    }catch(e){setError((e as Error).message);setBusy(false);}
  }
  return <main className="login-page"><section className="login-story"><a className="login-brand" href="/login"><span><Aperture size={27}/></span><strong>PIERRE <small>STUDIO</small></strong></a><div className="login-statement"><p>VOTRE ESPACE PHOTOGRAPHE</p><h1>Tout votre travail.<br/><em>Au même endroit.</em></h1><span>Organisez vos photos, préparez vos galeries<br/>et partagez vos plus belles images.</span></div><div className="login-signature">PIERRE COUTHERUT <span>PHOTOGRAPHIE & FILM</span></div><div className="login-orbit" aria-hidden="true"><Aperture/></div></section><section className="login-panel"><div className="login-card"><span className="login-lock"><LockKeyhole size={22}/></span><p className="login-eyebrow">CONTENT DE VOUS RETROUVER</p><h2>Ouvrir mon studio</h2><p className="login-description">Connectez-vous avec votre compte photothèque.</p>{!configured&&<p className="login-error" role="alert">La configuration du serveur doit être terminée avant la première connexion.</p>}<form onSubmit={login}><label htmlFor="username">Identifiant<input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={busy||!configured} placeholder="Votre identifiant"/></label><label htmlFor="password">Mot de passe<div className="login-password"><input id="password" name="password" type={show?'text':'password'} autoComplete="current-password" required disabled={busy||!configured} placeholder="Votre mot de passe"/><button type="button" disabled={busy} aria-label={show?'Masquer le mot de passe':'Afficher le mot de passe'} aria-pressed={show} onClick={()=>setShow(!show)}>{show?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></label>{error&&<p className="login-error" role="alert">{error}</p>}<button className="login-submit" type="submit" disabled={busy||!configured}>{busy?<><LoaderCircle className="spin" size={18}/> Connexion…</>:<>Se connecter <ArrowRight size={19}/></>}</button></form><p className="login-private"><LockKeyhole size={13}/> Espace privé · Accès réservé</p></div></section></main>;
}
