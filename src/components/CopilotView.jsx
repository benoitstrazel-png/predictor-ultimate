import React, { useState } from 'react';
import { queryCopilotRAG, rewriteQuery, getIndices } from '../utils/ragEngine.js';
import { calculateResilienceIndex, calculateSequelImpact } from '../utils/featureStore.js';
import {
  Bot,
  Send,
  Sparkles,
  RefreshCw,
  UserCheck,
  ShieldCheck,
  TrendingUp,
  Layers,
  Award,
  Terminal,
  CloudRain,
  Flame
} from 'lucide-react';

const ANALYSIS_MODES = [
  { id: 'MATCH_ANALYSIS', label: 'Match Preview 360°', icon: Layers },
  { id: 'DISCIPLINE_CARDS', label: 'Discipline & Cartons', icon: Award },
  { id: 'MATCH_SCORERS', label: 'Buteurs & xG Projections', icon: Flame },
  { id: 'H2H_HISTORY', label: 'H2H & Confrontations', icon: Layers },
  { id: 'HOME_AWAY_SPLITS', label: 'Splits Domicile / Extérieur', icon: TrendingUp },
  { id: 'WEATHER_CONDITIONS', label: 'Météo & Pelouse', icon: CloudRain },
  { id: 'VALUE_BETS', label: 'Value Bet Finder', icon: TrendingUp },
  { id: 'COACH_TACTICS', label: 'Entraîneur Virtuel', icon: UserCheck },
  { id: 'ML_EXPLAIN', label: 'Modèle Dixon-Coles', icon: Terminal },
];

const AVAILABLE_TEAMS = [
  'PSG', 'Marseille', 'Lyon', 'Monaco', 'Lille', 'Nice', 'Lens', 'Rennes', 'Strasbourg',
  'Real Madrid', 'FC Barcelona', 'Atlético Madrid', 'Athletic Club', 'Real Sociedad', 'Sevilla',
  'Manchester City', 'Arsenal', 'Liverpool', 'Chelsea', 'Manchester United', 'Tottenham', 'Aston Villa',
  'Bayern Munich', 'Borussia Dortmund', 'Bayer Leverkusen', 'RB Leipzig', 'Eintracht Frankfurt',
  'Inter Milan', 'AC Milan', 'Juventus', 'Napoli', 'AS Roma', 'Atalanta',
  'Benfica', 'Sporting CP', 'FC Porto'
];

export default function CopilotView() {
  const [selectedMode, setSelectedMode] = useState('MATCH_ANALYSIS');
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: [
        'Bonjour. Je suis votre Moteur RAG Football Predictor Ultimate.',
        'J analyse en temps réel plus de 4 800 rencontres officielles, 20 400 cartons, 13 600 buts et les cotes Betclic.',
        'Posez vos questions sur les buteurs probables, les joueurs sanctionnés de cartons, l historique H2H, le rendement domicile/extérieur, la météo ou les Value Bets.'
      ].join('\n'),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('PSG');

  const resilience = calculateResilienceIndex(selectedTeam);
  const sequel = calculateSequelImpact(selectedTeam);
  const { analyticsIndex } = getIndices();
  const teamStats = analyticsIndex.findTeamStats(selectedTeam);

  const handleSendMessage = (textToSend, modeOverride = null) => {
    const promptText = textToSend || inputPrompt;
    if (!promptText || promptText.trim().length === 0) return;

    const currentMode = modeOverride || selectedMode;
    const rewritten = rewriteQuery(promptText, currentMode);

    const userMsg = {
      sender: 'user',
      text: promptText,
      rewrittenQuery: rewritten.rewrittenQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputPrompt('');
    setIsSearching(true);

    setTimeout(() => {
      const aiResponseText = queryCopilotRAG(promptText, currentMode);
      const aiMsg = {
        sender: 'ai',
        text: aiResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsSearching(false);
    }, 350);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── HEADER ── */}
      <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '2.2rem',
            color: 'var(--ivory)',
            fontWeight: 400,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <Bot size={32} color="var(--gold)" />
            AI Predictor Copilot (Moteur RAG Omniscient)
          </h1>
          <p style={{ fontSize: 12, color: 'var(--neutral)', marginTop: 4 }}>
            Base Multi-Saisons : 4 793 Matchs · 20 400 Cartons · 2 060 Paires H2H · Modèle Dixon-Coles · Cotes Betclic
          </p>
        </div>

        {/* Feature Store Quick Metrics */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--gold-border)', borderRadius: 14, padding: '8px 16px', textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase' }}>Résilience ({selectedTeam})</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{resilience.score} / 10</div>
          </div>
          {teamStats?.home && (
            <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 14, padding: '8px 16px', textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase' }}>Win Rate Domicile</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--positive)' }}>{teamStats.home.winRateStr}</div>
            </div>
          )}
          {teamStats?.discipline && (
            <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 14, padding: '8px 16px', textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase' }}>Cartons Jaunes / M</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#facc15' }}>{teamStats.discipline.yellowsPerMatch}</div>
            </div>
          )}
        </div>
      </section>

      {/* ── MODE BAR SELECTOR ── */}
      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 4
      }}>
        {ANALYSIS_MODES.map(mode => {
          const Icon = mode.icon;
          const isActive = selectedMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: isActive ? 'var(--gold-muted)' : 'var(--obsidian-2)',
                color: isActive ? 'var(--gold)' : 'var(--neutral)',
                border: isActive ? '1px solid var(--gold-border)' : '1px solid var(--ivory-border)',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={14} />
              {mode.label}
            </button>
          );
        })}
      </div>

      {/* ── CHAT WINDOW & RAG ENGINE INTERFACE ── */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: '2.2fr 1fr',
        gap: 24,
      }}>

        {/* Left: Chat Feed */}
        <div style={{
          background: 'var(--glass-primary)',
          border: '1px solid var(--ivory-border)',
          borderRadius: 20,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          height: 600,
        }}>
          {/* Messages Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            paddingRight: 8,
            marginBottom: 16,
          }}>
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '92%',
                  background: m.sender === 'user' ? 'var(--gold-muted)' : 'var(--obsidian-2)',
                  border: `1px solid ${m.sender === 'user' ? 'var(--gold-border)' : 'var(--ivory-border)'}`,
                  borderRadius: 16,
                  padding: '16px 20px',
                  color: 'var(--ivory)',
                  fontSize: 13,
                  lineHeight: 1.65,
                  whiteSpace: 'pre-line',
                }}>
                  {m.text}
                  {m.rewrittenQuery && (
                    <div style={{
                      marginTop: 10,
                      paddingTop: 8,
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      fontSize: 10,
                      color: 'var(--gold)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <Sparkles size={11} /> Réécriture RAG : {m.rewrittenQuery}
                    </div>
                  )}
                  <div style={{ fontSize: 9, color: 'var(--neutral)', marginTop: 8, textAlign: 'right' }}>
                    {m.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {isSearching && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold)', fontSize: 12 }}>
                <RefreshCw className="animate-spin" size={14} />
                <span>Interrogation des 4 793 matchs et fusion du Feature Store Football en cours...</span>
              </div>
            )}
          </div>

          {/* Prompt Input Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--obsidian-3)',
            border: '1px solid var(--ivory-border)',
            borderRadius: 14,
            padding: '8px 14px',
          }}>
            <input
              type="text"
              value={inputPrompt}
              onChange={e => setInputPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              placeholder="Posez votre question (buteurs, cartons, H2H, stats domicile/extérieur, météo, arbitre, cotes)..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--ivory)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              onClick={() => handleSendMessage()}
              style={{
                background: 'var(--gold-muted)',
                border: '1px solid var(--gold-border)',
                color: 'var(--gold)',
                borderRadius: 10,
                padding: '8px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              <Send size={14} /> Analyser
            </button>
          </div>
        </div>

        {/* Right: Suggested RAG Prompt Templates & Team Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Team Quick Filter */}
          <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 10 }}>
              🎯 Sélection Club pour Analyse Ciblée
            </div>
            <select
              value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--obsidian-2)',
                border: '1px solid var(--ivory-border)',
                borderRadius: 10,
                color: 'var(--ivory)',
                padding: '8px 12px',
                fontSize: 12,
                outline: 'none',
              }}
            >
              {AVAILABLE_TEAMS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Quick Prompt Chips */}
          <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ivory)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} color="var(--gold)" /> Suggestions de Requêtes RAG
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { text: `Qui prend le plus de cartons jaunes à ${selectedTeam} et en Europe ?`, mode: 'DISCIPLINE_CARDS' },
                { text: `Quels joueurs peuvent marquer pour ${selectedTeam} ?`, mode: 'MATCH_SCORERS' },
                { text: `Statistiques de ${selectedTeam} à domicile vs à l extérieur`, mode: 'HOME_AWAY_SPLITS' },
                { text: `Historique des confrontations directes H2H pour ${selectedTeam}`, mode: 'H2H_HISTORY' },
                { text: `Conditions météo au stade et impact sur le jeu`, mode: 'WEATHER_CONDITIONS' },
                { text: 'Y a-t-il des Value Bets détectés aujourd hui ?', mode: 'VALUE_BETS' },
                { text: `Philosophie tactique et style de jeu de ${selectedTeam}`, mode: 'COACH_TACTICS' },
                { text: 'Comment fonctionne la loi de Poisson Dixon-Coles ?', mode: 'ML_EXPLAIN' },
              ].map((pItem, pIdx) => (
                <button
                  key={pIdx}
                  onClick={() => {
                    setSelectedMode(pItem.mode);
                    handleSendMessage(pItem.text, pItem.mode);
                  }}
                  style={{
                    background: 'var(--obsidian-2)',
                    border: '1px solid var(--ivory-border)',
                    borderRadius: 10,
                    padding: '8px 12px',
                    color: 'var(--neutral)',
                    fontSize: 11,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold)'; e.currentTarget.style.borderColor = 'var(--gold-border)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--neutral)'; e.currentTarget.style.borderColor = 'var(--ivory-border)'; }}
                >
                  💬 {pItem.text}
                </button>
              ))}
            </div>
          </div>
        </div>

      </section>

    </div>
  );
}
