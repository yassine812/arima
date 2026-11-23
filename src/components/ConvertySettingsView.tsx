import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, ExternalLink, Link, LockKeyhole, RefreshCw, ShoppingBag } from 'lucide-react';
import '../boutique-commerce.css';

interface Status { ready: boolean; configured: boolean; connected: boolean; clientId: string; profile?: { name: string }; callback: string; scopes: string[] }
async function api(path: string, body?: unknown) {
  const response = await fetch(`/api/converty/${path}`, { credentials: 'same-origin', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'La connexion ne répond pas.');
  return value;
}
export default function ConvertySettingsView() {
  const [status, setStatus] = useState<Status | null>(null);
  const [clientId, setClientId] = useState(''); const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const [changing, setChanging] = useState(false);
  const [reference, setReference] = useState(''); const [vendorReference, setVendorReference] = useState('');
  const [verified, setVerified] = useState(false);
  const load = async () => { const data = await api('status'); setStatus(data); setClientId(data.clientId); };
  useEffect(() => { void load().catch(err => setNotice(err.message)); }, []);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setNotice(''); try { await fn(); } catch (err) { setNotice(err instanceof Error ? err.message : 'La connexion a échoué.'); } finally { setBusy(false); } };
  const save = (event: FormEvent) => { event.preventDefault(); void run(async () => { await api('config', { clientId, clientSecret: secret }); setSecret(''); setChanging(false); await load(); setNotice('Configuration enregistrée. Autorisez maintenant la connexion dans Converty.'); }); };
  const connect = () => void run(async () => { const { url } = await api('authorize', {}); window.location.assign(url); });
  return <section className="converty-settings"><span className="eyebrow">LA BOUTIQUE ARIMA</span><h1>La douceur, du panier à la commande.</h1><p>Votre vitrine animée, vos vidéos et votre panier restent ici. Converty fournit la collection, les prix et reçoit les commandes de la boutique publique.</p>
    {notice && <div className="converty-settings-notice" role="status">{notice}</div>}
    <div className="converty-settings-card"><h2>Notre boutique, votre univers.</h2><div className="converty-settings-status">{status?.connected ? <CheckCircle2 size={21} /> : <Link size={21} />}{status?.connected ? `Connectée à ${status.profile?.name || 'ARIMA'}` : status?.configured ? 'Autorisation Converty à terminer' : 'Connexion Converty à préparer'}</div>
      <p>La commande publique est distincte des commandes et des tarifs de vos cafés partenaires.</p><div className="converty-settings-actions"><a className="button-primary" href="/" target="_blank" rel="noreferrer"><ShoppingBag size={17} />Voir la boutique</a><a className="button-secondary" href="https://partner.converty.shop" target="_blank" rel="noreferrer"><ExternalLink size={17} />Gérer dans Converty</a><button className="button-secondary" disabled={busy} onClick={() => void run(load)}><RefreshCw size={16} />Actualiser</button></div>
    </div>
    {status && !status.ready && <div className="converty-settings-notice">La clé de chiffrement doit être configurée sur le serveur avant la connexion.</div>}
    {status?.ready && <div className="converty-settings-card"><h2><LockKeyhole size={22} /> Connexion privée à Converty</h2><p>Créez une application privée dans Converty → Intégrations → Applications externes. Enregistrez cette adresse de retour :</p><code>{status.callback}</code><p>Accès nécessaires :</p><div className="converty-scopes"><span>Lire la boutique</span><span>Lire les produits</span><span>Créer des commandes</span></div>
      {(!status.configured || changing) ? <form onSubmit={save}><label>Client ID<input required value={clientId} onChange={e => setClientId(e.target.value)} disabled={busy} maxLength={300} autoComplete="off" /></label><label>Client secret<input required type="password" value={secret} onChange={e => setSecret(e.target.value)} disabled={busy} minLength={8} maxLength={3000} autoComplete="new-password" /></label><p>Le secret et les jetons sont chiffrés côté serveur. Ils ne sont jamais transmis à la boutique publique.</p><div className="converty-settings-actions"><button className="button-primary" disabled={busy} type="submit">Enregistrer la connexion</button>{changing && <button className="button-secondary" type="button" onClick={() => { setChanging(false); setSecret(''); }}>Annuler</button>}</div></form> : <><div className="converty-settings-actions"><button className="button-primary" disabled={busy} onClick={connect}><Link size={17} />{status.connected ? 'Renouveler l’autorisation' : 'Autoriser dans Converty'}</button><button className="button-secondary" disabled={busy} onClick={() => setChanging(true)}>Modifier la configuration</button></div><p>La prochaine étape affiche l’autorisation officielle de Converty. Vérifiez que la boutique sélectionnée est ARIMA.</p></>}
    </div>}
    {status?.connected && <details className="converty-settings-card"><summary>Vérifier une commande dont la réception est incertaine</summary><p>Recherchez d’abord la référence web dans les notes des commandes Converty. Confirmez le résultat de cette vérification avant de modifier son état ici.</p><label>Référence web<input value={reference} onChange={e => { setReference(e.target.value); setVerified(false); }} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></label><label>Numéro de commande Converty, si elle a été reçue<input inputMode="numeric" value={vendorReference} onChange={e => setVendorReference(e.target.value)} /></label><label style={{ display: 'flex', alignItems: 'center' }}><input type="checkbox" style={{ width: 20 }} checked={verified} onChange={e => setVerified(e.target.checked)} />J’ai vérifié cette référence dans Converty.</label><div className="converty-settings-actions"><button className="button-primary" disabled={busy || !verified || !reference || !/^[1-9]\d*$/.test(vendorReference)} onClick={() => void run(async () => { await api('reconcile', { attemptKey: reference, reference: Number(vendorReference), confirmed: true }); setNotice('Réception confirmée. Le client peut actualiser son récapitulatif.'); })}>Confirmer la réception</button><button className="button-secondary" disabled={busy || !verified || !reference || !!vendorReference} onClick={() => void run(async () => { await api('reconcile', { attemptKey: reference, confirmed: false }); setNotice('Absence vérifiée. Le client peut recommencer sa commande.'); })}>Confirmer l’absence de commande</button></div></details>}
  </section>;
}
