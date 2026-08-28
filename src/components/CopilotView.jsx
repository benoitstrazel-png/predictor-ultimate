import React, { useState } from 'react';
import { queryCopilotRAG } from '../utils/ragEngine';
import { calculateResilienceIndex, calculateSequelImpact } from '../utils/featureStore';
import { Bot, Send, Sparkles, ShieldAlert, Zap, RefreshCw, MessageSquare } from 'lucide-react';

export default function CopilotView() {
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Bonjour ! Je suis votre AI Predictor Copilot (Moteur RAG 100% Câblé). Posez-moi vos questions tactiques sur les matchs, les suspensions, la résilience des équipes ou les sévérités d\'arbitres.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('PSG');

  const resilience = calculateResilienceIndex(selectedTeam);
  const sequel = calculateSequelImpact(selectedTeam);

  const handleSendMessage = (textToSend) => {
    const promptText = textToSend || inputPrompt;
    if (!promptText || promptText.trim().length === 0) return;

    const userMsg = {
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputPrompt('');
    setIsSearching(true);

    setTimeout(() => {
      const aiResponseText = queryCopilotRAG(promptText);
      const aiMsg = {
        sender: 'ai',
        text: aiResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsSearching(false);
    }, 600);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── HEADER ── */}
      <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            AI Predictor Copilot (Moteur RAG Live)
          </h1>
          <p style={{ fontSize: 12, color: 'var(--neutral)', marginTop: 4 }}>
            Assistant d'Analyse Tactique Augmentée & Consultation de la Mémoire Prédictive Long-Terme
          </p>
        </div>

        {/* Feature Store Quick Metrics */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--gold-border)', borderRadius: 14, padding: '8px 16px', textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase' }}>Indice Résilience ({selectedTeam})</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{resilience.score} / 10</div>
          </div>
          <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 14, padding: '8px 16px', textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase' }}>Impact Séquelles</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--positive)' }}>{sequel.impactScore}</div>
          </div>
        </div>
      </section>

      {/* ── CHAT WINDOW & RAG ENGINE INTERFACE ── */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
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
          height: 520,
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
                  maxWidth: '85%',
                  background: m.sender === 'user' ? 'var(--gold-muted)' : 'var(--obsidian-2)',
                  border: `1px solid ${m.sender === 'user' ? 'var(--gold-border)' : 'var(--ivory-border)'}`,
                  borderRadius: 16,
                  padding: '14px 18px',
                  color: 'var(--ivory)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-line',
                }}>
                  {m.text}
                  <div style={{ fontSize: 9, color: 'var(--neutral)', marginTop: 6, textAlign: 'right' }}>
                    {m.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {isSearching && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold)', fontSize: 12 }}>
                <RefreshCw className="animate-spin" size={14} />
                <span>Interrogation RAG de la Base de Données Unifiée en cours...</span>
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
              placeholder="Posez votre question (ex: Analyse du comportement de PSG après un rouge)..."
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
              <Send size={14} /> Envoyer
            </button>
          </div>
        </div>

        {/* Right: Suggested RAG Prompt Templates & Team Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Team Quick Filter */}
          <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 10 }}>
              🎯 Sélection Équipe pour Analyse RAG
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
              {['PSG', 'Marseille', 'Lyon', 'Monaco', 'Real Madrid', 'FC Barcelona', 'Manchester City', 'Arsenal', 'Liverpool', 'Inter Milan', 'Bayern Munich'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Quick Prompt Chips */}
          <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ivory)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} color="var(--gold)" /> Prompts Recommandés RAG
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                `Analyse le comportement de ${selectedTeam} après avoir concédé un carton rouge`,
                `Analyse du choc ${selectedTeam} vs Arsenal`,
                `Quel est le bilan et l'indice de résilience de ${selectedTeam} ?`,
                `Sévérité des arbitres et fréquence de cartons pour ${selectedTeam}`,
              ].map((pText, pIdx) => (
                <button
                  key={pIdx}
                  onClick={() => handleSendMessage(pText)}
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
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--gold)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--neutral)'}
                >
                  💬 {pText}
                </button>
              ))}
            </div>
          </div>
        </div>

      </section>

    </div>
  );
}
