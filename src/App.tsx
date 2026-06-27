import { useState } from 'react';
import Dashboard from './screens/Dashboard';
import Transactions from './screens/Transactions';
import Installments from './screens/Installments';
import Projection from './screens/Projection';
import Accounts from './screens/Accounts';
import './App.css';

const TABS = [
  { id: 'dashboard', label: 'Accueil', icon: '🏠' },
  { id: 'transactions', label: 'Dépenses', icon: '📋' },
  { id: 'installments', label: 'Mensualités', icon: '🔄' },
  { id: 'projection', label: 'Projection', icon: '📈' },
  { id: 'accounts', label: 'Comptes', icon: '🏦' },
];

export default function App() {
  const [tab, setTab] = useState('dashboard');

  return (
    <div className="app">
      <div className="content">
        {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
        {tab === 'transactions' && <Transactions />}
        {tab === 'installments' && <Installments />}
        {tab === 'projection' && <Projection />}
        {tab === 'accounts' && <Accounts />}
      </div>
      <nav className="tab-bar">
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
