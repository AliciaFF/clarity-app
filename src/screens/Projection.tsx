import { fmt } from '../utils';
import { useState, useEffect } from 'react';
import { Storage } from '../storage';
import { detectRecurring, type RecurringItem } from '../utils/recurring';
import type { Account, InstallmentPlan, Transaction } from '../types';
import dayjs from 'dayjs';
import { IconSettings } from '@tabler/icons-react';
import { useCountUp } from '../hooks/useCountUp';

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

interface ProjectionDay { date: string; balance: number; events: { label: string; amount: number }[]; }

function computeProjection(account: Account, plans: InstallmentPlan[], txs: Transaction[], days: number, excluded: string[], overrides: Record<string, number>): ProjectionDay[] {
  const result: ProjectionDay[] = [];
  let balance = account.balance;
  const today = dayjs();
  const { debits, credits } = detectRecurring(txs, [account.id]);
  const allRecurring = [...debits, ...credits]
    .filter(r => !excluded.includes(r.label))
    .map(r => ({ ...r, dayOfMonth: overrides[r.label] ?? r.dayOfMonth }));

  for (let i = 1; i <= days; i++) {
    const date = today.add(i, 'day');
    const dayOfMonth = date.date();
    const events: { label: string; amount: number }[] = [];

    const daysInMonth = date.daysInMonth();
    for (const plan of plans) {
      if (!plan.active) continue;
      const planDay = Math.min(dayjs(plan.nextDueDate).date(), daysInMonth);
      if (dayOfMonth === planDay) {
        events.push({ label: plan.label, amount: -plan.monthlyAmount });
      }
    }
    for (const rec of allRecurring) {
      const recDay = Math.min(rec.dayOfMonth, daysInMonth);
      if (dayOfMonth === recDay) events.push({ label: rec.label, amount: rec.amount });
    }

    for (const e of events) balance += e.amount;
    result.push({ date: date.format('YYYY-MM-DD'), balance: Math.round(balance * 100) / 100, events });
  }
  return result;
}

function AnimatedBalance({ value }: { value: number }) {
  const animated = useCountUp(value);
  return <p style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{fmt(animated)} €</p>;
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
    const { debits, credits } = detectRecurring(txs, [acc.id]);
    setAllRecurring([...debits, ...credits]);
    setProjection(computeProjection(acc, Storage.getInstallments(), txs, days, excluded, overrides));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const daysWithEvents = projection.filter(d => d.events.length > 0 || d.balance < 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px', paddingTop: '8px' }}>
        <button onClick={() => setShowManage(true)} style={{ background: 'none', border: 'none', padding: '4px', color: '#6B7A8D', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <IconSettings size={22} />
        </button>
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
          <div style={{ flex: 1, background: '#C9A040', borderRadius: 14, padding: 14, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#fff' }}>Solde actuel</p>
            <AnimatedBalance value={account.balance} />
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

      {daysWithEvents.map(day => (
        <div key={day.date} className="card" style={{ borderLeft: day.balance < 0 ? '4px solid #EF5350' : '4px solid #E0E0E0', background: day.balance < 0 ? '#FFF8F8' : '#fff' }}>
          <div className="row" style={{ marginBottom: day.events.length > 0 ? 10 : 0 }}>
            <p style={{ fontWeight: 700, color: '#455A64' }}>{dayjs(day.date).format('ddd DD/MM')}</p>
            <p style={{ fontWeight: 700, color: day.balance < 0 ? '#EF5350' : '#43A047' }}>{fmt(day.balance)} €</p>
          </div>
          {day.events.map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: i === 0 ? 0 : 6, borderTop: i === 0 ? 'none' : '1px solid #F0F0F0' }}>
              <p style={{ fontSize: 13, color: '#546E7A', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{e.label}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: e.amount < 0 ? '#EF5350' : '#43A047', flexShrink: 0 }}>
                {e.amount > 0 ? '+' : ''}{fmt(e.amount)} €
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
            <p style={{ fontSize: 13, color: '#90A4AE', marginBottom: 14 }}>Appuyez pour inclure ou exclure un élément de la projection, ou pour modifier le jour du mois.</p>
            {allRecurring.length === 0 && <p style={{ fontSize: 14, color: '#90A4AE' }}>Aucun élément détecté.</p>}
            {allRecurring.map(r => {
              const currentDay = overrides[r.label] ?? r.dayOfMonth;
              return (
                <div key={r.label} style={{ padding: '12px 0', borderBottom: '1px solid #F0F0F0' }}>
                  <div className="row" style={{ marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#263238', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</p>
                      <p style={{ fontSize: 12, color: r.amount > 0 ? '#43A047' : '#EF5350', marginTop: 2 }}>
                        {r.amount > 0 ? '+' : ''}{fmt(r.amount)} €
                      </p>
                    </div>
                    <button
                      onClick={() => toggleExclude(r.label)}
                      style={{
                        background: excluded.includes(r.label) ? '#FFEBEE' : '#2E7D32',
                        color: excluded.includes(r.label) ? '#EF5350' : '#fff',
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
                      style={{ width: 44, border: '1px solid #CFD8DC', borderRadius: 6, padding: '3px 6px', fontSize: 13, fontWeight: 600, color: '#C9A040', textAlign: 'center', background: '#F0F4F8', outline: 'none' }}
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
