import React, { useState, useMemo } from 'react';

/**
 * IslandScorersList — Clean, virtualized / lightweight player list (scorers & assisters)
 * Compact item cards with photos, probabilities, and odds
 */
function IslandScorersList({ potentialScorers, potentialAssists }) {
  const [tab, setTab] = useState('scorers'); // 'scorers' | 'assists'

  const players = useMemo(() => {
    if (tab === 'scorers') {
      const homeList = (potentialScorers?.home || []).map(p => ({ ...p, teamSide: 'Dom.' }));
      const awayList = (potentialScorers?.away || []).map(p => ({ ...p, teamSide: 'Ext.' }));
      return [...homeList, ...awayList]
        .sort((a, b) => (b.goalProbVal || parseFloat(b.goalProb) || 0) - (a.goalProbVal || parseFloat(a.goalProb) || 0))
        .slice(0, 4);
    } else {
      const homeList = (potentialAssists?.home || []).map(p => ({ ...p, teamSide: 'Dom.' }));
      const awayList = (potentialAssists?.away || []).map(p => ({ ...p, teamSide: 'Ext.' }));
      return [...homeList, ...awayList]
        .sort((a, b) => (b.assistProbVal || parseFloat(b.assistProb) || 0) - (a.assistProbVal || parseFloat(a.assistProb) || 0))
        .slice(0, 4);
    }
  }, [tab, potentialScorers, potentialAssists]);

  if (!players || players.length === 0) {
    return (
      <div style={{ fontSize: '11px', color: 'var(--neutral, #94A3B8)', textAlign: 'center', padding: '8px 0' }}>
        Aucune donnée joueur disponible pour ce match.
      </div>
    );
  }

  return (
    <div>
      {/* Mini Toggle */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <button
          onClick={(e) => { e.stopPropagation(); setTab('scorers'); }}
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            background: tab === 'scorers' ? 'var(--gold-muted, rgba(201, 169, 110, 0.15))' : 'transparent',
            color: tab === 'scorers' ? 'var(--gold, #C9A96E)' : 'var(--neutral, #94A3B8)',
            transition: 'all 0.2s ease',
          }}
        >
          ⚽ Buteurs Potentiels
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setTab('assists'); }}
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            background: tab === 'assists' ? 'var(--gold-muted, rgba(201, 169, 110, 0.15))' : 'transparent',
            color: tab === 'assists' ? 'var(--gold, #C9A96E)' : 'var(--neutral, #94A3B8)',
            transition: 'all 0.2s ease',
          }}
        >
          🎯 Passeurs Clés
        </button>
      </div>

      {/* Grid of Players */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {players.map((ply, i) => {
          const prob = tab === 'scorers' ? (ply.goalProb || `${ply.goalProbVal}%`) : (ply.assistProb || `${ply.assistProbVal}%`);
          const odd = tab === 'scorers' ? ply.oddScorer : ply.oddAssist;
          const probNum = parseFloat(prob) || 0;
          const isHot = probNum >= 25;

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '5px 8px',
                borderRadius: '8px',
                background: 'rgba(245, 240, 232, 0.03)',
                border: '1px solid rgba(245, 240, 232, 0.06)',
                transition: 'transform 0.15s ease, background-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <img
                  src={ply.photoUrl || '/assets/players/defaults/a_default.webp'}
                  alt={ply.name}
                  onError={(e) => { e.target.src = '/assets/players/defaults/a_default.webp'; }}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid rgba(245, 240, 232, 0.1)',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--ivory, #F5F0E8)',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                    }}
                  >
                    {ply.name}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--neutral, #94A3B8)' }}>
                    {ply.team} · {ply.position || 'FW'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {odd && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--gold, #C9A96E)',
                      fontFamily: 'monospace',
                    }}
                  >
                    @{typeof odd === 'number' ? odd.toFixed(2) : odd}
                  </span>
                )}
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: isHot ? 'var(--positive-muted, rgba(74, 222, 128, 0.15))' : 'rgba(245, 240, 232, 0.06)',
                    color: isHot ? 'var(--positive, #4ADE80)' : 'var(--ivory-dim, rgba(245, 240, 232, 0.7))',
                    border: isHot ? '1px solid var(--positive-border, rgba(74, 222, 128, 0.3))' : '1px solid transparent',
                  }}
                >
                  {prob}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(IslandScorersList);
