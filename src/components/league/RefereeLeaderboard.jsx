import React, { useState, useMemo } from 'react';
import { Search, Scale, AlertOctagon, Flag, Shield, Activity, Award } from 'lucide-react';

export default function RefereeLeaderboard({ refereeStats = [], leagueId, season }) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredReferees = useMemo(() => {
    if (!searchQuery.trim()) return refereeStats;
    const q = searchQuery.toLowerCase().trim();
    return refereeStats.filter((r) => r.name.toLowerCase().includes(q));
  }, [refereeStats, searchQuery]);

  // Calcul des moyennes globales du corps arbitral
  const summaryKpis = useMemo(() => {
    if (!refereeStats || refereeStats.length === 0) {
      return { totalMatches: 0, avgFouls: 0, avgYellows: 0, totalPenalties: 0 };
    }
    const totalMatches = refereeStats.reduce((acc, r) => acc + r.matchesCount, 0);
    const totalFouls = refereeStats.reduce((acc, r) => acc + r.totalFouls, 0);
    const totalYellows = refereeStats.reduce((acc, r) => acc + r.totalYellows, 0);
    const totalPenalties = refereeStats.reduce((acc, r) => acc + r.totalPenalties, 0);

    return {
      totalMatches,
      avgFouls: totalMatches > 0 ? (totalFouls / totalMatches).toFixed(1) : 0,
      avgYellows: totalMatches > 0 ? (totalYellows / totalMatches).toFixed(2) : 0,
      totalPenalties,
    };
  }, [refereeStats]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Summary KPI Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(20, 26, 38, 0.8) 0%, rgba(14, 18, 26, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6',
            }}
          >
            <Scale size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(245, 240, 232, 0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Arbitres Actifs
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ivory)', fontFamily: 'var(--font-mono)' }}>
              {refereeStats.length}
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, rgba(20, 26, 38, 0.8) 0%, rgba(14, 18, 26, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
            }}
          >
            <Activity size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(245, 240, 232, 0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Moy. Fautes / Match
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
              {summaryKpis.avgFouls}
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, rgba(20, 26, 38, 0.8) 0%, rgba(14, 18, 26, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: 'rgba(250, 204, 21, 0.15)',
              border: '1px solid rgba(250, 204, 21, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#facc15',
            }}
          >
            <Flag size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(245, 240, 232, 0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Moy. Cartons Jaunes / m
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#facc15', fontFamily: 'var(--font-mono)' }}>
              {summaryKpis.avgYellows}
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, rgba(20, 26, 38, 0.8) 0%, rgba(14, 18, 26, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: 'rgba(212, 175, 55, 0.15)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f5d77f',
            }}
          >
            <AlertOctagon size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(245, 240, 232, 0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Penaltys Accordés
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f5d77f', fontFamily: 'var(--font-mono)' }}>
              {summaryKpis.totalPenalties}
            </div>
          </div>
        </div>
      </div>

      {/* ── Search Bar ── */}
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
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ivory)' }}>
          Baromètre & Profils d'Arbitrage
        </span>

        <div style={{ position: 'relative', minWidth: 240 }}>
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
            placeholder="Rechercher un arbitre..."
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
            }}
            onFocus={(e) => (e.target.style.borderColor = 'rgba(212, 175, 55, 0.5)')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
          />
        </div>
      </div>

      {/* ── Referee Leaderboard Table ── */}
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
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 740 }}>
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
                <th style={{ padding: '14px 16px', width: 50, textAlign: 'center' }}>#</th>
                <th style={{ padding: '14px 16px', minWidth: 200 }}>Arbitre</th>
                <th style={{ padding: '14px 14px', textAlign: 'center', width: 80 }}>Matchs</th>
                <th style={{ padding: '14px 14px', textAlign: 'center', width: 110 }}>Fautes / Match</th>
                <th style={{ padding: '14px 14px', textAlign: 'center', width: 120 }}>🟨 Jaunes (Moy)</th>
                <th style={{ padding: '14px 14px', textAlign: 'center', width: 120 }}>🟥 Rouges (Moy)</th>
                <th style={{ padding: '14px 14px', textAlign: 'center', width: 120 }}>Penaltys (Moy)</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', minWidth: 140 }}>Indice Sévérité</th>
              </tr>
            </thead>
            <tbody>
              {filteredReferees.map((ref) => {
                const isStrict = ref.severityScore >= 70;
                const isModerate = ref.severityScore >= 50 && ref.severityScore < 70;
                const scoreColor = isStrict ? '#ef4444' : isModerate ? '#f59e0b' : '#10b981';

                return (
                  <tr
                    key={ref.name}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.15s ease',
                      fontSize: 13,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(212, 175, 55, 0.04)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          color: 'rgba(245, 240, 232, 0.7)',
                          fontSize: 12,
                        }}
                      >
                        {ref.rank}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(139, 106, 60, 0.15))',
                            border: '1px solid rgba(212, 175, 55, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#f5d77f',
                            fontWeight: 800,
                            fontSize: 11,
                            flexShrink: 0,
                          }}
                        >
                          <Scale size={14} />
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--ivory)' }}>
                          {ref.name}
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#f5d77f' }}>
                      {ref.matchesCount}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#38bdf8' }}>
                      {ref.avgFouls} <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)' }}>({ref.totalFouls})</span>
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#facc15' }}>
                      {ref.avgYellows} <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)' }}>({ref.totalYellows})</span>
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: ref.totalReds > 0 ? '#ef4444' : 'rgba(245,240,232,0.3)' }}>
                      {ref.avgReds} <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)' }}>({ref.totalReds})</span>
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'rgba(245, 240, 232, 0.8)' }}>
                      {ref.avgPenalties} <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)' }}>({ref.totalPenalties})</span>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 60,
                            height: 6,
                            borderRadius: 3,
                            background: 'rgba(255, 255, 255, 0.1)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${ref.severityScore}%`,
                              height: '100%',
                              background: scoreColor,
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: scoreColor,
                            minWidth: 32,
                          }}
                        >
                          {ref.severityScore}/100
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredReferees.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(245, 240, 232, 0.4)' }}>
                    Aucun arbitre trouvé pour cette recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
