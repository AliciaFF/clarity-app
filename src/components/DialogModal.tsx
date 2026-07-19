import { useEffect } from 'react';
import { dialog } from '../dialog';

export type DialogState = {
  message: string;
  type: 'alert' | 'confirm';
  onOk: () => void;
  onCancel?: () => void;
} | null;

export default function DialogModal({ state, setState }: { state: DialogState; setState: (s: DialogState) => void }) {
  useEffect(() => {
    dialog.register(opts => setState(opts));
  }, [setState]);

  if (!state) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 340, padding: 24 }}>
        <p style={{ fontSize: 15, color: '#263238', lineHeight: 1.6, marginBottom: 24, whiteSpace: 'pre-line' }}>{state.message}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn-primary" onClick={() => { state.onOk(); setState(null); }}>
            {state.type === 'confirm' ? 'Confirmer' : 'OK'}
          </button>
          {state.type === 'confirm' && (
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => { state.onCancel?.(); setState(null); }}>
              Annuler
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
