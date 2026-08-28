import React from 'react';

export default function PassingNetwork({ teamName = 'PSG' }) {
  // Key passer-scorer connections
  const connections = [
    { passer: 'Dembélé', scorer: 'Barcola', passes: 14, xA: 2.1, rating: 'Élite' },
    { passer: 'Vitinha', passerPos: 'MC', scorer: 'Dembélé', passes: 11, xA: 1.8, rating: 'Élevé' },
    { passer: 'Hakimi', passerPos: 'DD', scorer: 'Ramos', passes: 9, xA: 1.4, rating: 'Régulier' },
    { passer: 'Neves', passerPos: 'MC', scorer: 'Barcola', passes: 8, xA: 1.2, rating: 'Régulier' },
  ];

  return (
    <div style={{
      background: 'var(--glass-primary)',
      border: '1px solid var(--ivory-border)',
      borderRadius: 18,
      padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="card-section-title">Synergy & Passing Network</div>
          <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 2 }}>
            Connexions préférentielles passeur ➔ buteur ({teamName})
          </div>
        </div>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          padding: '3px 9px',
          borderRadius: 6,
          background: 'var(--gold-muted)',
          border: '1px solid var(--gold-border)',
          color: 'var(--gold)',
        }}>
          Saison 2026-27
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {connections.map((c, idx) => (
          <div key={idx} style={{
            background: 'var(--obsidian-3)',
            border: '1px solid var(--ivory-border)',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'var(--gold-muted)',
                border: '1px solid var(--gold-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 800,
                color: 'var(--gold)',
              }}>
                #{idx + 1}
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ivory)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{c.passer}</span>
                  <span style={{ color: 'var(--gold)', fontSize: 11 }}>➔</span>
                  <span>{c.scorer}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--neutral)', marginTop: 2 }}>
                  {c.passes} passes clés · xA accumulé : <strong style={{ color: 'var(--positive)' }}>{c.xA}</strong>
                </div>
              </div>
            </div>

            <div style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '4px 10px',
              borderRadius: 8,
              background: c.rating === 'Élite' ? 'rgba(34,197,94,0.15)' : 'var(--ivory-ghost)',
              color: c.rating === 'Élite' ? 'var(--positive)' : 'var(--ivory-dim)',
              border: `1px solid ${c.rating === 'Élite' ? 'rgba(34,197,94,0.3)' : 'var(--ivory-border)'}`,
            }}>
              {c.rating}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
