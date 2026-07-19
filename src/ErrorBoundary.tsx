import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: '#263238', marginBottom: 8 }}>Une erreur est survenue</h2>
          <p style={{ color: '#90A4AE', fontSize: 14, marginBottom: 24 }}>
            {this.state.error.message}
          </p>
          <button
            onClick={this.reset}
            style={{ background: '#C9A040', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
