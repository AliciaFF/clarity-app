import { useState, useEffect } from 'react';
import { Storage } from '../storage';
import type { Transaction, Account } from '../types';
import { parseCaisseEpargneCSV } from '../utils/csvParser';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
dayjs.locale('fr');

const DEFAULT_CATS: Record<string, string> = {
  '🛒 Courses': '#FF9800',
  '🍽️ Restauration': '#FF5722',
  '🛍️ Shopping': '#E91E63',
  '🚗 Transport': '#2196F3',
  '🏠 Logement': '#3F51B5',
  '🏥 Santé': '#4CAF50',
  '🎬 Loisirs': '#9C27B0',
  '🏛️ Impôts': '#607D8B',
  '🛡️ Assurance': '#795548',
  '👗 Vêtements': '#F06292',
  '💰 Revenus': '#43A047',
  '🔄 Virement': '#90A4AE',
  '💵 Retrait': '#FFC107',
  '🏦 Frais bancaires': '#455A64',
  '🐾 Animaux': '#8BC34A',
  '📚 Éducation': '#00BCD4',
  '💆 Bien-être': '#FF80AB',
  '🏋️ Sport': '#00897B',
  '🎁 Cadeaux': '#AB47BC',
  '🍼 Enfants': '#FFB74D',
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

function getColor(cat: string, colors: Record<string, string>) { return colors[cat] || DEFAULT_CATS[cat] || '#BDBDBD'; }
function getEmoji(cat: string) { return cat.split(' ')[0] || '📦'; }
function getCatLabel(cat: string) { return cat.split(' ').slice(1).join(' ') || cat; }

function DonutChart({ data, total, tab }: { data: { label: string; value: number; color: string }[], total: number, tab: string }) {
  if (total === 0 || data.length === 0) return null;

  const cx = 170, cy = 128, RO = 75, RI = 50;
  const W = 340, H = 280;
  const ELBOW_R = RO + 22;
  const MIN_GAP = 15;
  const LEFT_X = 68, RIGHT_X = 272;

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
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="13" fontWeight="800" fill="#263238">{total.toFixed(2).replace('.', ',')} €</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize="10" fill="#90A4AE">{tab === 'sorties' ? 'dépensé' : 'reçu'}</text>

      {/* Étiquettes : ligne diagonale simple puis horizontale */}
      {all.map((s, i) => {
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
              {label.length > 16 ? label.slice(0, 16) + '…' : label}
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

  useEffect(() => {
    const accs = Storage.getAccounts();
    setAccounts(accs);
    setTransactions(Storage.getTransactions());
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
  const donutData = catList.map(([label, value], i) => ({ label, value, color: getColor(label, catColors) !== '#BDBDBD' ? getColor(label, catColors) : PALETTE[i % PALETTE.length] }));

  const catTxs = detailCat ? current.filter(t => t.category === detailCat) : [];
  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || id;

  const changeCategory = (tx: Transaction, newCat: string) => {
    const updated = transactions.map(t => t.id === tx.id ? { ...t, category: newCat } : t);
    Storage.saveTransactions(updated);
    setTransactions(updated);
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

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importAccountId) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      const newTxs = parseCaisseEpargneCSV(content, importAccountId);
      const otherAccTxs = Storage.getTransactions().filter(t => t.accountId !== importAccountId);
      const merged = [...otherAccTxs, ...newTxs].sort((a, b) => b.date.localeCompare(a.date));
      Storage.saveTransactions(merged);
      setTransactions(merged);
      setImportMode(false);
      alert(`✅ ${newTxs.length} transaction(s) importée(s) !`);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  return (
    <div>
      {/* Header */}
      <div style={{ background: '#4A90D9', padding: '8px 16px 0', paddingTop: 'calc(8px + env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>Dépenses</h1>
          <button className="btn-sm" onClick={() => setImportMode(true)} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}>📥 Importer</button>
        </div>

        {/* Tabs sorties / entrées */}
        <div style={{ display: 'flex', gap: 0 }}>
          {(['sorties', 'entrees'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, background: 'none', border: 'none', color: tab === t ? '#fff' : 'rgba(255,255,255,0.55)',
              fontWeight: 700, fontSize: 13, padding: '8px 0', cursor: 'pointer', letterSpacing: 0.5,
              borderBottom: tab === t ? '3px solid #fff' : '3px solid transparent',
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
        <p style={{ fontWeight: 700, color: '#1565C0', fontSize: 15, textTransform: 'capitalize', minWidth: 130, textAlign: 'center' }}>
          {month.format('MMMM YYYY')}
        </p>
        <button onClick={() => setMonth(m => m.add(1, 'month'))} style={{ background: '#F0F4F8', border: 'none', borderRadius: 20, width: 32, height: 32, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      </div>

      {current.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📋</div>
          <h3>Aucune transaction</h3>
          <p>Importe un fichier CSV depuis la Caisse d'Épargne</p>
        </div>
      ) : (
        <>
          {/* Donut + total */}
          <div style={{ background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 4px' }}>
            {tab === 'sorties' && <DonutChart data={donutData} total={total} tab={tab} />}
            {tab === 'entrees' && (
              <div style={{ padding: '24px 0 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 36, fontWeight: 800, color: '#43A047' }}>+{total.toFixed(2).replace('.', ',')} €</p>
                <p style={{ fontSize: 12, color: '#90A4AE', marginTop: 4 }}>reçu en {month.format('MMMM YYYY')}</p>
              </div>
            )}
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
                    <div style={{ width: 40, height: 40, borderRadius: 20, background: getColor(cat, catColors), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {getEmoji(cat)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontWeight: 600, fontSize: 14, color: '#263238' }}>{getCatLabel(cat)}</p>
                        <p style={{ fontWeight: 700, fontSize: 15, color: tab === 'sorties' ? '#263238' : '#43A047', flexShrink: 0 }}>
                          {tab === 'sorties' ? '' : '+'}{amount.toFixed(2).replace('.', ',')} €
                        </p>
                      </div>
                      {tab === 'sorties' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                        <div style={{ flex: 1, height: 4, background: '#F0F0F0', borderRadius: 2 }}>
                          <div style={{ height: 4, background: getColor(cat, catColors), borderRadius: 2, width: `${pct}%` }} />
                        </div>
                        <p style={{ fontSize: 11, color: '#90A4AE', flexShrink: 0 }}>{pct}%</p>
                      </div>}
                    </div>
                  </div>

                  {/* Détail transactions de cette catégorie */}
                  {detailCat === cat && (
                    <div style={{ marginTop: 12, borderTop: '1px solid #F0F0F0', paddingTop: 10 }}>
                      {catTxs.map(t => (
                        <div key={t.id} onClick={e => { e.stopPropagation(); setEditTx(t); }}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 6px', borderRadius: 8, borderBottom: '1px solid #FAFAFA', cursor: 'pointer' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, color: '#455A64', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</p>
                            <p style={{ fontSize: 11, color: '#B0BEC5', marginTop: 1 }}>{dayjs(t.date).format('DD/MM')} · {getAccountName(t.accountId)} · <span style={{ color: '#90A4AE' }}>✏️ modifier</span></p>
                          </div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: t.amount < 0 ? '#EF5350' : '#43A047', flexShrink: 0, marginLeft: 8 }}>
                            {t.amount > 0 ? '+' : ''}{t.amount.toFixed(2).replace('.', ',')} €
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal changement de catégorie */}
      {editTx && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditTx(null)}>
          <div className="modal">
            <h2>Changer la catégorie</h2>
            <p style={{ fontSize: 13, color: '#90A4AE', marginTop: 4, marginBottom: 14 }}>{editTx.label} · {Math.abs(editTx.amount).toFixed(2).replace('.', ',')} €</p>

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
            <div style={{ background: '#E8EAF6', borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <p style={{ fontWeight: 700, color: '#1A237E', marginBottom: 8 }}>Comment faire ?</p>
              {['Connecte-toi sur mes-comptes.caisse-epargne.fr', 'Va sur ton compte', 'Clique sur "Télécharger" ou l\'icône export', 'Choisis le format CSV', 'Reviens ici et sélectionne le fichier'].map((s, i) => (
                <p key={i} style={{ fontSize: 13, color: '#455A64', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: '#1A237E' }}>{i + 1}.</span> {s}
                </p>
              ))}
            </div>
            <label className="field-label">Pour quel compte ?</label>
            {accounts.map(a => (
              <button key={a.id} onClick={() => setImportAccountId(a.id)}
                style={{ width: '100%', border: `1.5px solid ${importAccountId === a.id ? '#1565C0' : '#CFD8DC'}`, borderRadius: 10, padding: 12, marginBottom: 8, background: importAccountId === a.id ? '#E3F2FD' : '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: importAccountId === a.id ? 700 : 400, color: importAccountId === a.id ? '#1565C0' : '#546E7A' }}>
                {a.name} ({a.type === 'perso' ? 'Personnel' : 'Pro'})
              </button>
            ))}
            <div className="spacer" />
            <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={handleFile}
              style={{ width: '100%', padding: '14px', background: '#4A90D9', color: '#fff', borderRadius: 12, fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer' }} />
            <div style={{ height: 10 }} />
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setImportMode(false)}>Annuler</button>
            <div className="spacer" />
          </div>
        </div>
      )}
    </div>
  );
}
