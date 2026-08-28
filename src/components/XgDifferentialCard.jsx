import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function XgDifferentialCard({ teamName = 'PSG', lastMatches = [] }) {
  // Sample 5 last matches xG vs real score data
  const matches = lastMatches.length > 0 ? lastMatches : [
    { opponent: 'Marseille', realGoals: 2, xG: 1.4, diff: +0.6, status: 'over' },
    { opponent: 'Lyon', realGoals: 1, xG: 2.1, diff: -1.1, status: 'under' },
    { opponent: 'Monaco', realGoals: 3, xG: 2.8, diff: +0.2, status: 'over' },
    { opponent: 'Lille', realGoals: 0, xG: 1.2, diff: -1.2, status: 'under' },
    { opponent: 'Rennes', realGoals: 2, xG: 1.7, diff: +0.3, status: 'over' },
  ];

  const avgDiff = (matches.reduce((s, m) => s + m.diff, 0) / matches.length).toFixed(2);
  const isOverperforming = avgDiff >= 0;

  return (
    <div style={{
      background: 'var(--glass-primary)',
      border: '1px solid var(--ivory-border)',
      borderRadius: 18,
      padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div className="card-section-title">Différentiel xG vs Score Réel</div>
          <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 2 }}>
            Performance offensive des 5 derniers matchs ({teamName})
          </div>
        </div>

        <div style={{
          padding: '6px 12px',
          borderRadius: 10,
          background: isOverperforming ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${isOverperforming ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: isOverperforming ? 'var(--positive)' : 'var(--danger)',
          fontSize: 11,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          {isOverperforming ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {isOverperforming ? `Surperformance (+${avgDiff} buts/m)` : `Sous-performance (${avgDiff} buts/m)`}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {matches.map((m, idx) => (
          <div key={idx} style={{
            background: 'var(--obsidian-3)',
            border: '1px solid var(--ivory-border)',
            borderRadius: 12,
            padding: 12,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: 'var(--neutral)', fontWeight: 600, marginBottom: 4 }}>
              vs {m.opponent}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ivory)', fontFamily: 'var(--font-ui)' }}>
              {m.realGoals} <span style={{ fontSize: 10, color: 'var(--neutral)', fontWeight: 400 }}>buts</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 2 }}>
              xG : {m.xG}
            </div>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              marginTop: 6,
              color: m.diff >= 0 ? 'var(--positive)' : 'var(--danger)',
            }}>
              {m.diff >= 0 ? `+${m.diff}` : m.diff}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
