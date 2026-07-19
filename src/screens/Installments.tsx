import { fmt } from '../utils';
import { useState, useEffect } from 'react';
import { Storage } from '../storage';
import { dialog } from '../dialog';
import { detectRecurring, type RecurringItem } from '../utils/recurring';
import type { InstallmentPlan, Account } from '../types';
import dayjs from 'dayjs';

const emptyForm = { label: '', monthlyAmount: '', totalMonths: '', startDate: dayjs().format('DD/MM/YYYY'), totalAmount: '', accountId: '' };

export default function Installments() {
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [hiddenRecurring, setHiddenRecurring] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('bt_hidden_recurring') || '[]'); } catch { return []; }
  });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const accs = Storage.getAccounts();
    const txs = Storage.getTransactions();
    const hidden: string[] = JSON.parse(localStorage.getItem('bt_hidden_recurring') || '[]');
    setAccounts(accs);
    setPlans(Storage.getInstallments());
    const { debits } = detectRecurring(txs, accs.map(a => a.id));
    setRecurring(debits.filter(r => !hidden.includes(r.label)));
    if (accs.length > 0) setForm(f => ({ ...f, accountId: accs[0].id }));
  }, []);

  const save = async () => {
    if (!form.label || !form.monthlyAmount || !form.totalMonths || !form.accountId) { await dialog.alert('Veuillez remplir tous les champs obligatoires'); return; }
    const start = dayjs(form.startDate, 'DD/MM/YYYY', true);
    if (!start.isValid()) { await dialog.alert('Date invalide (format : JJ/MM/AAAA)'); return; }
    const monthly = parseFloat(form.monthlyAmount.replace(',', '.'));
    const months = parseInt(form.totalMonths);
    const plan: InstallmentPlan = {
      id: Date.now().toString(),
      accountId: form.accountId,
      label: form.label,
      totalAmount: parseFloat(form.totalAmount.replace(',', '.')) || monthly * months,
      monthlyAmount: monthly,
      startDate: start.format('YYYY-MM-DD'),
      totalMonths: months,
      paidMonths: 0,
      nextDueDate: start.format('YYYY-MM-DD'),
      active: true,
    };
    const updated = [...plans, plan];
    Storage.saveInstallments(updated);
    setPlans(updated);
    setModal(false);
    setForm({ ...emptyForm, accountId: accounts[0]?.id || '' });
  };

  const markPaid = (id: string) => {
    const updated = plans.map(p => {
      if (p.id !== id) return p;
      const newPaid = p.paidMonths + 1;
      return { ...p, paidMonths: newPaid, nextDueDate: dayjs(p.nextDueDate).add(1, 'month').format('YYYY-MM-DD'), active: newPaid < p.totalMonths };
    });
    Storage.saveInstallments(updated);
    setPlans(updated);
  };

  const del = async (id: string) => {
    if (!await dialog.confirm('Supprimer cette mensualité ?')) return;
    const updated = plans.filter(p => p.id !== id);
    Storage.saveInstallments(updated);
    setPlans(updated);
  };

  const active = plans.filter(p => p.active);
  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || '';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px', paddingTop: '8px' }}>
        <button className="btn-sm" onClick={() => setModal(true)}>+ Ajouter</button>
      </div>

      {recurring.length > 0 && (
        <div style={{ margin: '0 0 4px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9AA5B4', letterSpacing: 1, textTransform: 'uppercase', padding: '8px 16px 4px' }}>Prélèvements récurrents détectés</p>
          {recurring.map(r => (
            <div className="card" key={r.label} style={{ margin: '0 12px 8px' }}>
              <div className="row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 15, color: '#263238' }}>{r.label}</p>
                  <p style={{ fontSize: 12, color: '#90A4AE', marginTop: 2 }}>Chaque mois vers le {r.dayOfMonth}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#B71C1C' }}>{fmt(Math.abs(r.amount))} €</p>
                  <button onClick={async () => {
                    if (!await dialog.confirm('Supprimer ce prélèvement récurrent ?')) return;
                    const updated = [...hiddenRecurring, r.label];
                    localStorage.setItem('bt_hidden_recurring', JSON.stringify(updated));
                    setHiddenRecurring(updated);
                    setRecurring(prev => prev.filter(x => x.label !== r.label));
                  }} style={{ background: 'none', border: 'none', fontSize: 16, color: '#B71C1C', cursor: 'pointer', padding: '2px 4px' }}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {active.length === 0 && recurring.length === 0 && (
        <div className="empty-state">
          <div className="icon">🔄</div>
          <h3>Aucune mensualité</h3>
          <p>Ajoutez vos achats en plusieurs fois pour les suivre et recevoir des rappels</p>
        </div>
      )}

      {active.map(p => {
        const progress = p.paidMonths / p.totalMonths;
        const remaining = (p.totalMonths - p.paidMonths) * p.monthlyAmount;
        const days = dayjs(p.nextDueDate).diff(dayjs(), 'day');
        return (
          <div className="card" key={p.id}>
            <div className="row" style={{ marginBottom: 4 }}>
              <p style={{ fontWeight: 700, fontSize: 16, color: '#C9A040', flex: 1 }}>{p.label}</p>
              <button onClick={() => del(p.id)} style={{ background: '#FFEBEE', border: 'none', borderRadius: 8, fontSize: 16, color: '#EF5350', cursor: 'pointer', padding: '4px 8px' }}>🗑</button>
            </div>
            <p style={{ fontSize: 12, color: '#90A4AE', marginBottom: 10 }}>{getAccountName(p.accountId)}</p>

            <div style={{ height: 6, background: '#E0E0E0', borderRadius: 3, marginBottom: 4 }}>
              <div style={{ height: 6, background: '#C9A040', borderRadius: 3, width: `${progress * 100}%` }} />
            </div>
            <p style={{ fontSize: 12, color: '#90A4AE', marginBottom: 12 }}>{p.paidMonths}/{p.totalMonths} mensualités payées</p>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              {[
                { label: 'Mensualité', value: `${fmt(p.monthlyAmount)} €` },
                { label: 'Reste', value: `${fmt(remaining)} €` },
                { label: 'Prochain', value: days <= 0 ? "Auj." : `J-${days}`, urgent: days <= 3 },
              ].map(item => (
                <div key={item.label}>
                  <p style={{ fontSize: 11, color: '#90A4AE', marginBottom: 2 }}>{item.label}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: item.urgent ? '#EF5350' : '#263238' }}>{item.value}</p>
                </div>
              ))}
            </div>

            <button onClick={() => markPaid(p.id)}
              style={{ width: '100%', background: '#E8F5E9', border: 'none', borderRadius: 10, padding: 10, color: '#2E7D32', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              ✓ Mensualité payée
            </button>
          </div>
        );
      })}

      {(active.length > 0 || recurring.length > 0) && (
        <div className="card" style={{ margin: '0 12px 8px', background: '#0D0D0D' }}>
          <div className="row">
            <p style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Total mensuel</p>
            <p style={{ fontWeight: 800, fontSize: 16, color: '#C9A040' }}>
              {fmt(
                active.reduce((s, p) => s + p.monthlyAmount, 0) +
                recurring.reduce((s, r) => s + Math.abs(r.amount), 0)
              )} €
            </p>
          </div>
        </div>
      )}

      <div className="spacer-lg" />

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2>Nouvel achat en plusieurs fois</h2>
            <div className="spacer" />

            <label className="field-label">Nom de l'achat *</label>
            <input className="input" placeholder="Ex: iPhone, Canapé..." value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />

            <label className="field-label">Mensualité * (€)</label>
            <input className="input" placeholder="Ex: 45,99" value={form.monthlyAmount} onChange={e => setForm(f => ({ ...f, monthlyAmount: e.target.value }))} inputMode="decimal" />

            <label className="field-label">Nombre de mensualités *</label>
            <input className="input" placeholder="Ex: 12" value={form.totalMonths} onChange={e => setForm(f => ({ ...f, totalMonths: e.target.value }))} inputMode="numeric" />

            <label className="field-label">Date du 1er prélèvement * (JJ/MM/AAAA)</label>
            <input className="input" placeholder="Ex: 05/07/2025" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />

            <label className="field-label">Compte *</label>
            {accounts.map(a => (
              <button key={a.id} onClick={() => setForm(f => ({ ...f, accountId: a.id }))}
                style={{ width: '100%', border: `1.5px solid ${form.accountId === a.id ? '#C9A040' : '#CFD8DC'}`, borderRadius: 10, padding: 12, marginBottom: 8, background: form.accountId === a.id ? '#F5EDD6' : '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: form.accountId === a.id ? 700 : 400, color: form.accountId === a.id ? '#C9A040' : '#546E7A' }}>
                {a.name}
              </button>
            ))}

            <div className="spacer" />
            <button className="btn-primary" onClick={save}>Enregistrer</button>
            <div style={{ height: 10 }} />
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setModal(false)}>Annuler</button>
            <div className="spacer" />
          </div>
        </div>
      )}
    </div>
  );
}
