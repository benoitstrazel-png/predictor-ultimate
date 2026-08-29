import React, { useState, useMemo } from 'react';
import TeamLogo from '../ui/TeamLogo';
import { Search, Trophy, ShieldAlert, Award, ChevronRight, TrendingUp, Info } from 'lucide-react';

export default function StandingsTable({ standings = [], viewMode, setViewMode, leagueId, season }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredFormMatch, setHoveredFormMatch] = useState(null);

  const filteredStandings = useMemo(() => {
    if (!searchQuery.trim()) return standings;
    const q = searchQuery.toLowerCase().trim();
    return standings.filter((s) => s.team.toLowerCase().includes(q));
  }, [standings, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Top Controls Bar : View Mode Filters + Search ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '14px 18px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: 14,
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* Toggle Général / Domicile / Extérieur */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0, 0, 0, 0.3)', padding: 4, borderRadius: 10 }}>
          {[
            { key: 'ALL', label: 'Général' },
            { key: 'HOME', label: 'Domicile' },
            { key: 'AWAY', label: 'Extérieur' },
          ].map(({ key, label }) => {
            const active = viewMode === key;
            return (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: active ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.25), rgba(139, 106, 60, 0.2))' : 'transparent',
                  color: active ? '#f5d77f' : 'rgba(245, 240, 232, 0.6)',
                  boxShadow: active ? '0 2px 8px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(212, 175, 55, 0.4)' : 'none',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', minWidth: 220 }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(245, 240, 232, 0.4)',
            }}
          />
          <input
            type="text"
            placeholder="Rechercher un club..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: 10,
              fontSize: 13,
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--ivory)',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'rgba(212, 175, 55, 0.5)')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
          />
        </div>
      </div>

      {/* ── Table Container ── */}
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(20, 26, 38, 0.85) 0%, rgba(13, 17, 26, 0.95) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 780 }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.06em',
                  color: 'rgba(245, 240, 232, 0.5)',
                  textTransform: 'uppercase',
                }}
              >
                <th style={{ padding: '14px 16px', width: 44, textAlign: 'center' }}>#</th>
                <th style={{ padding: '14px 16px', minWidth: 190 }}>Club</th>
                <th style={{ padding: '14px 10px', textAlign: 'center', width: 50 }}>MJ</th>
                <th style={{ padding: '14px 10px', textAlign: 'center', width: 50 }}>V</th>
                <th style={{ padding: '14px 10px', textAlign: 'center', width: 50 }}>N</th>
                <th style={{ padding: '14px 10px', textAlign: 'center', width: 50 }}>D</th>
                <th style={{ padding: '14px 10px', textAlign: 'center', width: 55 }}>BP</th>
                <th style={{ padding: '14px 10px', textAlign: 'center', width: 55 }}>BC</th>
                <th style={{ padding: '14px 10px', textAlign: 'center', width: 60 }}>Diff</th>
                <th style={{ padding: '14px 14px', textAlign: 'center', width: 65, color: '#f5d77f' }}>Pts</th>
                <th style={{ padding: '14px 12px', textAlign: 'center', width: 75 }}>xG +/-</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', width: 140 }}>Forme (5D)</th>
              </tr>
            </thead>
            <tbody>
              {filteredStandings.map((teamData) => {
                const { rank, team, played, won, drawn, lost, goalsFor, goalsAgainst, goalDiff, points, zone, last5, xgFor, xgAgainst } = teamData;
                const xgDiff = (xgFor - xgAgainst).toFixed(1);
                const isPositiveDiff = goalDiff > 0;
                const isNegativeDiff = goalDiff < 0;

                return (
                  <tr
                    key={team}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.15s ease',
                      fontSize: 13,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(212, 175, 55, 0.04)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Rank + Zone color indicator bar */}
                    <td style={{ padding: '12px 14px', textAlign: 'center', position: 'relative' }}>
                      {zone && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 4,
                            bottom: 4,
                            width: 3,
                            borderRadius: '0 3px 3px 0',
                            background: zone.color,
                            boxShadow: `0 0 8px ${zone.color}`,
                          }}
                          title={zone.label}
                        />
                      )}
                      <span
                        style={{
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          color: rank <= 3 ? '#f5d77f' : 'rgba(245, 240, 232, 0.8)',
                          fontSize: 12,
                        }}
                      >
                        {rank}
                      </span>
                    </td>

                    {/* Club Logo + Name + Zone pill */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <TeamLogo teamName={team} size="sm" />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--ivory)', letterSpacing: '-0.01em' }}>
                            {team}
                          </span>
                          {zone && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: zone.color,
                                letterSpacing: '0.02em',
                                marginTop: 1,
                              }}
                            >
                              {zone.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Matchs Joués */}
                    <td style={{ padding: '12px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'rgba(245, 240, 232, 0.7)' }}>
                      {played}
                    </td>

                    {/* Victoires */}
                    <td style={{ padding: '12px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#10b981', fontWeight: 600 }}>
                      {won}
                    </td>

                    {/* Nuls */}
                    <td style={{ padding: '12px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'rgba(245, 240, 232, 0.6)' }}>
                      {drawn}
                    </td>

                    {/* Défaites */}
                    <td style={{ padding: '12px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#ef4444', fontWeight: 500 }}>
                      {lost}
                    </td>

                    {/* Buts Pour */}
                    <td style={{ padding: '12px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'rgba(245, 240, 232, 0.8)' }}>
                      {goalsFor}
                    </td>

                    {/* Buts Contre */}
                    <td style={{ padding: '12px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'rgba(245, 240, 232, 0.6)' }}>
                      {goalsAgainst}
                    </td>

                    {/* Différence */}
                    <td
                      style={{
                        padding: '12px 10px',
                        textAlign: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: isPositiveDiff ? '#10b981' : isNegativeDiff ? '#ef4444' : 'rgba(245, 240, 232, 0.5)',
                      }}
                    >
                      {isPositiveDiff ? `+${goalDiff}` : goalDiff}
                    </td>

                    {/* Points */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <div
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(139, 106, 60, 0.15))',
                          border: '1px solid rgba(212, 175, 55, 0.35)',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          fontSize: 13,
                          color: '#f5d77f',
                        }}
                      >
                        {points}
                      </div>
                    </td>

                    {/* xG Diff */}
                    <td style={{ padding: '12px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: xgDiff > 0 ? '#34d399' : '#f87171' }}>
                      {xgDiff > 0 ? `+${xgDiff}` : xgDiff}
                    </td>

                    {/* Forme (5 derniers matchs) */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        {(last5 || []).map((fm, fIdx) => {
                          const isWin = fm.result === 'W';
                          const isDraw = fm.result === 'D';
                          const bg = isWin ? '#10b981' : isDraw ? '#f59e0b' : '#ef4444';
                          const text = isWin ? 'V' : isDraw ? 'N' : 'D';

                          return (
                            <div
                              key={fIdx}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 5,
                                background: bg,
                                color: '#ffffff',
                                fontSize: 10,
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: 'var(--font-ui)',
                                cursor: 'default',
                                boxShadow: `0 2px 5px rgba(0,0,0,0.3)`,
                              }}
                              title={`${fm.date || ''} : ${team} ${fm.score} ${fm.opponent} (${isWin ? 'Victoire' : isDraw ? 'Nul' : 'Défaite'})`}
                            >
                              {text}
                            </div>
                          );
                        })}
                        {(!last5 || last5.length === 0) && (
                          <span style={{ fontSize: 11, color: 'rgba(245,240,232,0.3)' }}>-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Table Footer & Zone Legends ── */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: 11,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ color: 'rgba(245, 240, 232, 0.5)', fontWeight: 600 }}>Zones :</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6' }} />
              <span style={{ color: 'rgba(245, 240, 232, 0.7)' }}>Ligue des Champions</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#f97316' }} />
              <span style={{ color: 'rgba(245, 240, 232, 0.7)' }}>Ligue Europa</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981' }} />
              <span style={{ color: 'rgba(245, 240, 232, 0.7)' }}>Ligue Conférence</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#eab308' }} />
              <span style={{ color: 'rgba(245, 240, 232, 0.7)' }}>Barrages</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444' }} />
              <span style={{ color: 'rgba(245, 240, 232, 0.7)' }}>Relégation</span>
            </div>
          </div>

          <div style={{ color: 'rgba(245, 240, 232, 0.4)', fontFamily: 'var(--font-mono)' }}>
            Départage : Pts &gt; Diff &gt; Buts Marqués
          </div>
        </div>
      </div>
    </div>
  );
}
