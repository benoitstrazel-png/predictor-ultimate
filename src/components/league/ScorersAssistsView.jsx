import React, { useState, useMemo } from 'react';
import TeamLogo from '../ui/TeamLogo';
import { Search, Trophy, Flame, Target, Award, Crosshair, UserCheck, Shield } from 'lucide-react';

export default function ScorersAssistsView({ scorers = [], assists = [], leagueId, season }) {
  const [activeTab, setActiveTab] = useState('SCORERS'); // 'SCORERS' | 'ASSISTS'
  const [searchQuery, setSearchQuery] = useState('');

  const currentList = activeTab === 'SCORERS' ? scorers : assists;

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return currentList;
    const q = searchQuery.toLowerCase().trim();
    return currentList.filter(
      (p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
    );
  }, [currentList, searchQuery]);

  const top3 = filteredList.slice(0, 3);
  const remaining = filteredList.slice(3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Header Controls : Scorers / Assists Toggle + Search ── */}
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
        {/* Toggle Buteurs / Passeurs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0, 0, 0, 0.3)', padding: 4, borderRadius: 10 }}>
          <button
            onClick={() => setActiveTab('SCORERS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: activeTab === 'SCORERS' ? 700 : 500,
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.2s',
              background: activeTab === 'SCORERS' ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.25), rgba(139, 106, 60, 0.2))' : 'transparent',
              color: activeTab === 'SCORERS' ? '#f5d77f' : 'rgba(245, 240, 232, 0.6)',
              boxShadow: activeTab === 'SCORERS' ? '0 2px 8px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(212, 175, 55, 0.4)' : 'none',
            }}
          >
            <Flame size={15} color={activeTab === 'SCORERS' ? '#f5d77f' : 'currentColor'} />
            Classement des Buteurs ({scorers.length})
          </button>

          <button
            onClick={() => setActiveTab('ASSISTS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: activeTab === 'ASSISTS' ? 700 : 500,
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.2s',
              background: activeTab === 'ASSISTS' ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.25), rgba(139, 106, 60, 0.2))' : 'transparent',
              color: activeTab === 'ASSISTS' ? '#f5d77f' : 'rgba(245, 240, 232, 0.6)',
              boxShadow: activeTab === 'ASSISTS' ? '0 2px 8px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(212, 175, 55, 0.4)' : 'none',
            }}
          >
            <Target size={15} color={activeTab === 'ASSISTS' ? '#f5d77f' : 'currentColor'} />
            Classement des Passeurs ({assists.length})
          </button>
        </div>

        {/* Search */}
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
            placeholder={activeTab === 'SCORERS' ? 'Chercher un buteur...' : 'Chercher un passeur...'}
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

      {/* ── Top 3 Podium Stage ── */}
      {top3.length > 0 && !searchQuery && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {top3.map((player, idx) => {
            const isFirst = idx === 0;
            const isSecond = idx === 1;
            const isThird = idx === 2;

            const crownColor = isFirst ? '#ffd700' : isSecond ? '#c0c0c0' : '#cd7f32';
            const borderGlow = isFirst
              ? 'rgba(255, 215, 0, 0.35)'
              : isSecond
              ? 'rgba(192, 192, 192, 0.25)'
              : 'rgba(205, 127, 50, 0.2)';
            const bgGrad = isFirst
              ? 'linear-gradient(145deg, rgba(30, 26, 16, 0.9) 0%, rgba(18, 22, 32, 0.95) 100%)'
              : 'linear-gradient(145deg, rgba(22, 28, 40, 0.85) 0%, rgba(14, 18, 26, 0.95) 100%)';

            const statValue = activeTab === 'SCORERS' ? player.goals : player.assists;
            const statLabel = activeTab === 'SCORERS' ? 'Buts' : 'Passes';

            return (
              <div
                key={player.name}
                style={{
                  background: bgGrad,
                  border: `1px solid ${borderGlow}`,
                  borderRadius: 16,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: `0 8px 24px rgba(0, 0, 0, 0.3), inset 0 0 20px ${borderGlow}`,
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                {/* Top Badge (Rank) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 20,
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: `1px solid ${crownColor}55`,
                      fontSize: 11,
                      fontWeight: 800,
                      color: crownColor,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <Trophy size={13} color={crownColor} />
                    #{idx + 1} {isFirst ? 'MEILLEUR' : ''}
                  </div>

                  <TeamLogo teamName={player.team} size="sm" />
                </div>

                {/* Player Profile Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: `2px solid ${crownColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {player.photoUrl ? (
                      <img
                        src={player.photoUrl}
                        alt={player.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                    ) : (
                      <span style={{ fontSize: 18, fontWeight: 800, color: crownColor }}>
                        {player.name.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ivory)' }}>
                      {player.name}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(245, 240, 232, 0.6)' }}>
                      {player.team}
                    </span>
                  </div>
                </div>

                {/* Primary Stat Counter */}
                <div
                  style={{
                    marginTop: 'auto',
                    padding: '12px 14px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 10, color: 'rgba(245, 240, 232, 0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {statLabel}
                    </span>
                    <span style={{ fontSize: 24, fontWeight: 900, color: '#f5d77f', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
                      {statValue}
                    </span>
                  </div>

                  {activeTab === 'SCORERS' && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 10, color: 'rgba(245, 240, 232, 0.5)' }}>Dont penaltys</span>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(245, 240, 232, 0.8)', fontFamily: 'var(--font-mono)' }}>
                        {player.penalties || 0}
                      </div>
                    </div>
                  )}

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 10, color: 'rgba(245, 240, 232, 0.5)' }}>Ratio / match</span>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                      {player.ratio}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Full Table (All Players) ── */}
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
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 640 }}>
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
                <th style={{ padding: '14px 16px', minWidth: 200 }}>Joueur</th>
                <th style={{ padding: '14px 16px', minWidth: 160 }}>Club</th>
                <th style={{ padding: '14px 14px', textAlign: 'center', color: '#f5d77f' }}>
                  {activeTab === 'SCORERS' ? 'Buts' : 'Passes'}
                </th>
                {activeTab === 'SCORERS' && (
                  <th style={{ padding: '14px 14px', textAlign: 'center' }}>Penaltys</th>
                )}
                {activeTab === 'SCORERS' && (
                  <th style={{ padding: '14px 14px', textAlign: 'center' }}>Dans le jeu</th>
                )}
                <th style={{ padding: '14px 14px', textAlign: 'center' }}>Matchs</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>Ratio / match</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((player) => {
                const statValue = activeTab === 'SCORERS' ? player.goals : player.assists;

                return (
                  <tr
                    key={`${player.name}_${player.team}`}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.15s ease',
                      fontSize: 13,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(212, 175, 55, 0.04)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Rank */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          color: player.rank <= 3 ? '#f5d77f' : 'rgba(245, 240, 232, 0.7)',
                          fontSize: 12,
                        }}
                      >
                        {player.rank}
                      </span>
                    </td>

                    {/* Player Name + Avatar */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {player.photoUrl ? (
                            <img
                              src={player.photoUrl}
                              alt={player.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => (e.target.style.display = 'none')}
                            />
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)' }}>
                              {player.name.substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--ivory)' }}>
                          {player.name}
                        </span>
                      </div>
                    </td>

                    {/* Club */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TeamLogo teamName={player.team} size="xs" />
                        <span style={{ color: 'rgba(245, 240, 232, 0.8)', fontSize: 13 }}>
                          {player.team}
                        </span>
                      </div>
                    </td>

                    {/* Goals or Assists */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: 14,
                          fontFamily: 'var(--font-mono)',
                          color: '#f5d77f',
                        }}
                      >
                        {statValue}
                      </span>
                    </td>

                    {/* Penalties */}
                    {activeTab === 'SCORERS' && (
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'rgba(245, 240, 232, 0.6)' }}>
                        {player.penalties || 0}
                      </td>
                    )}

                    {/* Open Play */}
                    {activeTab === 'SCORERS' && (
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'rgba(245, 240, 232, 0.7)' }}>
                        {player.openPlayGoals || 0}
                      </td>
                    )}

                    {/* Matches */}
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'rgba(245, 240, 232, 0.6)' }}>
                      {player.matchesCount}
                    </td>

                    {/* Ratio */}
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#34d399' }}>
                      {player.ratio}
                    </td>
                  </tr>
                );
              })}

              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(245, 240, 232, 0.4)' }}>
                    Aucun joueur trouvé pour cette recherche.
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
