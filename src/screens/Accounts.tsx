import { fmt } from '../utils';
import { useState, useEffect, useRef } from 'react';
import { Storage } from '../storage';
import { dialog } from '../dialog';
import type { Account, AccountType } from '../types';
import dayjs from 'dayjs';

const empty = { name: '', balance: '', type: 'perso' as AccountType };

function exportData() {
  const data = {
    accounts: Storage.getAccounts(),
    transactions: Storage.getTransactions(),
    installments: Storage.getInstallments(),
    excluded: localStorage.getItem('bt_projection_excluded'),
    overrides: localStorage.getItem('bt_projection_overrides'),
    categories: localStorage.getItem('bt_categories'),
    hiddenRecurring: localStorage.getItem('bt_hidden_recurring'),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clarity-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importData(file: File, onDone: () => void) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (typeof data !== 'object' || data === null) throw new Error();
      if (data.accounts && Array.isArray(data.accounts)) Storage.saveAccounts(data.accounts);
      if (data.transactions && Array.isArray(data.transactions)) Storage.saveTransactions(data.transactions);
      if (data.installments && Array.isArray(data.installments)) Storage.saveInstallments(data.installments);
      if (typeof data.excluded === 'string') localStorage.setItem('bt_projection_excluded', data.excluded);
      if (typeof data.overrides === 'string') localStorage.setItem('bt_projection_overrides', data.overrides);
      if (typeof data.categories === 'string') localStorage.setItem('bt_categories', data.categories);
      if (typeof data.hiddenRecurring === 'string') localStorage.setItem('bt_hidden_recurring', data.hiddenRecurring);
      onDone();
    } catch {
      dialog.alert('Fichier invalide.');
    }
  };
  reader.readAsText(file);
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState(empty);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setAccounts(Storage.getAccounts()); }, []);

  const openAdd = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (a: Account) => { setEditing(a); setForm({ name: a.name, balance: String(a.balance).replace('.', ','), type: a.type }); setModal(true); };

  const save = async () => {
    if (!form.name || !form.balance) { await dialog.alert('Veuillez remplir tous les champs'); return; }
    const balance = parseFloat(form.balance.replace(',', '.'));
    if (isNaN(balance)) { await dialog.alert('Solde invalide'); return; }
    let updated: Account[];
    if (editing) {
      updated = accounts.map(a => a.id === editing.id ? { ...a, name: form.name, balance, type: form.type, lastUpdated: new Date().toISOString() } : a);
    } else {
      updated = [...accounts, { id: Date.now().toString(), name: form.name, type: form.type, balance, lastUpdated: new Date().toISOString() }];
    }
    Storage.saveAccounts(updated);
    setAccounts(updated);
    setModal(false);
  };

  const del = async (id: string) => {
    if (!await dialog.confirm('Supprimer ce compte et toutes ses données ?')) return;
    const updated = accounts.filter(a => a.id !== id);
    Storage.saveAccounts(updated);
    Storage.saveTransactions(Storage.getTransactions().filter(t => t.accountId !== id));
    Storage.saveInstallments(Storage.getInstallments().filter(p => p.accountId !== id));
    setAccounts(updated);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px', paddingTop: '8px' }}>
        <button className="btn-sm" onClick={openAdd}>+ Ajouter</button>
      </div>

      {accounts.length === 0 && (
        <div className="empty-state">
          <div className="icon">🏦</div>
          <h3>Aucun compte</h3>
          <p>Ajoutez vos comptes Caisse d'Épargne pour commencer</p>
          <div className="spacer" />
          <button className="btn-primary" onClick={openAdd} style={{ maxWidth: 250 }}>Ajouter mon premier compte</button>
        </div>
      )}

      {accounts.map(acc => (
        <div className="card" key={acc.id}>
          <div className="row">
            <div>
              <p style={{ fontWeight: 700, fontSize: 16, color: '#263238' }}>{acc.name}</p>
              <p style={{ fontSize: 12, color: '#90A4AE' }}>{acc.type === 'perso' ? 'Personnel' : acc.type === 'especes' ? 'Espèces' : 'Professionnel'}</p>
            </div>
            <p style={{ fontSize: 22, fontWeight: 800, color: acc.balance < 0 ? '#EF5350' : '#C9A040' }}>
              {fmt(acc.balance)} €
            </p>
          </div>
          <p style={{ fontSize: 11, color: '#B0BEC5', margin: '10px 0 12px' }}>Mis à jour le {dayjs(acc.lastUpdated).format('DD/MM/YYYY')}</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ flex: 1, background: '#C9A040', border: 'none', borderRadius: 10, padding: '10px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }} onClick={() => openEdit(acc)}>✏️ Modifier</button>
            <button style={{ flex: 1, background: '#B71C1C', border: 'none', borderRadius: 10, padding: '10px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }} onClick={() => del(acc.id)}>🗑 Supprimer</button>
          </div>
        </div>
      ))}

      <div className="card" style={{ marginTop: 20 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#263238', marginBottom: 12 }}>Sauvegarde & Restauration</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" style={{ flex: 1 }} onClick={exportData}>⬇️ Sauvegarder</button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={() => importRef.current?.click()}>⬆️ Restaurer</button>
        </div>
        <p style={{ fontSize: 12, color: '#90A4AE', marginTop: 10, lineHeight: 1.5 }}>
          Sauvegardez vos données avant de réinstaller l'appli, puis restaurez-les ensuite.
        </p>
        <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) importData(f, async () => { await dialog.alert('Données restaurées !'); window.location.reload(); }); e.target.value = ''; }} />
      </div>

      <div className="card" style={{ marginTop: 12, textAlign: 'center' }}>
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, color: '#90A4AE', textDecoration: 'none' }}>
          Politique de confidentialité
        </a>
      </div>

      <div className="spacer-lg" />

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2>{editing ? 'Modifier' : 'Nouveau compte'}</h2>
            <div className="spacer" />

            <label className="field-label">Nom du compte *</label>
            <input className="input" placeholder="Ex: Compte Courant" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

            <label className="field-label">Solde actuel * (€)</label>
            <input className="input" placeholder="Ex: 1234,56" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} inputMode="decimal" />

            <label className="field-label">Type *</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['perso', 'pro', 'especes'] as AccountType[]).map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                  style={{ flex: 1, border: `1.5px solid ${form.type === t ? '#C9A040' : '#CFD8DC'}`, borderRadius: 12, padding: '12px 8px', background: form.type === t ? '#F5EDD6' : '#fff', cursor: 'pointer', fontSize: 14, fontWeight: form.type === t ? 700 : 400, color: form.type === t ? '#C9A040' : '#546E7A' }}>
                  {t === 'perso' ? '🏠 Personnel' : t === 'especes' ? '💵 Espèces' : '💼 Pro'}
                </button>
              ))}
            </div>

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
