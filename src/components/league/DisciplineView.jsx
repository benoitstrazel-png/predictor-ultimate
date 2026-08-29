import React, { useState, useMemo } from 'react';
import TeamLogo from '../ui/TeamLogo';
import { Search, ShieldAlert, ShieldCheck, AlertTriangle, Flame, Award } from 'lucide-react';

export default function DisciplineView({ disciplineData = { players: [], teams: [] }, leagueId, season }) {
  const [activeTab, setActiveTab] = useState('PLAYERS'); // 'PLAYERS' | 'TEAMS'
  const [searchQuery, setSearchQuery] = useState('');

  const { players = [], teams = [] } = disciplineData;

  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return players;
    const q = searchQuery.toLowerCase().trim();
    return players.filter(
      (p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
    );
  }, [players, searchQuery]);

  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return teams;
    const q = searchQuery.toLowerCase().trim();
    return teams.filter((t) => t.team.toLowerCase().includes(q));
  }, [teams, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header Controls : Toggle + Search ── */}
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
        {/* Toggle Joueurs / Fair-play Équipes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0, 0, 0, 0.3)', padding: 4, borderRadius: 10 }}>
          <button
            onClick={() => setActiveTab('PLAYERS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: activeTab === 'PLAYERS' ? 700 : 500,
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.2s',
              background: activeTab === 'PLAYERS' ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.25), rgba(139, 106, 60, 0.2))' : 'transparent',
              color: activeTab === 'PLAYERS' ? '#f5d77f' : 'rgba(245, 240, 232, 0.6)',
              boxShadow: activeTab === 'PLAYERS' ? '0 2px 8px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(212, 175, 55, 0.4)' : 'none',
            }}
          >
            <ShieldAlert size={15} color={activeTab === 'PLAYERS' ? '#f5d77f' : 'currentColor'} />
            Cartons Individuels ({players.length})
          </button>

          <button
            onClick={() => setActiveTab('TEAMS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: activeTab === 'TEAMS' ? 700 : 500,
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.2s',
              background: activeTab === 'TEAMS' ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.25), rgba(139, 106, 60, 0.2))' : 'transparent',
              color: activeTab === 'TEAMS' ? '#f5d77f' : 'rgba(245, 240, 232, 0.6)',
              boxShadow: activeTab === 'TEAMS' ? '0 2px 8px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(212, 175, 55, 0.4)' : 'none',
            }}
          >
            <ShieldCheck size={15} color={activeTab === 'TEAMS' ? '#f5d77f' : 'currentColor'} />
            Fair-Play & Fautes par Équipe ({teams.length})
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
            placeholder={activeTab === 'PLAYERS' ? 'Chercher un joueur...' : 'Chercher un club...'}
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

      {/* ── Tab Content ── */}
      {activeTab === 'PLAYERS' ? (
        /* Table des Cartons Individuels */
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
                  <th style={{ padding: '14px 14px', textAlign: 'center', width: 90 }}>🟨 Jaunes</th>
                  <th style={{ padding: '14px 14px', textAlign: 'center', width: 90 }}>🟥 Rouges</th>
                  <th style={{ padding: '14px 14px', textAlign: 'center', width: 90 }}>Total</th>
                  <th style={{ padding: '14px 14px', textAlign: 'center', width: 90, color: '#f5d77f' }}>Points</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', width: 90 }}>Matchs</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player) => (
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
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          color: player.rank <= 3 ? '#f87171' : 'rgba(245, 240, 232, 0.7)',
                          fontSize: 12,
                        }}
                      >
                        {player.rank}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 30,
                            height: 30,
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
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)' }}>
                              {player.name.substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--ivory)' }}>
                          {player.name}
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TeamLogo teamName={player.team} size="xs" />
                        <span style={{ color: 'rgba(245, 240, 232, 0.8)' }}>
                          {player.team}
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#facc15' }}>
                      {player.yellowCards}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: player.redCards > 0 ? '#ef4444' : 'rgba(245,240,232,0.3)' }}>
                      {player.redCards}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ivory)' }}>
                      {player.totalCards}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <div
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          fontSize: 12,
                          color: '#f87171',
                        }}
                      >
                        {player.points} pts
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'rgba(245, 240, 232, 0.6)' }}>
                      {player.matchesCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Table Fair-Play des Équipes */
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
                  <th style={{ padding: '14px 16px', minWidth: 200 }}>Club</th>
                  <th style={{ padding: '14px 14px', textAlign: 'center' }}>Matchs</th>
                  <th style={{ padding: '14px 14px', textAlign: 'center' }}>Fautes Totales</th>
                  <th style={{ padding: '14px 14px', textAlign: 'center' }}>Fautes / Match</th>
                  <th style={{ padding: '14px 14px', textAlign: 'center' }}>🟨 Jaunes</th>
                  <th style={{ padding: '14px 14px', textAlign: 'center' }}>🟥 Rouges</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', color: '#10b981' }}>Score Fair-play</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.map((teamData) => {
                  const isCleanTop3 = teamData.rank <= 3;
                  const isPenaltyHeavy = teamData.rank >= teams.length - 2;

                  return (
                    <tr
                      key={teamData.team}
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
                            color: isCleanTop3 ? '#10b981' : isPenaltyHeavy ? '#ef4444' : 'rgba(245, 240, 232, 0.7)',
                            fontSize: 12,
                          }}
                        >
                          {teamData.rank}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <TeamLogo teamName={teamData.team} size="sm" />
                          <span style={{ fontWeight: 600, color: 'var(--ivory)' }}>
                            {teamData.team}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'rgba(245, 240, 232, 0.6)' }}>
                        {teamData.matchesCount}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'rgba(245, 240, 232, 0.8)' }}>
                        {teamData.foulsCommitted}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#38bdf8' }}>
                        {teamData.avgFouls}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#facc15' }}>
                        {teamData.yellowCards}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: teamData.redCards > 0 ? '#ef4444' : 'rgba(245,240,232,0.3)' }}>
                        {teamData.redCards}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 8,
                            background: isCleanTop3
                              ? 'rgba(16, 185, 129, 0.15)'
                              : isPenaltyHeavy
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${isCleanTop3 ? 'rgba(16, 185, 129, 0.4)' : isPenaltyHeavy ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            fontSize: 12,
                            color: isCleanTop3 ? '#34d399' : isPenaltyHeavy ? '#f87171' : 'var(--ivory)',
                          }}
                        >
                          {teamData.points} pts
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
