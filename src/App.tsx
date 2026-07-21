import { useState, useEffect } from 'react';
import { Storage } from './storage';
import Dashboard from './screens/Dashboard';
import Transactions from './screens/Transactions';
import Installments from './screens/Installments';
import Projection from './screens/Projection';
import Accounts from './screens/Accounts';
import Simulator from './screens/Simulator';
import DialogModal, { type DialogState } from './components/DialogModal';
import './App.css';

const s = { fill: 'none', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const IconHome = ({ color }: { color: string }) => (
  <svg width="28" height="28" viewBox="0 0 28 28" {...s} stroke={color}>
    <path d="M2 14 L14 3 L26 14" />
    <path d="M5 12 L5 26 L23 26 L23 12" />
    <path d="M10 26 L10 19 L18 19 L18 26" />
    <text x="14" y="17" textAnchor="middle" fontSize="9" fontWeight="bold" fill={color} stroke="none" fontFamily="Arial, sans-serif">C</text>
  </svg>
);

const IconReceipt = ({ color }: { color: string }) => (
  <svg width="28" height="28" viewBox="0 0 28 28" {...s} stroke={color}>
    <path d="M7 2 L21 2 L21 26 L18.5 24.5 L16 26 L13.5 24.5 L11 26 L8.5 24.5 L7 26 Z" />
    <line x1="10" y1="8" x2="18" y2="8" />
    <line x1="10" y1="12" x2="18" y2="12" />
    <circle cx="14" cy="20" r="5" fill="#0D0D0D" stroke={color} strokeWidth="1.3" />
    <text x="14" y="20" textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="bold" fill={color} stroke="none" fontFamily="Arial, sans-serif">€</text>
  </svg>
);

const IconCalculator = ({ color }: { color: string }) => (
  <svg width="28" height="28" viewBox="0 0 28 28" {...s} stroke={color}>
    <rect x="3" y="2" width="17" height="22" rx="2" />
    <rect x="6" y="5" width="11" height="5" rx="1" />
    <line x1="7" y1="15" x2="9" y2="15" /><line x1="8" y1="14" x2="8" y2="16" />
    <line x1="13" y1="14" x2="15" y2="16" /><line x1="15" y1="14" x2="13" y2="16" />
    <line x1="7" y1="20" x2="9" y2="20" />
    <line x1="12" y1="19" x2="16" y2="19" /><line x1="12" y1="21" x2="16" y2="21" />
    <circle cx="22" cy="21" r="5.5" fill="#0D0D0D" stroke={color} strokeWidth="1.4" />
    <text x="22" y="21" textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="bold" fill={color} stroke="none" fontFamily="Arial, sans-serif">€</text>
  </svg>
);

const IconChart = ({ color }: { color: string }) => (
  <svg width="28" height="28" viewBox="0 0 28 28" {...s} stroke={color}>
    <rect x="2" y="19" width="5" height="7" rx="1" />
    <rect x="11" y="13" width="5" height="13" rx="1" />
    <rect x="20" y="7" width="5" height="19" rx="1" />
  </svg>
);

const IconBank = ({ color }: { color: string }) => (
  <svg width="28" height="28" viewBox="0 0 28 28" {...s} stroke={color}>
    <polygon points="14,2 26,8 2,8" />
    <line x1="2" y1="8" x2="26" y2="8" />
    <line x1="2" y1="24" x2="26" y2="24" />
    <line x1="1" y1="27" x2="27" y2="27" />
    <line x1="5" y1="9" x2="5" y2="24" />
    <line x1="10" y1="9" x2="10" y2="24" />
    <line x1="18" y1="9" x2="18" y2="24" />
    <line x1="23" y1="9" x2="23" y2="24" />
    <circle cx="14" cy="16.5" r="5" fill="#0D0D0D" stroke={color} strokeWidth="1.4" />
    <text x="14" y="16.5" textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="bold" fill={color} stroke="none" fontFamily="Arial, sans-serif">€</text>
  </svg>
);

const IconCalendar = ({ color }: { color: string }) => (
  <svg width="28" height="28" viewBox="0 0 28 28" {...s} stroke={color}>
    <rect x="4" y="6" width="20" height="18" rx="2.5" />
    <line x1="4" y1="12" x2="24" y2="12" />
    <line x1="10" y1="4" x2="10" y2="9" />
    <line x1="18" y1="4" x2="18" y2="9" />
    <line x1="8.5" y1="16.5" x2="10.5" y2="16.5" />
    <line x1="13" y1="16.5" x2="15" y2="16.5" />
    <line x1="17.5" y1="16.5" x2="19.5" y2="16.5" />
    <line x1="8.5" y1="20.5" x2="10.5" y2="20.5" />
    <line x1="13" y1="20.5" x2="15" y2="20.5" />
    <line x1="17.5" y1="20.5" x2="19.5" y2="20.5" />
  </svg>
);

const TABS = [
  { id: 'dashboard', label: 'Accueil', Icon: IconHome },
  { id: 'transactions', label: 'Dépenses', Icon: IconReceipt },
  { id: 'simulator', label: 'Simulateur', Icon: IconCalculator },
  { id: 'installments', label: 'Mensualités', Icon: IconCalendar },
  { id: 'projection', label: 'Projection', Icon: IconChart },
  { id: 'accounts', label: 'Comptes', Icon: IconBank },
];

function Onboarding({ onDone }: { onDone: () => void }) {
  return (
    <div style={{ minHeight: '100dvh', background: '#0D0D0D', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '60px 32px', paddingTop: 'calc(60px + env(safe-area-inset-top))', paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 60 }}>
        <img src="/logo.png" alt="Clarity" style={{ width: 240, height: 240, objectFit: 'contain', marginBottom: 16 }} />
        <h1 style={{ color: '#fff', fontSize: 38, fontWeight: 400, letterSpacing: 0, fontFamily: '-apple-system, "SF Pro Text", sans-serif', marginBottom: 12 }}>Clarity</h1>
        <p style={{ color: '#fff', fontSize: 16, textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
          Suivez vos finances en toute clarté
        </p>
      </div>
      <button onClick={onDone}
        style={{ background: '#C9A040', color: '#fff', border: 'none', borderRadius: 16, padding: '16px 48px', fontSize: 17, fontWeight: 700, cursor: 'pointer', width: '100%', maxWidth: 300 }}>
        Commencer
      </button>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [onboarded, setOnboarded] = useState(() => Storage.getAccounts().length > 0);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [isStandalone, setIsStandalone] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
  );

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    const handler = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (!onboarded) {
    return <Onboarding onDone={() => { setTab('accounts'); setOnboarded(true); }} />;
  }

  return (
    <div className="app">
      <div style={{ background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0px 16px', paddingTop: 'env(safe-area-inset-top)', flexShrink: 0 }}>
        <img src="/logo.png" alt="Clarity" style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 6 }} />
      </div>
      <div className="content">
        <div key={tab} className="screen-enter">
          {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
          {tab === 'transactions' && <Transactions />}
          {tab === 'installments' && <Installments />}
          {tab === 'simulator' && <Simulator />}
          {tab === 'projection' && <Projection />}
          {tab === 'accounts' && <Accounts />}
        </div>
      </div>
      <nav className="tab-bar" style={{ paddingBottom: isStandalone ? 30 : 8 }}>
        {TABS.map(t => {
          const active = tab === t.id;
          const color = active ? '#C9A040' : '#fff';
          return (
            <button key={t.id} className={`tab-btn ${active ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <t.Icon color={color} />
              <span className="tab-label" style={{ color }}>{t.label}</span>
            </button>
          );
        })}
      </nav>
      <DialogModal state={dialogState} setState={setDialogState} />
    </div>
  );
}
