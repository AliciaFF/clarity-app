import { useState, useEffect } from 'react';
import { Storage } from '../storage';
import type { Account, AccountType } from '../types';
import dayjs from 'dayjs';

const empty = { name: '', balance: '', type: 'perso' as AccountType };

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState(empty);

  useEffect(() => { setAccounts(Storage.getAccounts()); }, []);

  const openAdd = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (a: Account) => { setEditing(a); setForm({ name: a.name, balance: String(a.balance).replace('.', ','), type: a.type }); setModal(true); };

  const save = () => {
    if (!form.name || !form.balance) return alert('Remplis tous les champs');
    const balance = parseFloat(form.balance.replace(',', '.'));
    if (isNaN(balance)) return alert('Solde invalide');
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

  const del = (id: string) => {
    if (!confirm('Supprimer ce compte ?')) return;
    const updated = accounts.filter(a => a.id !== id);
    Storage.saveAccounts(updated);
    Storage.saveTransactions(Storage.getTransactions().filter(t => t.accountId !== id));
    setAccounts(updated);
  };

  return (
    <div>
      <div className="header">
        <div className="header-row">
          <h1>Mes Comptes</h1>
          <button className="btn-sm" onClick={openAdd}>+ Ajouter</button>
        </div>
      </div>

      {accounts.length === 0 && (
        <div className="empty-state">
          <div className="icon">🏦</div>
          <h3>Aucun compte</h3>
          <p>Ajoute tes comptes Caisse d'Épargne pour commencer</p>
          <div className="spacer" />
          <button className="btn-primary" onClick={openAdd} style={{ maxWidth: 250 }}>Ajouter mon premier compte</button>
        </div>
      )}

      {accounts.map(acc => (
        <div className="card" key={acc.id}>
          <div className="row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: '#E8EAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {acc.type === 'perso' ? '🏠' : '💼'}
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 16, color: '#263238' }}>{acc.name}</p>
                <p style={{ fontSize: 12, color: '#90A4AE' }}>{acc.type === 'perso' ? 'Personnel' : 'Professionnel'}</p>
              </div>
            </div>
            <p style={{ fontSize: 22, fontWeight: 800, color: acc.balance < 0 ? '#EF5350' : '#1A237E' }}>
              {acc.balance.toFixed(2).replace('.', ',')} €
            </p>
          </div>
          <p style={{ fontSize: 11, color: '#B0BEC5', margin: '10px 0 12px' }}>Mis à jour le {dayjs(acc.lastUpdated).format('DD/MM/YYYY')}</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => openEdit(acc)}>✏️ Modifier</button>
            <button className="btn-danger" style={{ flex: 1 }} onClick={() => del(acc.id)}>🗑 Supprimer</button>
          </div>
        </div>
      ))}

      <div className="card" style={{ background: '#E3F2FD', marginTop: 20 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#1565C0', marginBottom: 6 }}>💡 Comment mettre à jour mon solde ?</p>
        <p style={{ fontSize: 13, color: '#1565C0', lineHeight: 1.6 }}>
          Après avoir importé un CSV, clique sur "Modifier" pour mettre à jour le solde avec celui affiché sur mes-comptes.caisse-epargne.fr.
        </p>
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
              {(['perso', 'pro'] as AccountType[]).map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                  style={{ flex: 1, border: `1.5px solid ${form.type === t ? '#1A237E' : '#CFD8DC'}`, borderRadius: 12, padding: '12px 8px', background: form.type === t ? '#E8EAF6' : '#fff', cursor: 'pointer', fontSize: 14, fontWeight: form.type === t ? 700 : 400, color: form.type === t ? '#1A237E' : '#546E7A' }}>
                  {t === 'perso' ? '🏠 Personnel' : '💼 Pro'}
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
