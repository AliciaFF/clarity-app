import { fmt } from '../utils';
import React, { useState, useEffect, useRef } from 'react';
import { useCountUp } from '../hooks/useCountUp';
import {
  IconShoppingCart, IconToolsKitchen2, IconShirt, IconCar, IconHome,
  IconPill, IconDeviceGamepad2, IconBuildingBank, IconShieldCheck,
  IconHanger, IconCash, IconArrowsExchange, IconCreditCard, IconCoin,
  IconPaw, IconSchool, IconHeart, IconBallFootball, IconGift,
  IconBabyCarriage, IconBox, IconDownload,
} from '@tabler/icons-react';

const CAT_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  '🥖 Courses': IconShoppingCart, '🍕 Restauration': IconToolsKitchen2, '🛒 Shopping': IconShirt,
  '🚗 Transport': IconCar, '🏠 Logement': IconHome, '💊 Santé': IconPill,
  '🎮 Loisirs': IconDeviceGamepad2, '📋 Impôts': IconBuildingBank, '🔒 Assurance': IconShieldCheck,
  '👔 Vêtements': IconHanger, '💶 Revenus': IconCash, '🔄 Virement': IconArrowsExchange,
  '🏧 Retrait': IconCreditCard, '🏦 Frais bancaires': IconCoin, '🐶 Animaux': IconPaw,
  '📖 Éducation': IconSchool, '🧘 Bien-être': IconHeart, '⚽ Sport': IconBallFootball,
  '🎁 Cadeaux': IconGift, '🧸 Enfants': IconBabyCarriage, '💳 Crédit': IconCreditCard, '📦 Autres': IconBox,
};

const CAT_COLORS: Record<string, string> = {
  '🥖 Courses': '#D4845A', '🍕 Restauration': '#C46A3A', '🛒 Shopping': '#B85C8A',
  '🚗 Transport': '#5C8AB8', '🏠 Logement': '#4A6FA5', '💊 Santé': '#5A9E6F',
  '🎮 Loisirs': '#7A5CA8', '📋 Impôts': '#6B7A8D', '🔒 Assurance': '#7A6552',
  '👔 Vêtements': '#A8607A', '💶 Revenus': '#4A9E6A', '🔄 Virement': '#8A9BAE',
  '🏧 Retrait': '#C4953A', '🏦 Frais bancaires': '#5A6B7A', '🐶 Animaux': '#7A9E5A',
  '📖 Éducation': '#4A8FA8', '🧘 Bien-être': '#A87A8A', '⚽ Sport': '#3D8C7A',
  '🎁 Cadeaux': '#8A5CA8', '🧸 Enfants': '#C4935A', '💳 Crédit': '#A85A5A', '📦 Autres': '#8A9298',
};
import { Storage } from '../storage';
import type { Account, InstallmentPlan, Transaction } from '../types';
import { importCSV } from '../utils/importCSV';
import { dialog } from '../dialog';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
dayjs.locale('fr');

function AccRow({ acc }: { acc: { id: string; name: string; type: string; balance: number } }) {
  const animated = useCountUp(acc.balance);
  return (
    <div style={{ padding: '14px 16px', borderTop: '1px solid #F2F4F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <p style={{ fontSize: 16, fontWeight: 500, color: '#1A1A2E' }}>{acc.name}</p>
        <p style={{ fontSize: 12, color: '#6B7A8D', marginTop: 2 }}>
          {acc.type === 'perso' ? 'Compte personnel' : acc.type === 'especes' ? 'Espèces' : 'Professionnel'}
        </p>
      </div>
      <p style={{ fontSize: 18, fontWeight: 700, color: acc.balance < 0 ? '#EF5350' : '#43A047' }}>
        {fmt(animated)} € ›
      </p>
    </div>
  );
}

function getGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return { text: 'Bonjour', icon: 'sun' };
  if (hour >= 12 && hour < 18) return { text: 'Bon après-midi', icon: 'sun' };
  if (hour >= 18 && hour < 22) return { text: 'Bonsoir', icon: 'moon' };
  return { text: 'Bonne nuit', icon: 'moon' };
}

function BannerIllustration({ icon }: { icon: string }) {
  const c = 'rgba(255,255,255,0.22)';
  if (icon === 'moon') return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <defs>
        <mask id="moon-cut">
          <rect width="72" height="72" fill="white" />
          <circle cx="44" cy="28" r="17" fill="black" />
        </mask>
      </defs>
      <circle cx="32" cy="36" r="20" fill="rgba(255,255,255,0.5)" mask="url(#moon-cut)" />
    </svg>
  );
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <circle cx="36" cy="36" r="10" fill={c} />
      <line x1="36" y1="8" x2="36" y2="20" stroke={c} strokeWidth="3" strokeLinecap="round" />
      <line x1="36" y1="52" x2="36" y2="64" stroke={c} strokeWidth="3" strokeLinecap="round" />
      <line x1="8" y1="36" x2="20" y2="36" stroke={c} strokeWidth="3" strokeLinecap="round" />
      <line x1="52" y1="36" x2="64" y2="36" stroke={c} strokeWidth="3" strokeLinecap="round" />
      <line x1="15" y1="15" x2="23" y2="23" stroke={c} strokeWidth="3" strokeLinecap="round" />
      <line x1="49" y1="49" x2="57" y2="57" stroke={c} strokeWidth="3" strokeLinecap="round" />
      <line x1="57" y1="15" x2="49" y2="23" stroke={c} strokeWidth="3" strokeLinecap="round" />
      <line x1="23" y1="49" x2="15" y2="57" stroke={c} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const importRef = useRef<HTMLInputElement>(null);
  const [importAccountId, setImportAccountId] = useState('');
  const [importModal, setImportModal] = useState(false);
  const [installments, setInstallments] = useState<InstallmentPlan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const accs = Storage.getAccounts();
    setAccounts(accs);
    setInstallments(Storage.getInstallments().filter(i => i.active));
    setTransactions(Storage.getTransactions());
    if (accs.length > 0) { setImportAccountId(accs[0].id); setBalanceAccountId(accs[0].id); }
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importAccountId) return;
    e.target.value = '';
    try {
      const result = await importCSV(file, importAccountId, accounts);
      setTransactions(result.transactions);
      setAccounts(result.accounts);
      setImportModal(false);
      await dialog.alert(`✅ ${result.newCount} nouvelle(s) transaction(s) importée(s)\nSolde mis à jour !`);
    } catch {
      await dialog.alert('Erreur lors de l\'import. Vérifiez que le fichier est un CSV Caisse d\'Épargne valide.');
    }
  };

  const [balanceModal, setBalanceModal] = useState(false);
  const [balanceAccountId, setBalanceAccountId] = useState('');
  const [balanceInput, setBalanceInput] = useState('');

  const saveBalance = async () => {
    const val = parseFloat(balanceInput.replace(',', '.'));
    if (isNaN(val)) { await dialog.alert('Montant invalide'); return; }
    const updatedAccounts = accounts.map(a => a.id === balanceAccountId ? { ...a, balance: val, lastUpdated: new Date().toISOString() } : a);
    Storage.saveAccounts(updatedAccounts);
    setAccounts(updatedAccounts);
    setBalanceModal(false);
    setBalanceInput('');
  };

  const totalBalance = accounts.filter(a => a.type !== 'pro').reduce((s, a) => s + a.balance, 0);
  const animatedTotal = useCountUp(totalBalance);
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const upcoming = installments.filter(i => dayjs(i.nextDueDate).diff(dayjs(), 'day') <= 30).sort((a, b) => dayjs(a.nextDueDate).diff(dayjs(b.nextDueDate)));

  const searchResults = search.trim().length > 0
    ? transactions.filter(t => t.label.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase())).slice(0, 20)
    : [];

  return (
    <div style={{ background: '#F2F4F7', minHeight: '100%', overflowX: 'hidden', width: '100%' }}>

      {/* Search bar */}
      <div style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #EAECF0' }}>
        <div style={{ background: '#F2F4F7', borderRadius: 20, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#6B7A8D', fontSize: 14 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une transaction"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#1A1A2E', fontSize: 16, caretColor: '#C9A040' }}
          />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#6B7A8D', fontSize: 16, cursor: 'pointer', padding: 0 }}>✕</button>}
        </div>
      </div>

      {/* Résultats de recherche */}
      {searchResults.length > 0 && (
        <div style={{ background: '#fff', borderBottom: '1px solid #EAECF0' }}>
          {searchResults.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #F5F5F5' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#263238' }}>{t.label}</p>
                <p style={{ fontSize: 11, color: '#6B7A8D' }}>{dayjs(t.date).format('DD/MM/YYYY')} · {t.category}</p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: t.amount < 0 ? '#EF5350' : '#43A047' }}>
                {t.amount > 0 ? '+' : ''}{fmt(t.amount)} €
              </p>
            </div>
          ))}
        </div>
      )}
      {search.trim().length > 0 && searchResults.length === 0 && (
        <div style={{ padding: 16, textAlign: 'center', color: '#6B7A8D', fontSize: 13 }}>Aucun résultat</div>
      )}

      {/* Solde actuel */}
      {(() => {
        const greeting = getGreeting(now.getHours());
        const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return (
          <div style={{ background: 'linear-gradient(135deg, #D4A840 0%, #C9A040 50%, #B8902E 100%)', padding: '18px 20px 22px', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 16 }}>{greeting.text} Alicia</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Solde personnel</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{fmt(animatedTotal)} €</p>
            </div>
            <BannerIllustration icon={greeting.icon} />
          </div>
        );
      })()}

      {/* Comptes */}
      {accounts.length === 0 ? (
        <div style={{ background: '#fff', margin: '12px 16px', borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <p style={{ color: '#6B7A8D', fontSize: 14, marginBottom: 14 }}>Aucun compte configuré</p>
          <button className="btn-primary" onClick={() => onNavigate('accounts')}>Configurer mes comptes</button>
        </div>
      ) : (
        <div style={{ background: '#fff', marginTop: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7A8D', letterSpacing: 1, padding: '14px 16px 8px', textTransform: 'uppercase' }}>
            Mes comptes · màj {accounts.length > 0 ? dayjs(accounts[0].lastUpdated).format('DD/MM') : dayjs().format('DD/MM')}
          </p>
          {accounts.map(acc => <AccRow key={acc.id} acc={acc} />)}
        </div>
      )}

      {/* Prochains prélèvements */}
      {upcoming.length > 0 && (
        <div style={{ background: '#fff', marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 8px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7A8D', letterSpacing: 1, textTransform: 'uppercase' }}>Prochains prélèvements</p>
            <button onClick={() => onNavigate('installments')} style={{ background: 'none', border: 'none', fontSize: 12, color: '#0D0D0D', fontWeight: 600, cursor: 'pointer' }}>Voir tout</button>
          </div>
          {upcoming.slice(0, 3).map(inst => {
            const days = dayjs(inst.nextDueDate).diff(dayjs(), 'day');
            const urgent = days <= 3;
            return (
              <div key={inst.id} style={{ padding: '12px 16px', borderTop: '1px solid #F2F4F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.label}</p>
                  <p style={{ fontSize: 12, color: urgent ? '#EF5350' : '#6B7A8D', marginTop: 2, fontWeight: urgent ? 700 : 400 }}>
                    {days === 0 ? "Aujourd'hui" : days === 1 ? 'Demain' : `Dans ${days} jours`}
                  </p>
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#EF5350', flexShrink: 0 }}>-{fmt(inst.monthlyAmount)} € ›</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Dernières transactions */}
      {recent.length > 0 && (
        <div style={{ background: '#fff', marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 8px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7A8D', letterSpacing: 1, textTransform: 'uppercase' }}>Dernières opérations</p>
            <button onClick={() => onNavigate('transactions')} style={{ background: 'none', border: 'none', fontSize: 12, color: '#0D0D0D', fontWeight: 600, cursor: 'pointer' }}>Voir tout</button>
          </div>
          {recent.map(t => (
            <div key={t.id} style={{ padding: '12px 16px', borderTop: '1px solid #F2F4F7', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: (CAT_COLORS[t.category] || '#8A9298') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {(() => { const Icon = CAT_ICONS[t.category]; return Icon ? <Icon size={18} color={CAT_COLORS[t.category] || '#8A9298'} /> : <span style={{ fontSize: 16 }}>{[...t.category][0]}</span>; })()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</p>
                <p style={{ fontSize: 12, color: '#6B7A8D', marginTop: 1 }}>{dayjs(t.date).format('DD/MM/YYYY')}</p>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: t.amount < 0 ? '#EF5350' : '#43A047', flexShrink: 0 }}>
                {t.amount > 0 ? '+' : ''}{fmt(t.amount)} €
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Actions rapides */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '24px 16px 32px' }}>
        <button onClick={() => accounts.length === 1 ? importRef.current?.click() : setImportModal(true)} className="chip">Importer CSV</button>
        <button onClick={() => { setBalanceInput(''); setBalanceModal(true); }} className="chip">Modifier solde</button>
        <input ref={importRef} type="file" accept=".csv,.txt,text/csv" onChange={handleImport} style={{ display: 'none' }} />
      </div>

      <div style={{ height: 80 }} />

      {balanceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
          onClick={e => e.target === e.currentTarget && setBalanceModal(false)}>
          <div style={{ background: '#F0F4F8', borderRadius: 20, width: '100%', padding: 20 }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#C9A040', marginBottom: 12 }}>✏️ Modifier le solde</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {accounts.map(a => (
                <button key={a.id} onClick={() => setBalanceAccountId(a.id)}
                  style={{ flex: 1, border: `1.5px solid ${balanceAccountId === a.id ? '#C9A040' : '#CFD8DC'}`, borderRadius: 10, padding: '8px 4px', background: balanceAccountId === a.id ? '#F5EDD6' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: balanceAccountId === a.id ? 700 : 400, color: balanceAccountId === a.id ? '#C9A040' : '#546E7A', textAlign: 'center' }}>
                  {a.name}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#546E7A', marginBottom: 6 }}>Nouveau solde (€)</p>
            <input placeholder="Ex : 1 234,56" value={balanceInput}
              onChange={e => setBalanceInput(e.target.value)} inputMode="decimal"
              style={{ width: '100%', border: '1.5px solid #CFD8DC', borderRadius: 12, padding: '10px 14px', fontSize: 16, outline: 'none', background: '#fff', color: '#1A1A2E', boxSizing: 'border-box', marginBottom: 14 }} />
            <button className="btn-primary" onClick={saveBalance} style={{ marginBottom: 8 }}>Enregistrer</button>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setBalanceModal(false)}>Annuler</button>
          </div>
        </div>
      )}

      {importModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setImportModal(false)}>
          <div className="modal">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconDownload size={20} color="#C9A040" /> Importer CSV</h2>
            <div className="spacer" />
            <label className="field-label">Pour quel compte ?</label>
            {accounts.map(a => (
              <button key={a.id} onClick={() => setImportAccountId(a.id)}
                style={{ width: '100%', border: `1.5px solid ${importAccountId === a.id ? '#C9A040' : '#CFD8DC'}`, borderRadius: 10, padding: 12, marginBottom: 8, background: importAccountId === a.id ? '#F5EDD6' : '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: importAccountId === a.id ? 700 : 400, color: importAccountId === a.id ? '#C9A040' : '#546E7A' }}>
                {a.name}
              </button>
            ))}
            <div className="spacer" />
            <input type="file" accept=".csv,.txt,text/csv" onChange={handleImport}
              style={{ width: '100%', padding: '14px', background: '#0D0D0D', color: '#fff', borderRadius: 12, fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer' }} />
            <div style={{ height: 10 }} />
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setImportModal(false)}>Annuler</button>
            <div className="spacer" />
          </div>
        </div>
      )}
    </div>
  );
}
