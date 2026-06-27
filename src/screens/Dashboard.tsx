import { useState, useEffect } from 'react';
import { Storage } from '../storage';
import type { Account, InstallmentPlan, Transaction } from '../types';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
dayjs.locale('fr');

export default function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [installments, setInstallments] = useState<InstallmentPlan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    setAccounts(Storage.getAccounts());
    setInstallments(Storage.getInstallments().filter(i => i.active));
    setTransactions(Storage.getTransactions());
  }, []);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const thisMonth = dayjs().format('YYYY-MM');
  const monthTxs = transactions.filter(t => t.date.startsWith(thisMonth));
  const depenses = monthTxs.filter(t => t.amount < 0 && !t.category.includes('Virement') && !t.category.includes('Retrait')).reduce((s, t) => s + Math.abs(t.amount), 0);
  const entrees = monthTxs.filter(t => t.amount > 0 && !t.category.includes('Virement')).reduce((s, t) => s + t.amount, 0);
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const upcoming = installments.filter(i => dayjs(i.nextDueDate).diff(dayjs(), 'day') <= 30).sort((a, b) => dayjs(a.nextDueDate).diff(dayjs(b.nextDueDate)));

  const fmt = (n: number) => n.toFixed(2).replace('.', ',');

  return (
    <div style={{ background: '#F2F4F7', minHeight: '100%', overflowX: 'hidden', width: '100%' }}>

      {/* Top bar */}
      <div style={{ background: '#4A90D9', paddingTop: 'env(safe-area-inset-top)', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', paddingTop: 'calc(12px + env(safe-area-inset-top))' }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>🔍</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Rechercher une transaction</span>
        </div>
        <button onClick={() => onNavigate('accounts')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>🔔</button>
      </div>

      {/* Solde total centré */}
      <div style={{ background: '#fff', paddingBottom: 20, paddingTop: 24, textAlign: 'center', borderBottom: '1px solid #EAECF0' }}>
        <p style={{ fontSize: 38, fontWeight: 300, color: '#1A1A2E', letterSpacing: -1, lineHeight: 1 }}>
          {fmt(totalBalance)} €
        </p>
        <p style={{ fontSize: 11, color: '#9AA5B4', marginTop: 6, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>Solde total</p>

        {/* Dépenses / Entrées mois */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#EF5350' }}>-{fmt(depenses)} €</p>
            <p style={{ fontSize: 10, color: '#9AA5B4', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Dépenses</p>
          </div>
          <div style={{ width: 1, background: '#EAECF0' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#43A047' }}>+{fmt(entrees)} €</p>
            <p style={{ fontSize: 10, color: '#9AA5B4', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Entrées</p>
          </div>
        </div>
      </div>

      {/* Comptes */}
      {accounts.length === 0 ? (
        <div style={{ background: '#fff', margin: '12px 16px', borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <p style={{ color: '#9AA5B4', fontSize: 14, marginBottom: 14 }}>Aucun compte configuré</p>
          <button className="btn-primary" onClick={() => onNavigate('accounts')}>Configurer mes comptes</button>
        </div>
      ) : (
        <div style={{ background: '#fff', marginTop: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9AA5B4', letterSpacing: 1, padding: '14px 16px 8px', textTransform: 'uppercase' }}>
            Caisse d'Épargne · màj {dayjs().format('DD/MM')}
          </p>
          {accounts.map((acc, i) => (
            <div key={acc.id} style={{ padding: '14px 16px', borderTop: i === 0 ? '1px solid #F2F4F7' : '1px solid #F2F4F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 500, color: '#1A1A2E' }}>{acc.name}</p>
                <p style={{ fontSize: 12, color: '#9AA5B4', marginTop: 2 }}>
                  {acc.type === 'perso' ? 'Compte personnel' : 'Compte professionnel'}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: acc.balance < 0 ? '#EF5350' : '#43A047' }}>
                  {fmt(acc.balance)} € ›
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Prochains prélèvements */}
      {upcoming.length > 0 && (
        <div style={{ background: '#fff', marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 8px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9AA5B4', letterSpacing: 1, textTransform: 'uppercase' }}>Prochains prélèvements</p>
            <button onClick={() => onNavigate('installments')} style={{ background: 'none', border: 'none', fontSize: 12, color: '#4A90D9', fontWeight: 600, cursor: 'pointer' }}>Voir tout</button>
          </div>
          {upcoming.slice(0, 3).map((inst, i) => {
            const days = dayjs(inst.nextDueDate).diff(dayjs(), 'day');
            const urgent = days <= 3;
            return (
              <div key={inst.id} style={{ padding: '12px 16px', borderTop: '1px solid #F2F4F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.label}</p>
                  <p style={{ fontSize: 12, color: urgent ? '#EF5350' : '#9AA5B4', marginTop: 2, fontWeight: urgent ? 700 : 400 }}>
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
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9AA5B4', letterSpacing: 1, textTransform: 'uppercase' }}>Dernières opérations</p>
            <button onClick={() => onNavigate('transactions')} style={{ background: 'none', border: 'none', fontSize: 12, color: '#4A90D9', fontWeight: 600, cursor: 'pointer' }}>Voir tout</button>
          </div>
          {recent.map(t => (
            <div key={t.id} style={{ padding: '12px 16px', borderTop: '1px solid #F2F4F7', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: '#F2F4F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                {t.category.split(' ')[0] || '📦'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</p>
                <p style={{ fontSize: 12, color: '#9AA5B4', marginTop: 1 }}>{dayjs(t.date).format('DD/MM/YYYY')}</p>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: t.amount < 0 ? '#EF5350' : '#43A047', flexShrink: 0 }}>
                {t.amount > 0 ? '+' : ''}{fmt(t.amount)} €
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Actions rapides */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', marginTop: 12 }}>
        {[
          { icon: '📥', label: 'Importer CSV', tab: 'transactions' },
          { icon: '🔄', label: 'Mensualités', tab: 'installments' },
          { icon: '📈', label: 'Projection', tab: 'projection' },
        ].map(a => (
          <button key={a.tab} onClick={() => onNavigate(a.tab)}
            style={{ flex: 1, background: '#fff', border: 'none', borderRadius: 12, padding: '12px 6px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 22 }}>{a.icon}</div>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#4A90D9', marginTop: 5 }}>{a.label}</p>
          </button>
        ))}
      </div>

      <div style={{ height: 80 }} />
    </div>
  );
}
