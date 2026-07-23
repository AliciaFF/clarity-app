import { fmt } from '../utils';
import { useState, useRef } from 'react';
import { dialog } from '../dialog';
import { IconCamera, IconScan, IconChartDonut } from '@tabler/icons-react';
import { Storage } from '../storage';
import { detectRecurring } from '../utils/recurring';
import dayjs from 'dayjs';
import type { Account, Transaction, InstallmentPlan } from '../types';

type Step = 'idle' | 'loading' | 'confirm' | 'result';

function projectBalance(account: Account, txs: Transaction[], plans: InstallmentPlan[], days: number, purchasePrice: number): number {
  const today = dayjs();
  const { debits, credits } = detectRecurring(txs, [account.id]);
  const excluded: string[] = JSON.parse(localStorage.getItem('bt_projection_excluded') || '[]');
  const overrides: Record<string, number> = JSON.parse(localStorage.getItem('bt_projection_overrides') || '{}');

  let balance = account.balance - purchasePrice;
  for (let i = 1; i <= days; i++) {
    const d = today.add(i, 'day').date();
    for (const p of plans) {
      if (p.active && d === dayjs(p.nextDueDate).date()) balance -= p.monthlyAmount;
    }
    for (const r of [...debits, ...credits]) {
      const day = overrides[r.label] ?? r.dayOfMonth;
      if (d === day && !excluded.includes(r.label)) balance += r.amount;
    }
  }
  return Math.round(balance * 100) / 100;
}

export default function Simulator() {
  const [step, setStep] = useState<Step>('idle');
  const [detectedPrice, setDetectedPrice] = useState<number | null>(null);
  const [detectedPrices, setDetectedPrices] = useState<number[]>([]);
  const [manualPrice, setManualPrice] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [cart, setCart] = useState<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const accounts = Storage.getAccounts();

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const confirmed = await dialog.confirm(
      "Cette photo va être envoyée au service OCR.space pour analyser le prix. Ne photographiez pas de documents contenant des informations personnelles. Continuer ?"
    );
    if (!confirmed) { e.target.value = ''; return; }
    const blobUrl = URL.createObjectURL(file);
    setImageUrl(blobUrl);
    setStep('loading');
    setError('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX = 1200;
          const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = url;
      });
      const formData = new FormData();
      formData.append('apikey', import.meta.env.VITE_OCR_API_KEY || '');
      formData.append('language', 'fre');
      formData.append('isOverlayRequired', 'false');
      formData.append('base64Image', base64);
      const res = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: formData });
      const json = await res.json();
      if (!json?.ParsedResults?.[0]) {
        setStep('confirm');
        setError(`Erreur API: ${JSON.stringify(json).substring(0, 300)}`);
        return;
      }
      const text: string = json.ParsedResults[0].ParsedText ?? '';
      const cleaned = text.replace(/[\n\r]+/g, ' ');
      const prices: number[] = [];
      for (const m of [...cleaned.matchAll(/(\d[\d ,.']*\d|\d)\s*€/g)]) {
        let raw = m[1].trim();
        const spaceDecimal = raw.match(/^(\d{1,4})\s(\d{2})$/);
        if (spaceDecimal) {
          raw = `${spaceDecimal[1]}.${spaceDecimal[2]}`;
        } else {
          raw = raw.replace(/\s/g, '').replace(',', '.').replace("'", '.');
        }
        const price = parseFloat(raw);
        if (!isNaN(price) && price >= 0.5 && price <= 9999) prices.push(price);
      }
      // Pour les prix à 4 chiffres entiers, proposer aussi :
      // - sans le 1er chiffre (ex: 2744,99 → 744,99 : chiffre parasite du badge promo)
      // - les 2 derniers chiffres comme centimes (ex: 1798 → 17,98 : format superscript Amazon)
      const extras: number[] = [];
      for (const p of prices) {
        if (p >= 1000 && p < 10000) {
          const s = Math.round(p).toString();
          // Sans 1er chiffre : 2744 → 744,99
          const trimmed = parseFloat(p.toFixed(2).substring(1));
          if (!isNaN(trimmed) && trimmed >= 0.5 && trimmed <= 9999) extras.push(trimmed);
          // 2 derniers chiffres = centimes : 1798 → 17,98
          const intPart = parseInt(s.slice(0, -2));
          const decPart = parseInt(s.slice(-2));
          const asDecimal = parseFloat(`${intPart}.${decPart.toString().padStart(2, '0')}`);
          if (!isNaN(asDecimal) && asDecimal >= 0.5 && asDecimal <= 9999) extras.push(asDecimal);
        }
      }
      prices.push(...extras);
      if (prices.length > 0) {
        const unique = [...new Set(prices)].sort((a, b) => b - a);
        setDetectedPrices(unique);
        setStep('confirm');
        return;
      }
      setDetectedPrice(null);
      setManualPrice('');
      setStep('confirm');
      setError('Aucun prix détecté. Assurez-vous que le prix avec le symbole € est bien visible et lisible sur la photo.');
    } catch {
      setStep('confirm');
      setError('Erreur lors de l\'analyse — entrez le montant manuellement.');
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  };

  const addToCart = () => {
    const price = parseFloat(manualPrice.replace(',', '.'));
    if (isNaN(price) || price <= 0) { setError('Montant invalide.'); return; }
    setCart(c => [...c, price]);
    setDetectedPrice(null); setDetectedPrices([]); setManualPrice(''); setImageUrl(''); setError('');
    setStep('idle');
    if (inputRef.current) inputRef.current.value = '';
  };

  const simulate = () => {
    const price = parseFloat(manualPrice.replace(',', '.'));
    if (isNaN(price) || price <= 0) { setError('Montant invalide.'); return; }
    const total = cart.reduce((s, p) => s + p, 0) + price;
    setDetectedPrice(total);
    setStep('result');
  };

  const reset = () => {
    setStep('idle'); setDetectedPrice(null); setDetectedPrices([]);
    setManualPrice(''); setImageUrl(''); setError(''); setCart([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const cartTotal = cart.reduce((s, p) => s + p, 0);
  const account = accounts.find(a => a.id === selectedAccountId) || accounts[0];
  const remaining = account && detectedPrice !== null ? account.balance - detectedPrice : null;
  const canAfford = remaining !== null && remaining > 0;
  

  const projections = account && detectedPrice !== null ? [7, 15, 30].map(d => ({
    days: d,
    balance: projectBalance(account, Storage.getTransactions(), Storage.getInstallments(), d, detectedPrice),
  })) : [];

  return (
    <div>

      {accounts.length > 1 && (
        <div className="chips">
          {accounts.map(a => (
            <button key={a.id} className={`chip ${(selectedAccountId === a.id || (!selectedAccountId && a === accounts[0])) ? 'active' : ''}`}
              onClick={() => setSelectedAccountId(a.id)}>{a.name}</button>
          ))}
        </div>
      )}

      {step === 'idle' && cart.length > 0 && (
        <div style={{ margin: '12px 20px 0' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9AA5B4', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Panier ({cart.length} article{cart.length > 1 ? 's' : ''})</p>
          {cart.map((p, i) => (
            <div key={i} className="row" style={{ padding: '6px 0', borderBottom: '1px solid #F0F0F0' }}>
              <p style={{ fontSize: 14, color: '#546E7A' }}>Article {i + 1}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#263238' }}>{fmt(p)} €</p>
                <button onClick={() => setCart(c => c.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#B0BEC5', fontSize: 16, cursor: 'pointer', padding: 0 }}>✕</button>
              </div>
            </div>
          ))}
          <div className="row" style={{ padding: '10px 0' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#263238' }}>Total panier</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#C9A040' }}>{fmt(cartTotal)} €</p>
          </div>
          <button className="btn-primary" style={{ background: '#0D0D0D', color: '#C9A040', marginBottom: 8 }}
            onClick={() => { setDetectedPrice(cartTotal); setStep('result'); }}>
            Simuler le total ({fmt(cartTotal)} €)
          </button>
          <button onClick={reset} style={{ width: '100%', background: 'none', border: 'none', color: '#9AA5B4', fontSize: 13, cursor: 'pointer', marginBottom: 12 }}>
            Vider le panier
          </button>
        </div>
      )}

      {step === 'idle' && (
        <div style={{ padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', marginBottom: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" strokeLinecap="round" strokeLinejoin="round">
                {/* Corps principal */}
                <rect x="4" y="18" width="56" height="38" rx="5" stroke="#C9A040" strokeWidth="2" />
                {/* Bosse du dessus avec viseur */}
                <path d="M18 18 L18 12 Q18 10 20 10 L44 10 Q46 10 46 12 L46 18" stroke="#C9A040" strokeWidth="2" />
                {/* Objectif externe */}
                <circle cx="32" cy="37" r="13" stroke="#C9A040" strokeWidth="2" />
                {/* Objectif interne */}
                <circle cx="32" cy="37" r="9" stroke="#C9A040" strokeWidth="1.5" />
                {/* Reflet objectif */}
                <circle cx="32" cy="37" r="5" stroke="#C9A040" strokeWidth="1.2" />
                <circle cx="28" cy="33" r="1.5" fill="#C9A040" />
                {/* Déclencheur */}
                <rect x="22" y="10" width="8" height="4" rx="2" fill="#C9A040" />
                {/* Flash */}
                <rect x="48" y="22" width="7" height="5" rx="2" stroke="#C9A040" strokeWidth="1.5" />
                {/* Viseur */}
                <rect x="8" y="22" width="8" height="6" rx="1.5" stroke="#C9A040" strokeWidth="1.5" />
              </svg>
            </div>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>Prendre le prix en photo</p>
            <label style={{ display: 'block', background: '#C9A040', color: '#fff', borderRadius: 12, padding: '14px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Ouvrir la caméra
              <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
            </label>
          </div>

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button onClick={() => setStep('confirm')} style={{ background: 'none', border: 'none', color: '#9AA5B4', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
              Ou entrer le prix manuellement
            </button>
          </div>

          {/* Comment ça marche */}
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7A8D', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Comment ça marche</p>
            {[
              { Icon: IconCamera, title: 'Photographiez le prix', desc: 'Pointez votre caméra sur l\'étiquette ou l\'écran affichant le prix.' },
              { Icon: IconScan, title: 'Détection automatique', desc: 'L\'image est analysée pour extraire le montant. L\'image est envoyée à OCR.space — ne photographiez pas de documents personnels.' },
              { Icon: IconChartDonut, title: 'Simulation du solde', desc: 'Clarity calcule ce qu\'il vous restera après l\'achat, aujourd\'hui, dans 7 jours, 15 jours et 30 jours.' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: '#F5EDD6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><s.Icon size={20} color="#C9A040" /></div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#263238', marginBottom: 2 }}>{s.title}</p>
                  <p style={{ fontSize: 12, color: '#6B7A8D', lineHeight: 1.5 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'loading' && (
        <div style={{ padding: 40, textAlign: 'center' }}>
          {imageUrl && <img src={imageUrl} alt="photo" style={{ width: '100%', borderRadius: 12, marginBottom: 20, maxHeight: 300, objectFit: 'contain' }} />}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><IconScan size={40} color="#C9A040" /></div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>Analyse en cours…</p>
          <p style={{ fontSize: 13, color: '#9AA5B4', marginTop: 6 }}>Détection du prix sur la photo</p>
        </div>
      )}

      {step === 'confirm' && (
        <div style={{ padding: 20 }}>
          {imageUrl && <img src={imageUrl} alt="photo" style={{ width: '100%', borderRadius: 12, marginBottom: 16, maxHeight: 300, objectFit: 'contain' }} />}
          {error && <div style={{ background: '#FFF3E0', border: '1px solid #FFB74D', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
            <p style={{ fontSize: 13, color: '#E65100' }}>{error}</p>
          </div>}
          {detectedPrices.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#546E7A', marginBottom: 8 }}>Prix détectés :</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {detectedPrices.map(p => (
                  <button key={p} onClick={() => { setManualPrice(fmt(p)); setDetectedPrice(p); }}
                    style={{ background: manualPrice === fmt(p) ? '#0D0D0D' : '#F5EDD6', color: manualPrice === fmt(p) ? '#C9A040' : '#0D0D0D', border: 'none', borderRadius: 20, padding: '8px 16px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                    {fmt(p)} €
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="field-label">Montant (€)</label>
          <input className="input" type="number" placeholder="ex: 49,99" value={manualPrice}
            onChange={e => setManualPrice(e.target.value)} inputMode="decimal" />
          <button className="btn-primary" style={{ marginTop: 16, background: '#C9A040', color: '#fff' }} onClick={simulate}>
            Simuler {cart.length > 0 ? `(total ${fmt(cartTotal + parseFloat(manualPrice.replace(',', '.') || '0'))} €)` : 'l\'achat'}
          </button>
          <button className="btn-primary" style={{ marginTop: 10, background: '#0D0D0D', color: '#C9A040' }} onClick={addToCart}>
            Ajouter d'autres articles
          </button>
          <button onClick={reset} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#9AA5B4', fontSize: 13, cursor: 'pointer' }}>
            Recommencer
          </button>
        </div>
      )}

      {step === 'result' && account && detectedPrice !== null && (
        <div style={{ padding: 20 }}>
          <div style={{ background: canAfford ? 'linear-gradient(135deg, #D4A840, #C9A040, #B8902E)' : '#FFEBEE', borderRadius: 14, padding: 18, textAlign: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: canAfford ? 'rgba(255,255,255,0.75)' : '#9AA5B4', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Solde après achat</p>
            <p style={{ fontSize: 30, fontWeight: 800, color: remaining! < 0 ? '#EF5350' : '#fff' }}>
              {fmt(remaining!)} €
            </p>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 14, color: '#546E7A' }}>Solde actuel</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>{fmt(account.balance)} €</p>
            </div>
            <div className="row" style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 14, color: '#546E7A' }}>{cart.length > 0 ? `Total ${cart.length + 1} articles` : 'Prix du produit'}</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#EF5350' }}>-{fmt(detectedPrice)} €</p>
            </div>
            <div style={{ height: 1, background: '#F0F0F0', margin: '8px 0' }} />
            <div className="row">
              <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>Solde restant</p>
              <p style={{ fontSize: 15, fontWeight: 800, color: canAfford ? '#43A047' : '#EF5350' }}>{fmt(remaining!)} €</p>
            </div>
          </div>

          <p className="section-title" style={{ marginBottom: 8 }}>Projection après achat</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {projections.map(({ days, balance }) => (
              <div key={days} style={{ flex: 1, background: '#fff', borderRadius: 14, padding: '12px 8px', textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                <p style={{ fontSize: 11, color: '#9AA5B4', marginBottom: 6, fontWeight: 600 }}>J+{days}</p>
                <p style={{ fontSize: 15, fontWeight: 800, color: balance < 0 ? '#EF5350' : '#C9A040' }}>{fmt(balance)} €</p>
              </div>
            ))}
          </div>

          <button className="btn-primary" style={{ background: '#C9A040', color: '#fff' }} onClick={reset}>
            Nouvelle simulation
          </button>
          <button className="btn-primary" style={{ marginTop: 10, background: '#0D0D0D', color: '#C9A040', border: 'none' }}
            onClick={() => { setCart(c => [...c, detectedPrice! - cartTotal]); setDetectedPrice(null); setDetectedPrices([]); setManualPrice(''); setImageUrl(''); setError(''); setStep('idle'); if (inputRef.current) inputRef.current.value = ''; }}>
            Ajouter d'autres articles
          </button>
        </div>
      )}

      <div className="spacer-lg" />
    </div>
  );
}
