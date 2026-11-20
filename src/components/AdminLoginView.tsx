import { useState, type FormEvent } from 'react';
import { ArrowRight, LockKeyhole, UserRound, Eye, EyeOff, AlertCircle, Check } from 'lucide-react';
import BrandLogo from './BrandLogo';
import AtelierArt from './AtelierArt';

export default function AdminLoginView({ onLoginSuccess }: { onLoginSuccess: (token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(null);
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ username, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'La connexion a échoué.');
      localStorage.removeItem('arima_token');
      onLoginSuccess('session');
    } catch (err: any) { setError(err.message || 'Impossible de joindre le serveur.'); }
    finally { setLoading(false); }
  }
  return <main className="login-page">
    <section className="login-story"><img className="login-story-photo" src="/products/illustrated/tira_pistache.png" alt="Illustration du tiramisu pistache de la maison ARIMA" /><div className="login-story-shade" /><div className="login-story-brand"><BrandLogo /></div><div className="login-story-copy"><span className="section-eyebrow">MAISON ARIMA · PÂTISSERIE</span><h1>Le goût<br />du <em>détail.</em></h1><p>Les douceurs de la maison.<br />Un espace à partager.</p><span className="story-line" /></div><span className="login-story-footer">LE SAVOIR-FAIRE À PARTAGER</span></section>
    <section className="login-form-side"><BrandLogo className="login-mobile-logo" /><div className="login-form-container"><AtelierArt className="login-art" /><span className="section-eyebrow">VOTRE ESPACE ARIMA</span><h2>Heureux de<br /><em>vous retrouver.</em></h2><p className="login-description">Produits, commandes et catalogues.<br />Retrouvez votre univers ARIMA.</p><form onSubmit={handleSubmit}><div className="form-field"><label htmlFor="login-username">Identifiant</label><div className="input-with-icon"><UserRound size={17} /><input id="login-username" name="username" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} placeholder="Votre identifiant" /></div></div><div className="form-field"><label htmlFor="login-password">Mot de passe</label><div className="input-with-icon"><LockKeyhole size={17} /><input id="login-password" name="password" autoComplete="current-password" required type={visible ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Votre mot de passe" /><button type="button" className="password-toggle" onClick={() => setVisible(!visible)} aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>{error && <div className="form-error" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}<button className="btn-primary login-submit" disabled={loading}>{loading ? 'Connexion en cours…' : 'Entrer dans mon espace'}{!loading && <ArrowRight size={18} />}</button></form><div className="login-reassurance"><span><Check size={13} /> Votre espace personnel</span><span><LockKeyhole size={12} /> Connexion sécurisée</span></div></div><footer className="login-footer"><span>© {new Date().getFullYear()} Maison ARIMA</span><span>Fait avec soin, en Tunisie.</span></footer></section>
  </main>;
}

