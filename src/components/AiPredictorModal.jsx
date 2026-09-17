import React, { useState, useEffect } from 'react';
import { X, Sparkles, Send, Bot } from 'lucide-react';
import TeamLogo from './ui/TeamLogo';
import { queryCopilotRAG, extractTeamsFromQuery } from '../utils/ragEngine.js';

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

  // Recherche intelligente du match selon le texte ou fallback sur le match actif
  const findMatchForQuery = (text) => {
    if (!text) return selectedMatch || defaultTargetMatch;
    const schedule = APP_DATA?.fullSchedule || [];
    const detected = extractTeamsFromQuery(text);

    if (detected.length > 0) {
      const matched = schedule.find(m => {
        const h = m.homeTeam.toLowerCase();
        const a = m.awayTeam.toLowerCase();
        const d0 = detected[0].toLowerCase();
        const d1 = detected[1] ? detected[1].toLowerCase() : null;

        if (d1) {
          return (h.includes(d0) && a.includes(d1)) || (h.includes(d1) && a.includes(d0));
        }
        return h.includes(d0) || a.includes(d0);
      });
      if (matched) return matched;
    }

    return selectedMatch || defaultTargetMatch;
  };

  // Génération de l'analyse via le moteur RAG Omniscient unifié
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
    const weather = targetMatch.weather || { condition: 'Ciel Dégagé', temp_avg_c: 20, wind_speed_kmh: 12, city: targetMatch.location || `${home} Stadium` };
    const referee = targetMatch.referee || { name: 'Corps Arbitral UEFA' };
    const valueBets = targetMatch.valueBets || [];
    const lineupStatus = targetMatch.lineupStatus || 'PROBABLE';

    const homeProb = pred.probabilities?.home || pred.homeProb || '45%';
    const drawProb = pred.probabilities?.draw || pred.drawProb || '28%';
    const awayProb = pred.probabilities?.away || pred.awayProb || '27%';

    // Absents & forfaits
    const absenteesList = [
      ...(targetMatch.homeLineup?.keyAbsentees || []).map(a => ({ ...a, team: home })),
      ...(targetMatch.awayLineup?.keyAbsentees || []).map(a => ({ ...a, team: away })),
    ];
    const absenteesCount = absenteesList.length;
    const totalXgLoss = Math.abs(targetMatch.homeLineup?.aggregatedSquadImpact?.netXgOffensePenalty || 0) + Math.abs(targetMatch.awayLineup?.aggregatedSquadImpact?.netXgOffensePenalty || 0);
    const netXgImpact = totalXgLoss > 0 ? `-${totalXgLoss.toFixed(2)}` : '0.0';

    // Buteurs et créateurs potentiels
    const homeScorers = targetMatch.potentialScorers?.home || targetMatch.topScorers?.home || [];
    const awayScorers = targetMatch.potentialScorers?.away || targetMatch.topScorers?.away || [];
    const allScorers = [...homeScorers, ...awayScorers];

    // Value Bet Betclic
    const firstVb = valueBets.length > 0 ? valueBets[0] : null;
    const vbLabel = firstVb ? (firstVb.selection_label || firstVb.side || (firstVb.selection === '1' ? `Victoire ${home}` : firstVb.selection === '2' ? `Victoire ${away}` : 'Match Nul')) : '';
    const vbSummary = firstVb
      ? `${vbLabel} @ ${firstVb.betclic_odd || firstVb.odd || firstVb.bookmaker_odds || odds?.home} (Edge : ${firstVb.edge_percentage || firstVb.edge})`
      : (odds && odds.home ? `Ligne 1N2 (1: ${odds.home} / N: ${odds.draw} / 2: ${odds.away})` : 'Cotes Betclic en direct');

    // Appel direct au moteur RAG unifié
    const ragResponse = queryCopilotRAG(question, null, targetMatch);

    return {
      match: `${home} vs ${away}`,
      homeTeam: home,
      awayTeam: away,
      lineupStatus,
      homeFormation: targetMatch.homeLineup?.formation || targetMatch.formations?.home || '4-3-3',
      awayFormation: targetMatch.awayLineup?.formation || targetMatch.formations?.away || '4-2-3-1',
      absenteesCount,
      netXgImpact,
      absenteesList,
      topScorers: allScorers,
      probabilities: { home: homeProb, draw: drawProb, away: awayProb },
      weather: `${weather.condition || 'Temps Clair'} · ${weather.temp_avg_c || 20}°C`,
      valueBet: vbSummary,
      justification: ragResponse
    };
  };

  // Initialisation du premier message lors de l'ouverture
  useEffect(() => {
    if (isOpen) {
      const activeMatch = selectedMatch || defaultTargetMatch;
      const initialAnalysis = generateRagAnalysis(activeMatch, `Analyse complète de ${activeMatch.homeTeam} vs ${activeMatch.awayTeam}`);
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

  const currentActiveMatch = selectedMatch || defaultTargetMatch;

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
    }, 350);
  };

  // Chips dynamiques selon le match affiché
  const dynamicChips = [
    `Quels joueurs peuvent marquer dans ce match ?`,
    `Qui prend le plus de cartons jaunes ?`,
    `Historique des confrontations directes H2H`,
    `Stats ${currentActiveMatch.homeTeam} domicile vs ${currentActiveMatch.awayTeam} extérieur`,
    `Conditions météo et sévérité de l arbitre`
  ];

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
          maxWidth: 760,
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
                  RAG Multi-Saisons
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 2 }}>
                Interrogation en direct de 4 793 matchs · 20 400 cartons · Cotes Betclic · Météo Stades
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

        {/* Dynamic Contextual Suggestion Chips */}
        <div style={{
          padding: '10px 20px',
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid var(--ivory-border)',
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
        }}>
          {dynamicChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleAsk(chip)}
              style={{
                fontSize: 11,
                padding: '6px 14px',
                borderRadius: 20,
                background: 'var(--ivory-ghost)',
                border: '1px solid var(--ivory-border)',
                color: 'var(--ivory-dim)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold)'; e.currentTarget.style.borderColor = 'var(--gold-border)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--ivory-dim)'; e.currentTarget.style.borderColor = 'var(--ivory-border)'; }}
            >
              💡 {chip}
            </button>
          ))}
        </div>

        {/* Chat Feed */}
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
                        <span style={{ fontSize: 9, color: 'var(--gold)' }}>· {scorer.goalProb || (scorer.goalProbVal ? Math.round(scorer.goalProbVal) + '%' : '24%')}</span>
                        {scorer.oddScorer && <span style={{ fontSize: 9, color: 'var(--neutral)' }}>@ {scorer.oddScorer}</span>}
                      </span>
                    ))}
                  </div>
                )}

                {/* Justification paragraph avec mise en page aérée */}
                <div style={{
                  fontSize: 13,
                  color: 'var(--ivory-dim)',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-line',
                  marginTop: 8,
                }}>
                  {data.justification}
                </div>
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
                Interrogation du Feature Store & Moteur RAG Football…
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
            placeholder="Posez votre question (buteurs, cartons, H2H, météo, cotes, arbitre)..."
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
