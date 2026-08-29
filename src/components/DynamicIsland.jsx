import React, { useState, useEffect, useCallback } from 'react';
import APP_DATA from '../data/app_data.json';

/**
 * DynamicIsland — Floating pill at the top-center of the screen.
 * Inspiré d'Apple Dynamic Island : pill compact → expanse animée.
 * 
 * Modes:
 *  - "live"        : Match en cours / score live
 *  - "value"       : Value Bet détecté
 *  - "next"        : Prochain match
 *  - "weather"     : Alerte météo
 *  - "idle"        : Heure + statut système
 */
export default function DynamicIsland() {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState('next');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Récupère les prochains matchs
  const upcomingMatches = (APP_DATA.fullSchedule || [])
    .filter(m => m.status === 'SCHEDULED')
    .slice(0, 6);

  const valueMatches = (APP_DATA.fullSchedule || [])
    .filter(m => m.valueBets && m.valueBets.length > 0)
    .slice(0, 3);

  // Auto-rotation des modes toutes les 5s (fermé uniquement)
  useEffect(() => {
    if (expanded) return;
    const modes = ['next', 'value', 'idle'];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % modes.length;
      setMode(modes[i]);
    }, 5000);
    return () => clearInterval(interval);
  }, [expanded]);

  const toggle = useCallback(() => setExpanded(e => !e), []);

  const nextMatch = upcomingMatches[currentIndex] || upcomingMatches[0];
  const valueMatch = valueMatches[0];
  const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // ── PILL CONTENT (collapsed) ──
  const pillLabel = () => {
    if (mode === 'live') return (
      <>
        <span className="island-live-dot" />
        <span>LIVE · PSG 2 — 1 Lyon</span>
      </>
    );
    if (mode === 'value' && valueMatch) return (
      <>
        <span className="island-gold-dot" />
        <span>Value Bet · {valueMatch.homeTeam} vs {valueMatch.awayTeam}</span>
      </>
    );
    if (nextMatch) return (
      <>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        <span style={{ fontSize: '11px' }}>
          {nextMatch.homeTeam?.split(' ').slice(-1)[0]} vs {nextMatch.awayTeam?.split(' ').slice(-1)[0]}
        </span>
      </>
    );
    return <span style={{ fontSize: '11px' }}>{now} · Système Actif</span>;
  };

  // ── EXPANDED CONTENT ──
  const expandedContent = () => {
    if (mode === 'value' && valueMatch) {
      return (
        <div>
          <div style={{ marginBottom: 14 }}>
            <div className="island-gold-dot" style={{ display: 'inline-block', marginBottom: 8 }} />
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>
              Value Bet Détecté
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--ivory)', lineHeight: 1.1 }}>
              {valueMatch.homeTeam}
              <span style={{ color: 'var(--neutral)', fontSize: '1rem', margin: '0 8px', fontStyle: 'italic' }}>vs</span>
              {valueMatch.awayTeam}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {valueMatch.valueBets?.map((vb, i) => {
              const label = vb.selection_label || vb.side || (vb.selection === '1' ? `Victoire ${valueMatch.homeTeam}` : vb.selection === '2' ? `Victoire ${valueMatch.awayTeam}` : 'Match Nul');
              return (
                <div key={i} style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: 'var(--positive-muted)',
                  border: '1px solid var(--positive-border)',
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'var(--positive)',
                }}>
                  ★ {label} @ {vb.betclic_odd || vb.odd} · Edge {vb.edge_percentage || vb.edge}
                </div>
              );
            })}
            <div style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--ivory-ghost)', border: '1px solid var(--ivory-border)', fontSize: 11, color: 'var(--ivory-dim)' }}>
              {valueMatch.league}
            </div>
          </div>
        </div>
      );
    }

    if (nextMatch) {
      const homeProb = nextMatch.probabilities?.home || '—';
      const awayProb = nextMatch.probabilities?.away || '—';
      const drawProb = nextMatch.probabilities?.draw || '—';
      return (
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>
            Prochain Match · {nextMatch.league}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              {nextMatch.homeLogo && (
                <img src={nextMatch.homeLogo} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              )}
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--ivory)' }}>
                {nextMatch.homeTeam}
              </span>
            </div>
            <span style={{ color: 'var(--neutral)', fontSize: '0.875rem', fontStyle: 'italic' }}>vs</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--ivory)' }}>
                {nextMatch.awayTeam}
              </span>
              {nextMatch.awayLogo && (
                <img src={nextMatch.awayLogo} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              )}
            </div>
          </div>
          {/* Probability bar */}
          <div style={{ marginBottom: 6 }}>
            <div className="prob-bar-container">
              <div className="prob-segment-home" style={{ width: homeProb }} />
              <div className="prob-segment-draw" style={{ width: drawProb }} />
              <div className="prob-segment-away" style={{ width: awayProb }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--neutral)' }}>
            <span style={{ color: 'var(--positive)' }}>{homeProb} D1</span>
            <span>N {drawProb}</span>
            <span style={{ color: 'var(--danger)' }}>{awayProb} D2</span>
          </div>
          {nextMatch.weather && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--neutral)', display: 'flex', gap: 12 }}>
              <span>🌤 {nextMatch.weather.condition}</span>
              <span>{nextMatch.weather.temp_avg_c}°C</span>
              <span>💨 {nextMatch.weather.wind_speed_kmh} km/h</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--gold)', marginBottom: 4 }}>{now}</div>
        <div style={{ fontSize: 11, color: 'var(--neutral)' }}>European Football Predictor V2 · Actif</div>
      </div>
    );
  };

  return (
    <div
      className={`dynamic-island ${expanded ? 'expanded' : 'pill'}`}
      onClick={toggle}
      title={expanded ? 'Réduire' : 'Voir les détails'}
    >
      {/* Pill state */}
      <div className="island-pill-content">
        {pillLabel()}
      </div>

      {/* Expanded state */}
      <div className="island-expanded-content">
        {/* Close hint */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button
            onClick={e => { e.stopPropagation(); setExpanded(false); }}
            style={{
              background: 'var(--ivory-ghost)',
              border: '1px solid var(--ivory-border)',
              borderRadius: 8,
              color: 'var(--neutral)',
              fontSize: 11,
              padding: '3px 8px',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {['next', 'value', 'idle'].map(m => (
            <button
              key={m}
              onClick={e => { e.stopPropagation(); setMode(m); }}
              style={{
                padding: '3px 10px',
                borderRadius: 7,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                background: mode === m ? 'var(--gold-muted)' : 'transparent',
                border: mode === m ? '1px solid var(--gold-border)' : '1px solid transparent',
                color: mode === m ? 'var(--gold)' : 'var(--neutral)',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {m === 'next' ? 'Prochain' : m === 'value' ? 'Value Bets' : 'Statut'}
            </button>
          ))}
        </div>

        {expandedContent()}
      </div>
    </div>
  );
}
