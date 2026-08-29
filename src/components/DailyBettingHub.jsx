import React, { useState } from 'react';
import ValueEdgeScatter from './ValueEdgeScatter';
import MatchPrediction from './MatchPrediction';
import TeamLogo from './ui/TeamLogo';
import { ShieldAlert, TrendingDown, CloudRain, Star, Filter, Check, RefreshCw } from 'lucide-react';

const ALL_LEAGUES = [
  { code: 'EUR-CL', name: 'Champions League 🇪🇺' },
  { code: 'EUR-EL', name: 'Europa League 🇪🇺' },
  { code: 'EUR-ECL', name: 'Conference League 🇪🇺' },
  { code: 'FRA-L1', name: 'Ligue 1 🇫🇷' },
  { code: 'ENG-PL', name: 'Premier League 🇬🇧' },
  { code: 'ESP-LL', name: 'La Liga 🇪🇸' },
  { code: 'ITA-SA', name: 'Serie A 🇮🇹' },
  { code: 'GER-BL', name: 'Bundesliga 🇩🇪' },
  { code: 'FRIENDLY', name: 'Amicaux 🌐' },
];

export default function DailyBettingHub({ APP_DATA, selectedMatch, setSelectedMatch }) {
  const [minEdge, setMinEdge] = useState(2.0);
  const [selectedLeagues, setSelectedLeagues] = useState(['EUR-CL', 'EUR-EL', 'EUR-ECL', 'ENG-PL', 'FRA-L1', 'ESP-LL', 'ITA-SA', 'GER-BL', 'FRIENDLY']); // Multi-select array
  const [refreshingMatchId, setRefreshingMatchId] = useState(null);
  const [lastRefreshedTimes, setLastRefreshedTimes] = useState({});

  const handleRefreshOdds = async (e, match) => {
    e.stopPropagation();
    if (!match?.id) return;
    setRefreshingMatchId(match.id);
    
    try {
      // 1. Try to call the local Odds API microserver
      const res = await fetch('http://localhost:5175/api/odds/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, homeTeam: match.homeTeam, awayTeam: match.awayTeam })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.betclicOdds) {
          match.betclicOdds = json.data.betclicOdds;
          match.probabilities = json.data.probabilities;
          match.valueBets = json.data.valueBets;
          match.oddsStatus = json.data.oddsStatus;
          match.oddsMarginPct = json.data.oddsMarginPct;
        }
      }
    } catch (err) {
      console.warn('API odds refresh offline:', err.message);
    } finally {
      setLastRefreshedTimes(prev => ({
        ...prev,
        [match.id]: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }));
      setRefreshingMatchId(null);
    }
  };

  const matches = APP_DATA?.fullSchedule || [];
  const scheduled = matches.filter(m => m.status === 'SCHEDULED' || m.status === 'LIVE' || !m.status);

  const toggleLeague = (code) => {
    if (code === 'ALL') {
      if (selectedLeagues.length === ALL_LEAGUES.length) {
        setSelectedLeagues([]);
      } else {
        setSelectedLeagues(ALL_LEAGUES.map(l => l.code));
      }
      return;
    }

    if (selectedLeagues.includes(code)) {
      setSelectedLeagues(selectedLeagues.filter(c => c !== code));
    } else {
      setSelectedLeagues([...selectedLeagues, code]);
    }
  };

  const filteredMatches = scheduled.filter(m => selectedLeagues.includes(m.league));

  const valueBetsMatches = filteredMatches.filter(m => {
    if (!m.valueBets || m.valueBets.length === 0 || m.oddsStatus !== 'ACTIVE' || !m.betclicOdds?.home) return false;
    return m.valueBets.some(v => parseFloat(v.edge_percentage) >= minEdge);
  });

  const alerts = [
    { type: 'line', title: 'Chute de cote majeure', text: 'Victoire PSG @ 1.85 ➔ 1.65 (-10.8% sur Betclic)', level: 'high' },
    { type: 'injury', title: 'Absence de dernière minute', text: 'Erling Haaland (Man City) incertain (Gêne musculaire)', level: 'warning' },
    { type: 'weather', title: 'Alerte météo terrain', text: 'Pluie torrentielle prévue à Manchester (22mm precip)', level: 'info' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── TOP BANNER & ALERTS ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '2.2rem',
              color: 'var(--ivory)',
              fontWeight: 400,
              margin: 0,
            }}>
              Daily Betting Hub
            </h1>
            <p style={{ fontSize: 12, color: 'var(--neutral)', marginTop: 4 }}>
              Command Center · Matrice Value Bets · Alertes Line Movement · Modèle Dixon-Coles
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            background: 'var(--glass-primary)',
            border: '1px solid var(--gold-border)',
            borderRadius: 14,
            padding: '10px 18px',
          }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)' }}>
                Value Bets Détectés
              </div>
              <div style={{ fontSize: 20, fontFamily: 'var(--font-serif)', color: 'var(--ivory)', fontWeight: 700 }}>
                {valueBetsMatches.length}
              </div>
            </div>
            <div style={{ width: 1, height: 28, background: 'var(--ivory-border)' }} />
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--neutral)' }}>
                Matchs Filtrés
              </div>
              <div style={{ fontSize: 20, fontFamily: 'var(--font-serif)', color: 'var(--ivory)', fontWeight: 700 }}>
                {filteredMatches.length} / {scheduled.length}
              </div>
            </div>
          </div>
        </div>

        {/* Multi-League Multi-Select Chips Bar */}
        <div style={{
          background: 'var(--glass-primary)',
          border: '1px solid var(--ivory-border)',
          borderRadius: 16,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--gold)' }}>
            <Filter size={14} /> Filtre Multi-Championnats :
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              className={`league-chip ${selectedLeagues.length === ALL_LEAGUES.length ? 'active' : ''}`}
              onClick={() => toggleLeague('ALL')}
              style={{ fontSize: 11, padding: '5px 12px' }}
            >
              Tous ({ALL_LEAGUES.length})
            </button>
            {ALL_LEAGUES.map(lg => {
              const isSelected = selectedLeagues.includes(lg.code);
              return (
                <button
                  key={lg.code}
                  className={`league-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => toggleLeague(lg.code)}
                  style={{
                    fontSize: 11,
                    padding: '5px 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: isSelected ? 'var(--gold-muted)' : 'var(--obsidian-3)',
                    border: `1px solid ${isSelected ? 'var(--gold-border)' : 'var(--ivory-border)'}`,
                    color: isSelected ? 'var(--gold)' : 'var(--neutral)',
                  }}
                >
                  {isSelected && <Check size={12} />}
                  {lg.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3 Alert Widgets */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {alerts.map((al, idx) => (
            <div key={idx} style={{
              background: al.level === 'high' ? 'rgba(239,68,68,0.08)' : al.level === 'warning' ? 'rgba(250,204,21,0.08)' : 'rgba(201,169,110,0.08)',
              border: `1px solid ${al.level === 'high' ? 'rgba(239,68,68,0.3)' : al.level === 'warning' ? 'rgba(250,204,21,0.3)' : 'rgba(201,169,110,0.3)'}`,
              borderRadius: 14,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: al.level === 'high' ? 'rgba(239,68,68,0.2)' : al.level === 'warning' ? 'rgba(250,204,21,0.2)' : 'var(--gold-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: al.level === 'high' ? 'var(--danger)' : al.level === 'warning' ? 'var(--warning)' : 'var(--gold)',
                shrink: 0,
              }}>
                {al.type === 'line' ? <TrendingDown size={16} /> : al.type === 'injury' ? <ShieldAlert size={16} /> : <CloudRain size={16} />}
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ivory)', letterSpacing: '0.02em' }}>
                  {al.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 2, lineHeight: 1.4 }}>
                  {al.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SCATTER PLOT VALUE EDGE ── */}
      <section>
        <ValueEdgeScatter matches={filteredMatches} />
      </section>

      {/* ── VALUE BET FINDER MATRIX ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="card-section-title">Value Bet Finder Matrix</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--neutral)' }}>
            <Filter size={14} />
            Edge Min :
            <select
              value={minEdge}
              onChange={e => setMinEdge(parseFloat(e.target.value))}
              style={{ width: 80, padding: '4px 8px', fontSize: 11 }}
            >
              <option value={1.5}>+1.5%</option>
              <option value={2.0}>+2.0%</option>
              <option value={3.0}>+3.0%</option>
              <option value={4.0}>+4.0%</option>
            </select>
          </div>
        </div>

        {/* Matrix Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {valueBetsMatches.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1',
              padding: '40px 20px',
              textAlign: 'center',
              background: 'var(--glass-primary)',
              border: '1px solid var(--ivory-border)',
              borderRadius: 16,
              color: 'var(--neutral)',
              fontSize: 13,
            }}>
              Aucun Value Bet ne dépasse l'Edge filtré (+{minEdge}%) pour la sélection des championnats actifs.
            </div>
          ) : (
            valueBetsMatches.slice(0, 8).map(m => (
              <div
                key={m.id}
                onClick={() => setSelectedMatch(m)}
                style={{
                  background: selectedMatch?.id === m.id ? 'var(--obsidian-2)' : 'var(--glass-primary)',
                  border: `1px solid ${selectedMatch?.id === m.id ? 'var(--gold-border)' : 'var(--ivory-border)'}`,
                  borderRadius: 16,
                  padding: 18,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: selectedMatch?.id === m.id ? 'var(--shadow-gold)' : 'none',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.1em' }}>
                    {m.league} · Journée {m.week}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {lastRefreshedTimes[m.id] && (
                      <span style={{ fontSize: 9, color: 'var(--positive)', fontWeight: 600 }}>
                        Cotes à {lastRefreshedTimes[m.id]}
                      </span>
                    )}
                    <button
                      onClick={(e) => handleRefreshOdds(e, m)}
                      title="Actualiser la cote en temps réel"
                      style={{
                        background: 'rgba(201, 169, 110, 0.15)',
                        border: '1px solid var(--gold-border)',
                        borderRadius: 6,
                        padding: '3px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                        color: 'var(--gold)',
                        fontSize: 10,
                        fontWeight: 600,
                        transition: 'all 0.2s',
                      }}
                    >
                      <RefreshCw size={11} className={refreshingMatchId === m.id ? 'animate-spin' : ''} style={{ animation: refreshingMatchId === m.id ? 'spin 1s linear infinite' : 'none' }} />
                      <span>{refreshingMatchId === m.id ? 'Calcul...' : 'Cote T'}</span>
                    </button>
                    <span style={{ fontSize: 10, color: 'var(--neutral)' }}>
                      {m.matchDate}
                    </span>
                  </div>
                </div>

                {/* Teams */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <TeamLogo teamName={m.homeTeam} size="sm" />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ivory)' }}>{m.homeTeam}</span>
                  </div>

                  <span style={{ fontSize: 12, color: 'var(--neutral)', fontWeight: 600 }}>VS</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ivory)' }}>{m.awayTeam}</span>
                    <TeamLogo teamName={m.awayTeam} size="sm" />
                  </div>
                </div>

                {/* Cotes Betclic & Value Bets */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, borderTop: '1px solid var(--ivory-border)', paddingTop: 12 }}>
                  {m.betclicOdds && m.betclicOdds.home ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 800 }}>1N2 :</span>
                      <span style={{ fontSize: 11, color: 'var(--ivory)', background: 'var(--obsidian-3)', padding: '2px 6px', borderRadius: 4 }}>1: <strong style={{ color: 'var(--gold)' }}>{m.betclicOdds.home}</strong></span>
                      <span style={{ fontSize: 11, color: 'var(--ivory)', background: 'var(--obsidian-3)', padding: '2px 6px', borderRadius: 4 }}>N: <strong style={{ color: 'var(--gold)' }}>{m.betclicOdds.draw}</strong></span>
                      <span style={{ fontSize: 11, color: 'var(--ivory)', background: 'var(--obsidian-3)', padding: '2px 6px', borderRadius: 4 }}>2: <strong style={{ color: 'var(--gold)' }}>{m.betclicOdds.away}</strong></span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>
                      ⏳ Cotes non encore ouvertes
                    </span>
                  )}

                  {m.valueBets && m.valueBets.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {m.valueBets.map((vb, idx) => {
                        const label = vb.selection_label || vb.side || (vb.selection === '1' ? `Victoire ${m.homeTeam}` : vb.selection === '2' ? `Victoire ${m.awayTeam}` : 'Match Nul');
                        return (
                          <div key={idx} style={{
                            background: 'var(--gold-muted)',
                            border: '1px solid var(--gold-border)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 10,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}>
                            <Star size={10} color="var(--gold)" fill="var(--gold)" />
                            <span style={{ fontWeight: 800, color: 'var(--ivory)' }}>{label}</span>
                            <span style={{ color: 'var(--gold)', fontWeight: 900 }}>@ {vb.betclic_odd || vb.odd || vb.bookmaker_odds}</span>
                            <span style={{ fontSize: 9, color: 'var(--positive)', fontWeight: 700 }}>({vb.edge_percentage || vb.edge})</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── FOCUS MATCH SELECTION ── */}
      {selectedMatch && (
        <section>
          <div className="card-section-title" style={{ marginBottom: 16 }}>
            Analyse Détaillée du Match Sélectionné
          </div>
          <MatchPrediction match={selectedMatch} />
        </section>
      )}

    </div>
  );
}
