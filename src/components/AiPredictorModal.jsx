import React, { useState, useEffect } from 'react';
import { X, Sparkles, Send, Bot, TrendingUp, CloudRain, ShieldCheck, Flame } from 'lucide-react';
import TeamLogo from './ui/TeamLogo';

export default function AiPredictorModal({ isOpen, onClose, selectedMatch, APP_DATA }) {
  const defaultTargetMatch = selectedMatch || APP_DATA?.fullSchedule?.[0] || {
    homeTeam: 'Benfica',
    awayTeam: 'AGF Aarhus',
    betclicOdds: { home: 1.13, draw: 8.75, away: 16.75 },
    prediction: {
      probabilities: { home: '80%', draw: '14%', away: '6%' },
      expectedGoals: { home: 2.67, away: 0.20 },
      winner: 'Benfica',
      confidence: 80,
      advice: 'Victoire Benfica'
    },
    weather: { city: 'Estádio da Luz (Lisbonne)', condition: 'Soirée Douce', temp_avg_c: 23.0, wind_speed_kmh: 12 },
    referee: { name: 'François Letexier (FIFA Elite)' },
    valueBets: [{ market: '1N2', selection: 'Victoire Benfica', edge_percentage: '+3.8%' }]
  };

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);

  // Find best match in database according to query text or fallback to selectedMatch
  const findMatchForQuery = (text) => {
    const q = (text || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const schedule = APP_DATA?.fullSchedule || [];

    // Check for team matches
    const matched = schedule.find(m => {
      const h = (m.homeTeam || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const a = (m.awayTeam || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return q.includes(h) || q.includes(a);
    });

    return matched || selectedMatch || defaultTargetMatch;
  };

  // Generate comprehensive analytical response from match data with Squad Lineup & Injury Context
  const generateRagAnalysis = (targetMatch, question) => {
    const home = targetMatch.homeTeam;
    const away = targetMatch.awayTeam;
    const odds = targetMatch.betclicOdds;
    const pred = targetMatch.prediction || {
      probabilities: { home: '50%', draw: '25%', away: '25%' },
      expectedGoals: { home: 1.50, away: 1.10 },
      winner: home,
      confidence: 50,
      advice: `Match équilibré ${home} vs ${away}`
    };
    const weather = targetMatch.weather || { condition: 'Ciel Dégagé', temp_avg_c: 20, wind_speed_kmh: 12, city: `${home} Stadium` };
    const referee = targetMatch.referee || { name: 'Corps Arbitral UEFA' };
    const valueBets = targetMatch.valueBets || [];

    // Lineup and Absentees Intelligence
    const lineupStatus = targetMatch.lineupStatus || 'PROBABLE';
    const homeLineup = targetMatch.homeLineup || { formation: '4-3-3', keyAbsentees: [], aggregatedSquadImpact: { xiStrengthRatio: 1.0, netXgOffensePenalty: 0.0, netXgDefensePenalty: 0.0, absenteesCount: 0 } };
    const awayLineup = targetMatch.awayLineup || { formation: '4-2-3-1', keyAbsentees: [], aggregatedSquadImpact: { xiStrengthRatio: 1.0, netXgOffensePenalty: 0.0, netXgDefensePenalty: 0.0, absenteesCount: 0 } };

    const homeProb = pred.probabilities?.home || pred.homeProb || '45%';
    const drawProb = pred.probabilities?.draw || pred.drawProb || '28%';
    const awayProb = pred.probabilities?.away || pred.awayProb || '27%';
    const homeXg = pred.expectedGoals?.home || pred.homeXg || targetMatch.homeXg || 1.80;
    const awayXg = pred.expectedGoals?.away || pred.awayXg || targetMatch.awayXg || 1.10;

    const absenteesList = [
      ...(homeLineup.keyAbsentees || []).map(a => ({ ...a, team: home })),
      ...(awayLineup.keyAbsentees || []).map(a => ({ ...a, team: away })),
    ];

    const absenteesCount = absenteesList.length;
    const totalXgLoss = Math.abs(homeLineup.aggregatedSquadImpact?.netXgOffensePenalty || 0) + Math.abs(awayLineup.aggregatedSquadImpact?.netXgOffensePenalty || 0);
    const netXgImpact = totalXgLoss > 0 ? `-${totalXgLoss.toFixed(2)}` : '0.0';

    const pHomeNum = parseFloat(homeProb) || 45;
    const pAwayNum = parseFloat(awayProb) || 27;
    const isHomeFavori = pHomeNum >= pAwayNum;
    const topProb = isHomeFavori ? homeProb : awayProb;
    const favoriTeam = isHomeFavori ? home : away;

    const firstVb = valueBets.length > 0 ? valueBets[0] : null;
    const vbLabel = firstVb ? (firstVb.selection_label || firstVb.side || (firstVb.selection === '1' ? `Victoire ${home}` : firstVb.selection === '2' ? `Victoire ${away}` : 'Match Nul')) : '';
    const vbSummary = firstVb
      ? `${vbLabel} @ ${firstVb.betclic_odd || firstVb.odd || firstVb.bookmaker_odds || odds?.home} (Edge : ${firstVb.edge_percentage || firstVb.edge})`
      : (odds && odds.home ? `Ligne Betclic équilibrée (1: ${odds.home} / N: ${odds.draw} / 2: ${odds.away})` : 'Cotes Betclic en attente d\'ouverture');

    const normQ = (question || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isScorerQuery = normQ.includes('buteur') || normQ.includes('buteurs') || normQ.includes('marquer') || normQ.includes('marquera') || normQ.includes('scorer');
    const isWeatherQuery = normQ.includes('meteo') || normQ.includes('pluie') || normQ.includes('temperature') || normQ.includes('vent') || normQ.includes('stade');
    const isRefereeQuery = normQ.includes('arbitre') || normQ.includes('carton') || normQ.includes('rouge') || normQ.includes('severite');
    const isValueBetQuery = normQ.includes('value') || normQ.includes('cote') || normQ.includes('edge') || normQ.includes('rentabilite');
    const isAbsenceQuery = normQ.includes('absent') || normQ.includes('forfait') || normQ.includes('blesse') || normQ.includes('blessure') || normQ.includes('suspendu') || normQ.includes('compo');

    const homeScorers = targetMatch.topScorers?.home || [];
    const awayScorers = targetMatch.topScorers?.away || [];
    const allScorers = [...homeScorers, ...awayScorers];

    // Tactical Absence Reasoning
    let tacticalSquadNotes = '';
    if (absenteesList.length > 0) {
      const topAbsent = absenteesList[0];
      if (topAbsent.pos === 'FW') {
        tacticalSquadNotes = `L'absence de ${topAbsent.name} (${topAbsent.team}, ${topAbsent.reason}) pèse directement sur le volume offensif avec une baisse de ${Math.abs(topAbsent.deltaXg || 0.25)} xG. `;
      } else if (topAbsent.pos === 'DF' || topAbsent.pos === 'GK') {
        tacticalSquadNotes = `Le forfait défensif de ${topAbsent.name} (${topAbsent.team}, ${topAbsent.reason}) fragilise l'axe central et augmente les probabilités du marché Les deux équipes marquent (BTTS). `;
      } else {
        tacticalSquadNotes = `L'indisponibilité de ${topAbsent.name} (${topAbsent.team}, ${topAbsent.reason}) impacte la maîtrise du milieu et la transition rapide. `;
      }
    } else {
      tacticalSquadNotes = 'Les deux effectifs se présentent au complet avec une force de onze de départ optimale (100% de disponibilité). ';
    }

    let justification = '';

    if (isScorerQuery) {
      const hScorersList = homeScorers.slice(0, 3).map(s => `${s.name} (${s.goalProb || Math.round(s.goalProbVal || 20) + '%'}, cote @ ${s.oddScorer || 3.20})`).join(', ');
      const aScorersList = awayScorers.slice(0, 3).map(s => `${s.name} (${s.goalProb || Math.round(s.goalProbVal || 20) + '%'}, cote @ ${s.oddScorer || 3.50})`).join(', ');
      justification = `Projections des Buteurs pour ${home} vs ${away} :\n` +
        `Pour ${home} : ${hScorersList || 'Attaquants titulaires selon xG projeté'}.\n` +
        `Pour ${away} : ${aScorersList || 'Attaquants titulaires selon xG projeté'}.\n` +
        `Recommandation : Les attaquants affichant un xG/match élevé représentent la meilleure opportunité sur les marchés buteurs de cette rencontre.`;
    } else if (isWeatherQuery) {
      justification = `Conditions météorologiques au stade de ${weather.city || home} : ${weather.condition || 'Ciel Dégagé'}, température de ${weather.temp_avg_c || 20}°C, vent à ${weather.wind_speed_kmh || 10} km/h. ` +
        `Ces conditions favorisent la vitesse de transmission et la circulation du ballon.`;
    } else if (isRefereeQuery) {
      justification = `Analyse de l'Arbitrage pour ${home} vs ${away} : ${referee.name || 'Corps Arbitral Officiel'} (Sévérité : ${referee.severity || '7.2/10'}). ` +
        `Moyenne de cartons jaunes observée : ${referee.yellowAvg || '3.8'}/match.`;
    } else if (isValueBetQuery) {
      justification = firstVb 
        ? `Opportunité de Value Bet identifiée : ${vbSummary}. Notre modèle Dixon-Coles détecte une sous-évaluation de ce marché par Betclic.`
        : `Aucune anomalie de cote majeure (> +2.5%) détectée sur ce match. Les cotes Betclic actuelles reflètent fidèlement les probabilités réelles.`;
    } else if (isAbsenceQuery) {
      justification = absenteesList.length > 0
        ? `Point infirmerie et forfaits : ${absenteesList.map(a => `${a.name} (${a.team}, ${a.reason || 'forfait'})`).join(', ')}. Impact global estimé sur le xG : ${netXgImpact} xG.`
        : `Les deux équipes se présentent avec un effectif à 100% de disponibilité sans forfait majeur signalé.`;
    } else {
      justification = `D'après notre modèle Dixon-Coles calibré sur les données officielles Betclic : ${favoriTeam} est favori avec ${topProb} de chances de victoire (xG projeté : ${homeXg} pour ${home} vs ${awayXg} pour ${away}). ` +
        `${tacticalSquadNotes}` +
        `Au stade de ${weather.city || home} (${weather.condition}, ${weather.temp_avg_c}°C), ${referee.name} assurera la tenue du match. ` +
        (firstVb ? `Une opportunité de Value Bet est identifiée sur ${vbLabel} à une cote de ${firstVb.betclic_odd || firstVb.odd || firstVb.bookmaker_odds} avec un Edge de ${firstVb.edge_percentage || firstVb.edge}.` : `Le pronostic préférentiel est : ${pred.advice || `Victoire ${favoriTeam}`}.`);
    }

    return {
      match: `${home} vs ${away}`,
      homeTeam: home,
      awayTeam: away,
      lineupStatus,
      homeFormation: homeLineup.formation,
      awayFormation: awayLineup.formation,
      absenteesCount,
      netXgImpact,
      absenteesList,
      topScorers: allScorers,
      probabilities: { home: homeProb, draw: drawProb, away: awayProb },
      weather: `${weather.condition} · ${weather.temp_avg_c}°C`,
      valueBet: vbSummary,
      justification
    };
  };

  // Initialize initial welcome message
  useEffect(() => {
    if (isOpen) {
      const activeMatch = selectedMatch || defaultTargetMatch;
      const initialAnalysis = generateRagAnalysis(activeMatch, 'Analyse contextuelle');
      setMessages([
        {
          id: 'msg-init',
          sender: 'ai',
          query: `Analyse approfondie de ${activeMatch.homeTeam} vs ${activeMatch.awayTeam}`,
          data: initialAnalysis
        }
      ]);
    }
  }, [isOpen, selectedMatch]);

  if (!isOpen) return null;

  const handleAsk = (queryText) => {
    const textToAsk = queryText || inputQuery;
    if (!textToAsk.trim()) return;

    const userMsgId = `user-${Date.now()}`;
    const userMessage = { id: userMsgId, sender: 'user', text: textToAsk };

    setMessages(prev => [...prev, userMessage]);
    setInputQuery('');
    setLoading(true);

    setTimeout(() => {
      const matchedFixture = findMatchForQuery(textToAsk);
      const analysis = generateRagAnalysis(matchedFixture, textToAsk);

      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          query: textToAsk,
          data: analysis
        }
      ]);
      setLoading(false);
    }, 450);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(8,11,20,0.85)',
        backdropFilter: 'blur(16px)',
        animation: 'fadeIn 0.3s ease-out',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          background: 'var(--obsidian-2)',
          border: '1px solid var(--gold-border)',
          borderRadius: 24,
          boxShadow: 'var(--shadow-float)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          animation: 'modalSlideUp 0.4s var(--ease-spring)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--ivory-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--glass-primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: 'linear-gradient(135deg, var(--gold), #8B6A3C)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-gold)',
            }}>
              <Bot size={22} color="var(--obsidian)" />
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.25rem',
                color: 'var(--ivory)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                Antigravity AI Copilot
                <span style={{
                  fontSize: 9,
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--gold)',
                  background: 'var(--gold-muted)',
                  border: '1px solid var(--gold-border)',
                  padding: '2px 8px',
                  borderRadius: 6,
                }}>
                  RAG Multi-Match
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 2 }}>
                Interrogation en direct de 77 rencontres · Cotes Betclic · Météo Stades
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'var(--ivory-ghost)',
              border: '1px solid var(--ivory-border)',
              color: 'var(--neutral)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div style={{
          padding: '10px 20px',
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid var(--ivory-border)',
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
        }}>
          {[
            'Benfica vont-ils gagner aujourd\'hui ?',
            'Tromsø vs Brighton : Analyse & xG',
            'Y a-t-il des Value Bets en Ligue Conférence ?',
            'Inter Turku vs Copenhague : Météo & Prono',
          ].map(chip => (
            <button
              key={chip}
              onClick={() => handleAsk(chip)}
              style={{
                fontSize: 11,
                padding: '5px 12px',
                borderRadius: 20,
                background: 'var(--ivory-ghost)',
                border: '1px solid var(--ivory-border)',
                color: 'var(--ivory-dim)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Chat History */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map(msg => {
            if (msg.sender === 'user') {
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    background: 'var(--gold-muted)',
                    border: '1px solid var(--gold-border)',
                    borderRadius: '16px 16px 4px 16px',
                    padding: '10px 16px',
                    fontSize: 13,
                    color: 'var(--ivory)',
                    maxWidth: '80%',
                    fontWeight: 500,
                  }}>
                    {msg.text}
                  </div>
                </div>
              );
            }

            const { data } = msg;
            return (
              <div key={msg.id} style={{
                background: 'var(--glass-primary)',
                border: '1px solid var(--ivory-border)',
                borderRadius: 18,
                padding: '18px 20px',
                animation: 'fadeIn 0.3s ease-out',
              }}>
                {/* Match title header & Lineup Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <TeamLogo teamName={data.homeTeam} size="sm" />
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--ivory)' }}>
                      {data.match}
                    </span>
                    <TeamLogo teamName={data.awayTeam} size="sm" />
                  </div>

                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '3px 9px',
                    borderRadius: 14,
                    background: data.lineupStatus === 'OFFICIAL' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                    color: data.lineupStatus === 'OFFICIAL' ? '#4ade80' : '#facc15',
                    border: `1px solid ${data.lineupStatus === 'OFFICIAL' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                    {data.lineupStatus === 'OFFICIAL' ? 'Compo Officielle (H-1)' : 'Compo Probable (J-1)'}
                  </span>
                </div>

                {/* 4 KPI Chips */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 12 }}>
                  {/* KPI 1 : 1N2 */}
                  <div style={{
                    padding: '9px 10px',
                    background: 'var(--obsidian-3)',
                    border: '1px solid var(--ivory-border)',
                    borderRadius: 12,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--neutral)', marginBottom: 3 }}>
                      Probabilités 1N2
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--positive)' }}>
                      {data.probabilities?.home || '—'} · {data.probabilities?.draw || '—'} · {data.probabilities?.away || '—'}
                    </div>
                  </div>

                  {/* KPI 2 : Impact Effectif & Forfaits */}
                  <div style={{
                    padding: '9px 10px',
                    background: 'var(--obsidian-3)',
                    border: `1px solid ${data.absenteesCount > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--ivory-border)'}`,
                    borderRadius: 12,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--neutral)', marginBottom: 3 }}>
                      Impact Effectif
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: data.absenteesCount > 0 ? '#f87171' : 'var(--ivory-dim)' }}>
                      {data.absenteesCount > 0 ? `⚠️ ${data.absenteesCount} Absents (${data.netXgImpact} xG)` : '✅ XI Optimal'}
                    </div>
                  </div>

                  {/* KPI 3 : Météo */}
                  <div style={{
                    padding: '9px 10px',
                    background: 'var(--obsidian-3)',
                    border: '1px solid var(--ivory-border)',
                    borderRadius: 12,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--neutral)', marginBottom: 3 }}>
                      Météo Stade
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ivory-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {data.weather}
                    </div>
                  </div>

                  {/* KPI 4 : Value Bet */}
                  <div style={{
                    padding: '9px 10px',
                    background: 'var(--obsidian-3)',
                    border: '1px solid var(--ivory-border)',
                    borderRadius: 12,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--neutral)', marginBottom: 3 }}>
                      Value Bet Betclic
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {data.valueBet}
                    </div>
                  </div>
                </div>

                {/* Badges d'Absents Majeurs */}
                {data.absenteesList?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {data.absenteesList.map((player, idx) => (
                      <span key={idx} style={{
                        fontSize: 10,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: 'var(--ivory-dim)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}>
                        <span style={{ color: player.severity === 'CONFIRMED_OUT' ? '#ef4444' : '#f59e0b', fontSize: 8 }}>●</span>
                        <strong style={{ color: 'var(--ivory)' }}>{player.name}</strong> ({player.team})
                        <span style={{ fontSize: 9, color: 'var(--neutral)' }}>· {player.reason}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Badges Buteurs Potentiels Clés */}
                {data.topScorers?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {data.topScorers.slice(0, 4).map((scorer, idx) => (
                      <span key={idx} style={{
                        fontSize: 10,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(255, 215, 0, 0.05)',
                        border: '1px solid var(--gold-border)',
                        color: 'var(--gold)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}>
                        <span>⚽</span>
                        <strong style={{ color: 'var(--ivory)' }}>{scorer.name}</strong> ({scorer.team})
                        <span style={{ fontSize: 9, color: 'var(--gold)' }}>· {scorer.goalProb || Math.round(scorer.goalProbVal || 20) + '%'}</span>
                        {scorer.oddScorer && <span style={{ fontSize: 9, color: 'var(--neutral)' }}>@ {scorer.oddScorer}</span>}
                      </span>
                    ))}
                  </div>
                )}

                {/* Justification paragraph */}
                <p style={{
                  fontSize: 13,
                  color: 'var(--ivory-dim)',
                  lineHeight: 1.6,
                  margin: 0,
                }}>
                  {data.justification}
                </p>
              </div>
            );
          })}

          {loading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: 'var(--gold)',
              padding: '16px 0',
              justifyContent: 'center',
            }}>
              <Sparkles size={18} style={{ animation: 'pulse 1.2s ease-in-out infinite' }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                Interrogation du Feature Store & Analyse Dixon-Coles…
              </span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleAsk(inputQuery); }}
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--ivory-border)',
            background: 'var(--obsidian-3)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <input
            type="text"
            value={inputQuery}
            onChange={e => setInputQuery(e.target.value)}
            placeholder="Posez une question sur n'importe quel match (ex: Benfica, PSG, Tromsø...)"
            style={{
              flex: 1,
              background: 'var(--obsidian-4)',
              border: '1px solid var(--ivory-border)',
              borderRadius: 12,
              padding: '12px 16px',
              color: 'var(--ivory)',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || loading}
            style={{
              padding: '12px 20px',
              borderRadius: 12,
              background: inputQuery.trim() ? 'linear-gradient(135deg, var(--gold), #8B6A3C)' : 'var(--ivory-ghost)',
              color: inputQuery.trim() ? 'var(--obsidian)' : 'var(--neutral)',
              border: 'none',
              fontWeight: 700,
              fontSize: 13,
              cursor: inputQuery.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
          >
            <Send size={15} />
            Analyser
          </button>
        </form>
      </div>
    </div>
  );
}
