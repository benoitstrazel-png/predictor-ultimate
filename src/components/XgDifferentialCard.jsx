import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import TeamLogo from './ui/TeamLogo';
import { getTeamRecentMatches } from '../utils/tacticalAnalysis';

export default function XgDifferentialCard({ homeTeam = 'Liverpool', awayTeam = 'Nottingham Forest', onSelectMatch = null }) {
  const [activeTeam, setActiveTeam] = useState('home');

  const targetTeam = activeTeam === 'home' ? homeTeam : awayTeam;
  const recentMatches = useMemo(() => getTeamRecentMatches(targetTeam, 5), [targetTeam]);

  const avgDiff = useMemo(() => {
    if (recentMatches.length === 0) return '0.00';
    const sum = recentMatches.reduce((s, m) => s + (m.diff || 0), 0);
    return (sum / recentMatches.length).toFixed(2);
  }, [recentMatches]);

  const isOverperforming = parseFloat(avgDiff) >= 0;

  return (
    <div style={{
      background: '#121215',
      border: '1px solid #27272a',
      borderRadius: 6,
      padding: 20,
    }}>
      {/* Header with Team Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="card-section-title">Différentiel xG vs Score Réel (Finition & Efficacité)</div>
          <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
            Performance offensive des 5 derniers matchs de championnat officiel
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Team Switcher Tabs */}
          <div style={{
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: 4,
            padding: 3,
            display: 'flex',
            gap: 4,
          }}>
            <button
              onClick={() => setActiveTeam('home')}
              style={{
                background: activeTeam === 'home' ? 'var(--positive-bg, rgba(34, 197, 94, 0.2))' : 'transparent',
                color: activeTeam === 'home' ? '#10b981' : '#71717a',
                border: activeTeam === 'home' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid transparent',
                borderRadius: 4,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <TeamLogo teamName={homeTeam} size="xs" />
              {homeTeam}
            </button>

            <button
              onClick={() => setActiveTeam('away')}
              style={{
                background: activeTeam === 'away' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                color: activeTeam === 'away' ? '#ef4444' : '#71717a',
                border: activeTeam === 'away' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent',
                borderRadius: 4,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <TeamLogo teamName={awayTeam} size="xs" />
              {awayTeam}
            </button>
          </div>

          {/* Diagnostic Badge */}
          <div style={{
            padding: '6px 12px',
            borderRadius: 4,
            background: isOverperforming ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            border: `1px solid ${isOverperforming ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: isOverperforming ? '#10b981' : '#ef4444',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            {isOverperforming ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {isOverperforming ? `Surperformance (+${avgDiff} b/m)` : `Sous-performance (${avgDiff} b/m)`}
          </div>
        </div>
      </div>

      {/* 5 Matches Grid */}
      {recentMatches.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#71717a', fontSize: 12 }}>
          Aucune donnée de match récente disponible pour {targetTeam}.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {recentMatches.map((m, idx) => (
            <div
              key={idx}
              onClick={() => onSelectMatch && onSelectMatch(m.match)}
              style={{
                background: '#121215',
                border: '1px solid #27272a',
                borderRadius: 4,
                padding: 12,
                textAlign: 'center',
                cursor: onSelectMatch ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 11,
                color: '#fafafa',
                fontWeight: 700,
                marginBottom: 6,
              }}>
                <span style={{ fontSize: 9, color: '#71717a' }}>{m.venue === 'Domicile' ? 'vs' : '@'}</span>
                <TeamLogo teamName={m.opponent} size="xs" />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 85 }}>
                  {m.opponent}
                </span>
              </div>

              <div style={{ fontSize: 16, fontWeight: 800, color: '#fafafa', fontFamily: 'var(--font-ui)' }}>
                {m.realGoals} <span style={{ fontSize: 10, color: '#71717a', fontWeight: 400 }}>buts</span>
              </div>

              <div style={{ fontSize: 10, color: '#06b6d4', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Target size={11} /> xG : {m.xG}
              </div>

              <div style={{
                fontSize: 11,
                fontWeight: 800,
                marginTop: 6,
                padding: '2px 6px',
                borderRadius: 6,
                background: m.diff >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: m.diff >= 0 ? '#10b981' : '#ef4444',
                display: 'inline-block',
              }}>
                {m.diff >= 0 ? `+${m.diff}` : m.diff}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
