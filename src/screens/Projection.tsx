import { useState, useEffect } from 'react';
import { Storage } from '../storage';
import type { Account, InstallmentPlan, Transaction } from '../types';
import dayjs from 'dayjs';

const EXCLUDED_KEY = 'bt_projection_excluded';
function loadExcluded(): string[] {
  try { return JSON.parse(localStorage.getItem(EXCLUDED_KEY) || '[]'); } catch { return []; }
}
function saveExcluded(list: string[]) {
  localStorage.setItem(EXCLUDED_KEY, JSON.stringify(list));
}

const OVERRIDES_KEY = 'bt_projection_overrides';
function loadOverrides(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}'); } catch { return {}; }
}
function saveOverrides(o: Record<string, number>) {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o));
}

interface RecurringItem { label: string; amount: number; dayOfMonth: number; }
interface ProjectionDay { date: string; balance: number; events: { label: string; amount: number }[]; }

function buildRecurring(txs: Transaction[], account: Account): { debits: RecurringItem[]; credits: RecurringItem[] } {
  const today = dayjs();
  const threeMonthsAgo = today.subtract(3, 'month').format('YYYY-MM-DD');
  const RECURRING_CATS = ['Assurance', 'Frais bancaires', 'Impôts', 'Crédit', 'Logement', 'Loisirs', 'Abonnements', 'Sport', 'Éducation', 'Bien-être', 'Enfants', 'Animaux'];

  const group = (list: Transaction[]) => {
    const groups: Record<string, Transaction[]> = {};
    for (const t of list) {
      const key = `${Math.round(t.amount)}_${t.label.substring(0, 15)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return Object.values(groups).map(g => ({
      label: g[0].label, amount: g[0].amount,
      dayOfMonth: Math.round(g.reduce((s, t) => s + dayjs(t.date).date(), 0) / g.length),
    }));
  };

  const debits = group(txs.filter(t =>
    t.accountId === account.id && t.amount < 0 && t.date >= threeMonthsAgo &&
    RECURRING_CATS.some(cat => t.category.includes(cat))
  ));
  const credits = group(txs.filter(t =>
    t.accountId === account.id && t.amount > 0 && t.date >= threeMonthsAgo &&
    t.category.includes('Revenus')
  ));
  return { debits, credits };
}

function computeProjection(account: Account, plans: InstallmentPlan[], txs: Transaction[], days: number, excluded: string[], overrides: Record<string, number>): ProjectionDay[] {
  const result: ProjectionDay[] = [];
  let balance = account.balance;
  const today = dayjs();
  const { debits, credits } = buildRecurring(txs, account);
  const allRecurring = [...debits, ...credits]
    .filter(r => !excluded.includes(r.label))
    .map(r => ({ ...r, dayOfMonth: overrides[r.label] ?? r.dayOfMonth }));

  for (let i = 1; i <= days; i++) {
    const date = today.add(i, 'day');
    const dayOfMonth = date.date();
    const events: { label: string; amount: number }[] = [];

    for (const plan of plans) {
      if (!plan.active) continue;
      if (dayOfMonth === dayjs(plan.nextDueDate).date()) {
        events.push({ label: plan.label, amount: -plan.monthlyAmount });
      }
    }
    for (const rec of allRecurring) {
      if (dayOfMonth === rec.dayOfMonth) events.push({ label: rec.label, amount: rec.amount });
    }

    for (const e of events) balance += e.amount;
    result.push({ date: date.format('YYYY-MM-DD'), balance: Math.round(balance * 100) / 100, events });
  }
  return result;
}

export default function Projection() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [days, setDays] = useState(30);
  const [projection, setProjection] = useState<ProjectionDay[]>([]);
  const [excluded, setExcluded] = useState<string[]>(loadExcluded);
  const [allRecurring, setAllRecurring] = useState<RecurringItem[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, number>>(loadOverrides);

  useEffect(() => {
    const accs = Storage.getAccounts();
    setAccounts(accs);
    if (accs.length > 0) setSelectedId(accs[0].id);
  }, []);

  useEffect(() => {
    const acc = accounts.find(a => a.id === selectedId);
    if (!acc) return;
    const txs = Storage.getTransactions();
    const { debits, credits } = buildRecurring(txs, acc);
    setAllRecurring([...debits, ...credits]);
    setProjection(computeProjection(acc, Storage.getInstallments(), txs, days, excluded, overrides));
  }, [selectedId, days, accounts, excluded, overrides]);

  const toggleExclude = (label: string) => {
    const next = excluded.includes(label) ? excluded.filter(l => l !== label) : [...excluded, label];
    saveExcluded(next);
    setExcluded(next);
  };

  const setDayOverride = (label: string, day: number) => {
    const next = { ...overrides, [label]: day };
    saveOverrides(next);
    setOverrides(next);
  };

  const account = accounts.find(a => a.id === selectedId);
  const overdrafts = projection.filter(d => d.balance < 0);
  const minBalance = projection.reduce((m, d) => Math.min(m, d.balance), Infinity);
  const daysWithEvents = projection.filter(d => d.events.length > 0 || d.balance < 0);

  return (
    <div>
      <div className="header">
        <div className="header-row">
          <h1>Projection</h1>
          <button onClick={() => setShowManage(true)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Gérer
          </button>
        </div>
      </div>

      <div className="chips">
        {accounts.map(a => (
          <button key={a.id} className={`chip ${selectedId === a.id ? 'active' : ''}`} onClick={() => setSelectedId(a.id)}>{a.name}</button>
        ))}
      </div>
      <div className="chips">
        {[7, 15, 30].map(d => (
          <button key={d} className={`chip ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>{d} jours</button>
        ))}
      </div>

      {account && (
        <div style={{ display: 'flex', gap: 10, padding: '10px 16px 0' }}>
          <div style={{ flex: 1, background: '#E8EAF6', borderRadius: 14, padding: 14 }}>
            <p style={{ fontSize: 12, color: '#546E7A' }}>Solde actuel</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: account.balance < 0 ? '#EF5350' : '#1A237E' }}>{account.balance.toFixed(2).replace('.', ',')} €</p>
          </div>
          <div style={{ flex: 1, background: minBalance < 0 ? '#FFEBEE' : '#E8F5E9', borderRadius: 14, padding: 14 }}>
            <p style={{ fontSize: 12, color: '#546E7A' }}>Solde minimum</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: minBalance < 0 ? '#EF5350' : '#2E7D32' }}>
              {minBalance === Infinity ? '—' : `${minBalance.toFixed(2).replace('.', ',')} €`}
            </p>
          </div>
        </div>
      )}

      {overdrafts.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid #FF9800', background: '#FFF3E0' }}>
          <p style={{ fontWeight: 700, color: '#E65100', marginBottom: 6 }}>⚠️ Risque de découvert</p>
          <p style={{ fontSize: 13, color: '#BF360C' }}>{overdrafts.length} jour(s) en négatif dans les {days} prochains jours.</p>
          <p style={{ fontSize: 13, color: '#BF360C' }}>Premier découvert le : <strong>{dayjs(overdrafts[0].date).format('DD/MM/YYYY')}</strong></p>
        </div>
      )}

      <p className="section-title">Détail des prélèvements</p>

      {daysWithEvents.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📈</div>
          <h3>Aucun prélèvement détecté</h3>
          <p>Importe tes transactions et ajoute tes mensualités pour voir la projection</p>
        </div>
      ) : daysWithEvents.map(day => (
        <div key={day.date} className="card" style={{ borderLeft: day.balance < 0 ? '4px solid #EF5350' : '4px solid #E0E0E0', background: day.balance < 0 ? '#FFF8F8' : '#fff' }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <p style={{ fontWeight: 700, color: '#455A64' }}>{dayjs(day.date).format('ddd DD/MM')}</p>
            <p style={{ fontWeight: 700, color: day.balance < 0 ? '#EF5350' : '#43A047' }}>{day.balance.toFixed(2).replace('.', ',')} €</p>
          </div>
          {day.events.map((e, i) => (
            <div key={i} className="row">
              <p style={{ fontSize: 13, color: '#546E7A' }}>{e.label}</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: e.amount < 0 ? '#EF5350' : '#43A047' }}>
                {e.amount > 0 ? '+' : ''}{e.amount.toFixed(2).replace('.', ',')} €
              </p>
            </div>
          ))}
        </div>
      ))}

      <div className="spacer-lg" />

      {/* Modal gérer */}
      {showManage && (
        <div className="modal-overlay" onClick={() => setShowManage(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="row" style={{ marginBottom: 16 }}>
              <h2>Gérer la projection</h2>
              <button onClick={() => setShowManage(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#90A4AE' }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: '#90A4AE', marginBottom: 14 }}>Coche pour exclure un élément de la projection.</p>
            {allRecurring.length === 0 && <p style={{ fontSize: 14, color: '#90A4AE' }}>Aucun élément détecté.</p>}
            {allRecurring.map(r => {
              const currentDay = overrides[r.label] ?? r.dayOfMonth;
              return (
                <div key={r.label} style={{ padding: '12px 0', borderBottom: '1px solid #F0F0F0' }}>
                  <div className="row" style={{ marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#263238', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</p>
                      <p style={{ fontSize: 12, color: r.amount > 0 ? '#43A047' : '#EF5350', marginTop: 2 }}>
                        {r.amount > 0 ? '+' : ''}{r.amount.toFixed(2).replace('.', ',')} €
                      </p>
                    </div>
                    <button
                      onClick={() => toggleExclude(r.label)}
                      style={{
                        background: excluded.includes(r.label) ? '#FFEBEE' : '#E8F5E9',
                        color: excluded.includes(r.label) ? '#EF5350' : '#43A047',
                        border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0, marginLeft: 8
                      }}
                    >
                      {excluded.includes(r.label) ? 'Exclue' : 'Incluse'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ fontSize: 12, color: '#90A4AE' }}>Jour du mois :</p>
                    <input
                      type="number" min={1} max={31} value={currentDay}
                      onChange={e => setDayOverride(r.label, Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                      style={{ width: 44, border: '1px solid #CFD8DC', borderRadius: 6, padding: '3px 6px', fontSize: 13, fontWeight: 600, color: '#1A237E', textAlign: 'center', background: '#F0F4F8', outline: 'none' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
