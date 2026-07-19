import { fmt } from '../utils';
import { useState, useEffect } from 'react';
import { Storage } from '../storage';
import type { Transaction, Account } from '../types';
import { importCSV } from '../utils/importCSV';
import { dialog } from '../dialog';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
dayjs.locale('fr');

const DEFAULT_CATS: Record<string, string> = {
  '🥖 Courses': '#FF9800',
  '🍕 Restauration': '#FF5722',
  '🛒 Shopping': '#E91E63',
  '🚗 Transport': '#2196F3',
  '🏠 Logement': '#3F51B5',
  '💊 Santé': '#4CAF50',
  '🎮 Loisirs': '#9C27B0',
  '📋 Impôts': '#607D8B',
  '🔒 Assurance': '#795548',
  '👔 Vêtements': '#F06292',
  '💶 Revenus': '#43A047',
  '🔄 Virement': '#90A4AE',
  '🏧 Retrait': '#FFC107',
  '🏦 Frais bancaires': '#455A64',
  '🐶 Animaux': '#8BC34A',
  '📖 Éducation': '#00BCD4',
  '🧘 Bien-être': '#FF80AB',
  '⚽ Sport': '#00897B',
  '🎁 Cadeaux': '#AB47BC',
  '🧸 Enfants': '#FFB74D',
  '💳 Crédit': '#F44336',
  '📦 Autres': '#BDBDBD',
};
const EXTRA_COLORS = ['#E91E63','#9C27B0','#3F51B5','#2196F3','#009688','#4CAF50','#FF9800','#795548','#607D8B'];

function loadCatColors(): Record<string, string> {
  try { return { ...DEFAULT_CATS, ...JSON.parse(localStorage.getItem('bt_categories') || '{}') }; } catch { return { ...DEFAULT_CATS }; }
}
function saveCatColors(cats: Record<string, string>) {
  const custom: Record<string, string> = {};
  for (const k in cats) { if (!(k in DEFAULT_CATS)) custom[k] = cats[k]; }
  localStorage.setItem('bt_categories', JSON.stringify(custom));
}

// Migration: anciens noms sans emoji → nouveaux noms avec emoji
const CAT_MIGRATION: Record<string, string> = {
  'Courses': '🥖 Courses', 'Restauration': '🍕 Restauration', 'Shopping': '🛒 Shopping',
  'Transport': '🚗 Transport', 'Logement': '🏠 Logement', 'Santé': '💊 Santé',
  'Loisirs': '🎮 Loisirs', 'Impôts': '📋 Impôts', 'Assurance': '🔒 Assurance',
  'Vêtements': '👔 Vêtements', 'Revenus': '💶 Revenus', 'Virement': '🔄 Virement',
  'Retrait': '🏧 Retrait', 'Frais bancaires': '🏦 Frais bancaires', 'Animaux': '🐶 Animaux',
  'Éducation': '📖 Éducation', 'Bien-être': '🧘 Bien-être', 'Sport': '⚽ Sport',
  'Cadeaux': '🎁 Cadeaux', 'Enfants': '🧸 Enfants', 'Crédit': '💳 Crédit', 'Autres': '📦 Autres',
  // anciens noms avec emojis différents
  '🛒 Courses': '🥖 Courses', '🍽️ Restauration': '🍕 Restauration', '🛍️ Shopping': '🛒 Shopping',
  '🚗 Transport': '🚗 Transport', '🏠 Logement': '🏠 Logement', '🏥 Santé': '💊 Santé',
  '🎬 Loisirs': '🎮 Loisirs', '🏛️ Impôts': '📋 Impôts', '🛡️ Assurance': '🔒 Assurance',
  '👗 Vêtements': '👔 Vêtements', '💰 Revenus': '💶 Revenus', '🔄 Virement': '🔄 Virement',
  '💵 Retrait': '🏧 Retrait', '🏦 Frais bancaires': '🏦 Frais bancaires', '🐾 Animaux': '🐶 Animaux',
  '📚 Éducation': '📖 Éducation', '💆 Bien-être': '🧘 Bien-être', '🏋️ Sport': '⚽ Sport',
  '🎁 Cadeaux': '🎁 Cadeaux', '🍼 Enfants': '🧸 Enfants', '💳 Crédit': '💳 Crédit', '📦 Autres': '📦 Autres',
};

function migrateTxCategories() {
  const txs = Storage.getTransactions();
  const updated = txs.map(t => ({ ...t, category: CAT_MIGRATION[t.category] ?? t.category }));
  if (updated.some((t, i) => t.category !== txs[i].category)) Storage.saveTransactions(updated);
  return updated;
}

function getColor(cat: string, colors: Record<string, string>) { return colors[cat] || DEFAULT_CATS[cat] || '#BDBDBD'; }
function getCatLabel(cat: string) { return (cat.codePointAt(0) || 0) > 127 ? cat.replace(/^\S+\s*/, '').trim() || cat : cat; }
function getEmoji(cat: string) { return (cat.codePointAt(0) || 0) > 127 ? [...cat][0] : cat.substring(0, 2).toUpperCase(); }

function DonutChart({ data, total, tab }: { data: { label: string; value: number; color: string }[], total: number, tab: string }) {
  if (total === 0 || data.length === 0) return null;

  const cx = 195, cy = 128, RO = 75, RI = 50;
  const W = 400, H = 280;
  const ELBOW_R = RO + 22;
  const MIN_GAP = 15;
  const LEFT_X = 90, RIGHT_X = 310;

  function pt(r: number, a: number): [number, number] {
    return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  }

  let cum = 0;
  const segs = data.map(d => {
    const pct = d.value / total;
    const start = cum * 2 * Math.PI;
    const end = (cum + pct) * 2 * Math.PI;
    cum += pct;
    const mid = (start + end) / 2;
    const [ex, ey] = pt(ELBOW_R, mid);
    return { ...d, pct, start, end, mid, ex, ey, isRight: ex >= cx };
  });

  // Spread labels on each side to avoid overlap
  function spread(items: typeof segs, minY: number, maxY: number) {
    const sorted = [...items].sort((a, b) => a.ey - b.ey);
    const fy = sorted.map(s => s.ey);
    // Push down
    for (let i = 1; i < fy.length; i++) {
      if (fy[i] - fy[i-1] < MIN_GAP) fy[i] = fy[i-1] + MIN_GAP;
    }
    // Pull up if overflowed
    for (let i = fy.length - 2; i >= 0; i--) {
      if (fy[i+1] - fy[i] < MIN_GAP) fy[i] = fy[i+1] - MIN_GAP;
    }
    // Clamp to bounds
    const shift = Math.max(0, fy[0] - minY) - Math.max(0, fy[fy.length-1] - maxY);
    return sorted.map((s, i) => ({ ...s, fy: fy[i] - shift }));
  }

  const left  = spread(segs.filter(s => !s.isRight), 14, H - 10);
  const right = spread(segs.filter(s =>  s.isRight), 14, H - 10);
  const all   = [...left, ...right];

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Segments */}
      {segs.length === 1 ? (
        <>
          <circle cx={cx} cy={cy} r={RO} fill={segs[0].color} />
          <circle cx={cx} cy={cy} r={RI} fill="white" />
          {/* Label pour segment unique — placé en haut à droite */}
          <polyline points={`${cx + RO * 0.7},${cy - RO * 0.7} ${cx + RO + 18},${cy - RO - 10} ${RIGHT_X},${cy - RO - 10}`} fill="none" stroke={segs[0].color} strokeWidth="1.2" />
          <text x={RIGHT_X + 3} y={cy - RO - 6} textAnchor="start" fontSize="9" fontWeight="600" fill="#455A64">{getCatLabel(segs[0].label)}</text>
        </>
      ) : segs.map((s, i) => {
        const gap = 0.025;
        const [x1, y1] = pt(RO, s.start + gap);
        const [x2, y2] = pt(RO, s.end   - gap);
        const [x3, y3] = pt(RI, s.end   - gap);
        const [x4, y4] = pt(RI, s.start + gap);
        const large = (s.end - s.start) > Math.PI ? 1 : 0;
        return (
          <path key={i}
            d={`M${x1} ${y1} A${RO} ${RO} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${RI} ${RI} 0 ${large} 0 ${x4} ${y4}Z`}
            fill={s.color}
          />
        );
      })}

      {/* Total au centre */}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="13" fontWeight="800" fill="#263238">{fmt(total)} €</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize="10" fill="#90A4AE">{tab === 'sorties' ? 'dépensé' : 'reçu'}</text>

      {/* Étiquettes : ligne diagonale simple puis horizontale */}
      {segs.length > 1 && all.map((s, i) => {
        const [p1x, p1y] = pt(RO + 3, s.mid);
        const [p2x, p2y] = pt(RO + 16, s.mid);
        const endX = s.isRight ? RIGHT_X : LEFT_X;
        const label  = getCatLabel(s.label);
        return (
          <g key={i}>
            <polyline
              points={`${p1x},${p1y} ${p2x},${p2y} ${endX},${s.fy}`}
              fill="none" stroke={s.color} strokeWidth="1.2"
            />
            <text
              x={s.isRight ? endX + 3 : endX - 3}
              y={s.fy + 4}
              textAnchor={s.isRight ? 'start' : 'end'}
              fontSize="9" fontWeight="600" fill="#455A64"
            >
              {label.length > 20 ? label.slice(0, 20) + '…' : label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('tous');
  const [month, setMonth] = useState(dayjs().startOf('month'));
  const [tab, setTab] = useState<'sorties' | 'entrees'>('sorties');
  const [detailCat, setDetailCat] = useState<string | null>(null);
  const [importMode, setImportMode] = useState(false);
  const [importAccountId, setImportAccountId] = useState('');
  const [catColors, setCatColors] = useState<Record<string, string>>(loadCatColors);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('📦');
  const [renameCat, setRenameCat] = useState<string | null>(null);
  const [renameEmoji, setRenameEmoji] = useState('');
  const [renameName, setRenameName] = useState('');
  const [addMode, setAddMode] = useState(false);
  const [newTx, setNewTx] = useState({ label: '', amount: '', date: dayjs().format('DD/MM/YYYY'), category: '', accountId: '', type: 'sortie' as 'sortie' | 'entree' });
  const [renameLabel, setRenameLabel] = useState('');

  useEffect(() => {
    const accs = Storage.getAccounts();
    setAccounts(accs);
    setTransactions(migrateTxCategories());
    if (accs.length > 0) setImportAccountId(accs[0].id);
  }, []);

  const monthTxs = transactions.filter(t => {
    if (selectedAccount !== 'tous' && t.accountId !== selectedAccount) return false;
    return t.date.startsWith(month.format('YYYY-MM'));
  });

  const sorties = monthTxs.filter(t => t.amount < 0 && !t.category.includes('Virement') && !t.category.includes('Retrait'));
  const entrees = monthTxs.filter(t => t.amount > 0 && !t.category.includes('Virement'));
  const current = tab === 'sorties' ? sorties : entrees;
  const total = current.reduce((s, t) => s + Math.abs(t.amount), 0);

  const byCategory: Record<string, number> = {};
  for (const t of current) {
    byCategory[t.category] = (byCategory[t.category] || 0) + Math.abs(t.amount);
  }
  const catList = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const PALETTE = ['#E91E63','#FF9800','#2196F3','#9C27B0','#4CAF50','#FF5722','#3F51B5','#00BCD4','#FFC107','#795548','#607D8B','#F06292'];
  const donutData = tab === 'sorties'
    ? catList.map(([label, value], i) => ({ label, value, color: getColor(label, catColors) !== '#BDBDBD' ? getColor(label, catColors) : PALETTE[i % PALETTE.length] }))
    : entrees.map((t, i) => {
        const words = t.label.split(' ');
        let label = '';
        for (const w of words) {
          const next = label ? label + ' ' + w : w;
          if (next.length > 14) break;
          label = next;
        }
        return { label: label || words[0], value: Math.abs(t.amount), color: PALETTE[i % PALETTE.length] };
      });

  const catTxs = detailCat ? current.filter(t => t.category === detailCat) : [];
  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || id;

  const deleteTx = (tx: Transaction) => {
    const updated = transactions.filter(t => t.id !== tx.id);
    Storage.saveTransactions(updated);
    setTransactions(updated);
    if (tx.manual) {
      const updatedAccounts = accounts.map(a => a.id === tx.accountId ? { ...a, balance: Math.round((a.balance - tx.amount) * 100) / 100, lastUpdated: new Date().toISOString() } : a);
      Storage.saveAccounts(updatedAccounts);
      setAccounts(updatedAccounts);
    }
    setEditTx(null);
  };

  const changeCategory = (tx: Transaction, newCat: string) => {
    const updated = transactions.map(t => t.id === tx.id ? { ...t, category: newCat } : t);
    Storage.saveTransactions(updated);
    setTransactions(updated);
    Storage.saveCatRule(tx.label, newCat);
    setEditTx(null);
  };

  const startRename = (cat: string) => {
    setRenameCat(cat);
    setRenameEmoji(getEmoji(cat));
    setRenameName(getCatLabel(cat));
  };

  const applyRename = () => {
    if (!renameCat || !renameName.trim()) return;
    const newKey = `${renameEmoji} ${renameName.trim()}`;
    // Mettre à jour les transactions
    const updatedTxs = transactions.map(t => t.category === renameCat ? { ...t, category: newKey } : t);
    Storage.saveTransactions(updatedTxs);
    setTransactions(updatedTxs);
    // Mettre à jour les couleurs
    const color = catColors[renameCat] || '#BDBDBD';
    const newColors = { ...catColors };
    delete newColors[renameCat];
    newColors[newKey] = color;
    setCatColors(newColors);
    saveCatColors(newColors);
    setRenameCat(null);
  };

  const createCategory = () => {
    if (!newCatName.trim()) return;
    const key = `${newCatEmoji} ${newCatName.trim()}`;
    const color = EXTRA_COLORS[Object.keys(catColors).length % EXTRA_COLORS.length];
    const updated = { ...catColors, [key]: color };
    setCatColors(updated);
    saveCatColors(updated);
    if (editTx) changeCategory(editTx, key);
    setNewCatName('');
    setNewCatEmoji('📦');
  };

  const saveNewTx = async () => {
    if (!newTx.label.trim() || !newTx.amount || !newTx.accountId || !newTx.category) { await dialog.alert('Veuillez remplir tous les champs'); return; }
    const date = dayjs(newTx.date, 'DD/MM/YYYY', true);
    if (!date.isValid()) { await dialog.alert('Date invalide (format : JJ/MM/AAAA)'); return; }
    const amount = parseFloat(newTx.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) { await dialog.alert('Montant invalide'); return; }
    const tx: Transaction = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      accountId: newTx.accountId,
      label: newTx.label.trim(),
      amount: newTx.type === 'sortie' ? -amount : amount,
      date: date.format('YYYY-MM-DD'),
      category: newTx.category,
      manual: true,
    };
    const updated = [...transactions, tx].sort((a, b) => b.date.localeCompare(a.date));
    Storage.saveTransactions(updated);
    setTransactions(updated);
    const updatedAccounts = accounts.map(a => a.id === tx.accountId ? { ...a, balance: Math.round((a.balance + tx.amount) * 100) / 100, lastUpdated: new Date().toISOString() } : a);
    Storage.saveAccounts(updatedAccounts);
    setAccounts(updatedAccounts);
    setAddMode(false);
    setNewTx({ label: '', amount: '', date: dayjs().format('DD/MM/YYYY'), category: '', accountId: accounts[0]?.id || '', type: 'sortie' });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importAccountId) return;
    e.target.value = '';
    try {
      const result = await importCSV(file, importAccountId, accounts);
      setTransactions(result.transactions);
      setAccounts(result.accounts);
      setImportMode(false);
      await dialog.alert(`✅ ${result.newCount} nouvelle(s) transaction(s) importée(s)\nSolde mis à jour !`);
    } catch {
      await dialog.alert('Erreur lors de l\'import. Vérifiez que le fichier est un CSV Caisse d\'Épargne valide.');
    }
  };

  return (
    <div>
      <div style={{ background: '#fff', paddingTop: '0', borderBottom: '1px solid #EAECF0' }}>
        {/* Tabs sorties / entrées */}
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px' }}>
          {(['sorties', 'entrees'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, border: `1.5px solid ${tab === t ? '#C9A040' : '#CFD8DC'}`,
              borderRadius: 20, background: tab === t ? '#C9A040' : '#fff',
              color: tab === t ? '#fff' : '#9AA5B4',
              fontWeight: 700, fontSize: 12, padding: '5px 0', cursor: 'pointer', letterSpacing: 0.5,
            }}>
              {t === 'sorties' ? 'SORTIES' : 'ENTRÉES'}
            </button>
          ))}
        </div>
      </div>

      {/* Filtre comptes */}
      <div className="chips" style={{ background: '#fff', paddingBottom: 8, paddingTop: 10 }}>
        <button className={`chip ${selectedAccount === 'tous' ? 'active' : ''}`} onClick={() => setSelectedAccount('tous')}>Tous</button>
        {accounts.map(a => (
          <button key={a.id} className={`chip ${selectedAccount === a.id ? 'active' : ''}`} onClick={() => setSelectedAccount(a.id)}>{a.name}</button>
        ))}
      </div>

      {/* Navigateur de mois */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #F0F0F0' }}>
        <button onClick={() => setMonth(m => m.subtract(1, 'month'))} style={{ background: '#F0F4F8', border: 'none', borderRadius: 20, width: 32, height: 32, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <p style={{ fontWeight: 700, color: '#C9A040', fontSize: 15, textTransform: 'capitalize', minWidth: 130, textAlign: 'center' }}>
          {month.format('MMMM YYYY')}
        </p>
        <button onClick={() => setMonth(m => m.add(1, 'month'))} style={{ background: '#F0F4F8', border: 'none', borderRadius: 20, width: 32, height: 32, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      </div>

      {current.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📋</div>
          <h3>Aucune transaction</h3>
          <p>Importez un fichier CSV depuis la Caisse d'Épargne</p>
        </div>
      ) : (
        <>
          {/* Donut + total */}
          <div style={{ background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 4px' }}>
            <DonutChart data={donutData} total={total} tab={tab} />
          </div>

          {/* Liste par catégorie */}
          <div style={{ background: '#F0F4F8', paddingBottom: 80 }}>
            {catList.map(([cat, amount]) => {
              const pct = Math.round((amount / total) * 100);
              return (
                <div key={cat} onClick={() => setDetailCat(cat === detailCat ? null : cat)}
                  style={{ background: '#fff', margin: '8px 12px 0', borderRadius: 14, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Icone colorée */}
                    <div style={{ width: 40, height: 40, borderRadius: 20, background: getColor(cat, catColors), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      {getEmoji(cat)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontWeight: 600, fontSize: 14, color: '#263238' }}>{getCatLabel(cat)}</p>
                        <p style={{ fontWeight: 700, fontSize: 15, color: tab === 'sorties' ? '#263238' : '#1B5E20', flexShrink: 0 }}>
                          {tab === 'sorties' ? '' : '+'}{fmt(amount)} €
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                        <div style={{ flex: 1, height: 4, background: '#F0F0F0', borderRadius: 2 }}>
                          <div style={{ height: 4, background: getColor(cat, catColors), borderRadius: 2, width: `${pct}%` }} />
                        </div>
                        <p style={{ fontSize: 11, color: '#90A4AE', flexShrink: 0 }}>{pct}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Détail transactions de cette catégorie */}
                  {detailCat === cat && (
                    <div style={{ marginTop: 12, borderTop: '1px solid #F0F0F0', paddingTop: 10 }}>
                      {catTxs.map(t => (
                        <div key={t.id}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 6px', borderRadius: 8, borderBottom: '1px solid #FAFAFA' }}>
                          <div style={{ flex: 1, minWidth: 0 }} onClick={e => { e.stopPropagation(); setEditTx(t); setRenameLabel(t.label); }}>
                            <p style={{ fontSize: 13, color: '#455A64', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</p>
                            <p style={{ fontSize: 11, color: '#B0BEC5', marginTop: 1 }}>{dayjs(t.date).format('DD/MM')} · {getAccountName(t.accountId)}{!t.manual && <span style={{ color: '#90A4AE' }}> · ✏️ modifier</span>}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: t.amount < 0 ? '#B71C1C' : '#1B5E20' }}>
                              {t.amount > 0 ? '+' : ''}{fmt(t.amount)} €
                            </p>
                            <button onClick={async e => { e.stopPropagation(); if (await dialog.confirm('Supprimer cette transaction ?')) deleteTx(t); }}
                              style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#B71C1C', padding: '2px 4px' }}>🗑</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Boutons en bas */}
          <div style={{ padding: '16px', display: 'flex', gap: 12 }}>
            <button onClick={() => setImportMode(true)}
              style={{ flex: 1, background: '#fff', border: '1.5px solid #CFD8DC', borderRadius: 12, padding: '12px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#546E7A' }}>
              📥 Importer CSV
            </button>
            <button onClick={() => { setNewTx({ label: '', amount: '', date: dayjs().format('DD/MM/YYYY'), category: '', accountId: accounts[0]?.id || '', type: 'sortie' }); setAddMode(true); }}
              style={{ flex: 1, background: '#C9A040', border: 'none', borderRadius: 12, padding: '12px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff' }}>
              + Ajouter
            </button>
          </div>

        </>
      )}

      {/* Modal changement de catégorie */}
      {editTx && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditTx(null)}>
          <div className="modal">
            <h2>Modifier la transaction</h2>
            <p style={{ fontSize: 13, color: '#90A4AE', marginTop: 4, marginBottom: 10 }}>{editTx.label} · {fmt(Math.abs(editTx.amount))} €</p>

            {/* Renommer l'opération */}
            <label className="field-label">Renommer l'opération</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input className="input" value={renameLabel} onChange={e => setRenameLabel(e.target.value)} style={{ flex: 1 }} />
              <button style={{ flexShrink: 0, padding: '0 14px', background: '#C9A040', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', height: 44 }}
                onClick={() => {
                  if (!renameLabel.trim()) return;
                  Storage.saveLabelRule(editTx.label, renameLabel.trim());
                  const updated = transactions.map(t => t.id === editTx.id ? { ...t, label: renameLabel.trim() } : t);
                  Storage.saveTransactions(updated);
                  setTransactions(updated);
                  setEditTx({ ...editTx, label: renameLabel.trim() });
                }}>
                OK
              </button>
            </div>

            {/* Renommer une catégorie */}
            {renameCat && (
              <div style={{ background: '#FFF8E1', borderRadius: 12, padding: 12, marginBottom: 12, border: '1.5px solid #FFD54F' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#F57F17', marginBottom: 8 }}>✏️ Renommer "{getCatLabel(renameCat)}"</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={renameEmoji} onChange={e => setRenameEmoji(e.target.value)}
                    style={{ width: 48, textAlign: 'center', fontSize: 20, border: '1.5px solid #E0E0E0', borderRadius: 8, background: '#fff', padding: 4 }} />
                  <input className="input" value={renameName} onChange={e => setRenameName(e.target.value)} style={{ flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn-primary" onClick={applyRename} style={{ flex: 1, padding: '10px 0' }}>Valider</button>
                  <button className="btn-secondary" onClick={() => setRenameCat(null)} style={{ flex: 1, padding: '10px 0' }}>Annuler</button>
                </div>
              </div>
            )}

            {/* Catégories existantes */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {Object.keys(catColors).map(cat => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button onClick={() => changeCategory(editTx, cat)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 20, border: `2px solid ${editTx.category === cat ? getColor(cat, catColors) : '#E0E0E0'}`, background: editTx.category === cat ? getColor(cat, catColors) + '22' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: editTx.category === cat ? 700 : 400, color: '#263238' }}>
                    <span>{getEmoji(cat)}</span>
                    <span>{getCatLabel(cat)}</span>
                  </button>
                  <button onClick={() => startRename(cat)} style={{ background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', color: '#B0BEC5', padding: '4px' }}>✏️</button>
                </div>
              ))}
            </div>

            {/* Nouvelle catégorie */}
            <div style={{ background: '#F8F9FA', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#546E7A', marginBottom: 8 }}>+ Nouvelle catégorie</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newCatEmoji} onChange={e => setNewCatEmoji(e.target.value)}
                  style={{ width: 48, textAlign: 'center', fontSize: 20, border: '1.5px solid #E0E0E0', borderRadius: 8, background: '#fff', padding: 4 }} />
                <input className="input" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  placeholder="Nom de la catégorie" style={{ flex: 1 }} />
              </div>
              <button className="btn-primary" onClick={createCategory} style={{ marginTop: 10, padding: '10px 20px' }}>
                Créer et appliquer
              </button>
            </div>

            {editTx.manual && (
              <button onClick={async () => { if (await dialog.confirm('Supprimer cette transaction ?')) deleteTx(editTx); }}
                style={{ width: '100%', background: '#FFEBEE', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 700, color: '#B71C1C', cursor: 'pointer', marginBottom: 8 }}>
                🗑 Supprimer la transaction
              </button>
            )}
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setEditTx(null)}>Annuler</button>
            <div className="spacer" />
          </div>
        </div>
      )}

      {/* Modal import */}
      {importMode && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setImportMode(false)}>
          <div className="modal">
            <h2>📥 Importer CSV</h2>
            <div className="spacer" />
            <div style={{ background: '#F5EDD6', borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <p style={{ fontWeight: 700, color: '#C9A040', marginBottom: 8 }}>Comment faire ?</p>
              {['Connectez-vous sur mes-comptes.caisse-epargne.fr', 'Allez sur votre compte', 'Cliquez sur "Télécharger" ou l\'icône export', 'Choisissez le format CSV', 'Revenez ici et sélectionnez le fichier'].map((s, i) => (
                <p key={i} style={{ fontSize: 13, color: '#455A64', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: '#C9A040' }}>{i + 1}.</span> {s}
                </p>
              ))}
            </div>
            <label className="field-label">Pour quel compte ?</label>
            {accounts.map(a => (
              <button key={a.id} onClick={() => setImportAccountId(a.id)}
                style={{ width: '100%', border: `1.5px solid ${importAccountId === a.id ? '#C9A040' : '#CFD8DC'}`, borderRadius: 10, padding: 12, marginBottom: 8, background: importAccountId === a.id ? '#F5EDD6' : '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: importAccountId === a.id ? 700 : 400, color: importAccountId === a.id ? '#C9A040' : '#546E7A' }}>
                {a.name} ({a.type === 'perso' ? 'Personnel' : 'Pro'})
              </button>
            ))}
            <div className="spacer" />
            <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={handleFile}
              style={{ width: '100%', padding: '14px', background: '#0D0D0D', color: '#fff', borderRadius: 12, fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer' }} />
            <div style={{ height: 10 }} />
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setImportMode(false)}>Annuler</button>
            <div className="spacer" />
          </div>
        </div>
      )}
      {/* Modal ajout manuel */}
      {addMode && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAddMode(false)}>
          <div className="modal">
            <h2>Nouvelle transaction</h2>
            <div className="spacer" />

            {/* Type sortie / entrée */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              {(['sortie', 'entree'] as const).map(t => (
                <button key={t} onClick={() => setNewTx(f => ({ ...f, type: t }))}
                  style={{ flex: 1, border: `1.5px solid ${newTx.type === t ? (t === 'sortie' ? '#B71C1C' : '#1B5E20') : '#CFD8DC'}`, borderRadius: 12, padding: '10px 8px', background: newTx.type === t ? (t === 'sortie' ? '#FFEBEE' : '#E8F5E9') : '#fff', cursor: 'pointer', fontSize: 14, fontWeight: newTx.type === t ? 700 : 400, color: newTx.type === t ? (t === 'sortie' ? '#B71C1C' : '#1B5E20') : '#546E7A' }}>
                  {t === 'sortie' ? '💸 Dépense' : '💶 Revenu'}
                </button>
              ))}
            </div>

            <label className="field-label">Description *</label>
            <input className="input" placeholder="Ex: Courses Leclerc" value={newTx.label} onChange={e => setNewTx(f => ({ ...f, label: e.target.value }))} />

            <label className="field-label">Montant * (€)</label>
            <input className="input" placeholder="Ex: 45,90" value={newTx.amount} onChange={e => setNewTx(f => ({ ...f, amount: e.target.value }))} inputMode="decimal" />

            <label className="field-label">Date * (JJ/MM/AAAA)</label>
            <input className="input" placeholder={dayjs().format('DD/MM/YYYY')} value={newTx.date} onChange={e => setNewTx(f => ({ ...f, date: e.target.value }))} />

            <label className="field-label">Catégorie *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
              {Object.keys(catColors).map(cat => (
                <button key={cat} onClick={() => setNewTx(f => ({ ...f, category: cat }))}
                  style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${newTx.category === cat ? getColor(cat, catColors) : '#E0E0E0'}`, background: newTx.category === cat ? getColor(cat, catColors) + '22' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: newTx.category === cat ? 700 : 400, color: '#263238' }}>
                  {getEmoji(cat)} {getCatLabel(cat)}
                </button>
              ))}
            </div>

            <label className="field-label">Compte *</label>
            {accounts.map(a => (
              <button key={a.id} onClick={() => setNewTx(f => ({ ...f, accountId: a.id }))}
                style={{ width: '100%', border: `1.5px solid ${newTx.accountId === a.id ? '#C9A040' : '#CFD8DC'}`, borderRadius: 10, padding: 12, marginBottom: 8, background: newTx.accountId === a.id ? '#F5EDD6' : '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: newTx.accountId === a.id ? 700 : 400, color: newTx.accountId === a.id ? '#C9A040' : '#546E7A' }}>
                {a.name}
              </button>
            ))}

            <div className="spacer" />
            <button className="btn-primary" onClick={saveNewTx}>Enregistrer</button>
            <div style={{ height: 10 }} />
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setAddMode(false)}>Annuler</button>
            <div className="spacer" />
          </div>
        </div>
      )}
    </div>
  );
}
