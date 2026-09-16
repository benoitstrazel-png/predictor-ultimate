import React from 'react';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Frontend Runtime Error caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    window.location.href = '/main';
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse at top, #111827, #080B14)',
          color: 'var(--ivory)',
          padding: '24px',
          fontFamily: 'var(--font-ui)',
        }}>
          <div style={{
            maxWidth: 520,
            width: '100%',
            background: 'var(--glass-primary)',
            border: '1px solid var(--gold-border)',
            borderRadius: 24,
            padding: 36,
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(20px)',
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: 'var(--danger)',
            }}>
              <ShieldAlert size={28} />
            </div>

            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.8rem',
              color: 'var(--ivory)',
              margin: '0 0 8px',
            }}>
              Interruption Temporaire d'Affichage
            </h2>

            <p style={{
              fontSize: 13,
              color: 'var(--neutral)',
              lineHeight: 1.6,
              marginBottom: 28,
            }}>
              Une incohérence ponctuelle de rendu a été interceptée par le système de sécurité. L'intégrité de vos données reste 100% préservée.
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: this.state.error ? 16 : 0 }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '10px 20px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, var(--gold), #8B6A3C)',
                  color: 'var(--obsidian)',
                  fontWeight: 700,
                  fontSize: 12,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <RefreshCw size={14} /> Recharger la vue
              </button>

              <button
                onClick={this.handleHome}
                style={{
                  padding: '10px 20px',
                  borderRadius: 12,
                  background: 'var(--ivory-ghost)',
                  border: '1px solid var(--ivory-border)',
                  color: 'var(--ivory)',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Home size={14} /> Retour au Hub
              </button>
            </div>

            {this.state.error && (
              <div style={{ marginTop: 16 }}>
                <button
                  onClick={this.toggleDetails}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--gold)',
                    fontSize: 11,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    opacity: 0.85,
                  }}
                >
                  {this.state.showDetails ? 'Masquer les détails techniques' : 'Détails techniques du rapport'}
                </button>

                {this.state.showDetails && (
                  <div style={{
                    marginTop: 12,
                    padding: 12,
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderRadius: 8,
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    textAlign: 'left',
                    maxHeight: 180,
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: '#f87171',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    <strong>{this.state.error.toString()}</strong>
                    {this.state.errorInfo?.componentStack && (
                      <div style={{ color: 'var(--neutral)', marginTop: 6, fontSize: 10 }}>
                        {this.state.errorInfo.componentStack}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
