import React, { useState } from 'react';
import { X, Sparkles, Layers } from 'lucide-react';
import TeamLogo from './ui/TeamLogo';
import RagTacticalBriefPanel from './RagTacticalBriefPanel';
import { useMatch } from '../context/MatchContext';

export default function AiPredictorModal({ isOpen, onClose, selectedMatch, APP_DATA }) {
  const { modelVersion = 'v3', setModelVersion } = useMatch();
  const [searchText, setSearchText] = useState('');

  if (!isOpen) return null;

  const schedule = APP_DATA?.fullSchedule || [];
  const activeMatch = (() => {
    const q = searchText.trim().toLowerCase();
    if (q.length >= 2) {
      const found = schedule.find(
        (m) =>
          (m.homeTeam || '').toLowerCase().includes(q) ||
          (m.awayTeam || '').toLowerCase().includes(q)
      );
      if (found) return found;
    }
    return selectedMatch || schedule[0] || null;
  })();

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(9, 9, 11, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-dialog-panel"
        style={{
          width: '100%',
          maxWidth: 840,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#09090b',
          border: '1px solid #27272a',
          borderRadius: 4,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* Modal Terminal Header */}
        <div style={{
          padding: '10px 16px',
          background: '#121215',
          borderBottom: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={14} color="#06b6d4" />
            <span style={{
              fontSize: 12, fontWeight: 700, color: '#fafafa',
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em'
            }}>
              INSPECTEUR RAG STRUCTURÉ (ZÉRO PAVÉ DE TEXTE)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Changer d'affiche (ex: PSG, Real...)"
              style={{
                background: '#09090b', border: '1px solid #27272a', borderRadius: 3,
                padding: '4px 8px', fontSize: 11, color: '#fafafa', width: 200, outline: 'none'
              }}
            />
            {['v3', 'v2', 'v1'].map((v) => (
              <button
                key={v}
                onClick={() => setModelVersion && setModelVersion(v)}
                style={{
                  padding: '3px 8px', fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700, borderRadius: 3, cursor: 'pointer',
                  border: modelVersion === v ? '1px solid #06b6d4' : '1px solid #27272a',
                  background: modelVersion === v ? 'rgba(6, 182, 212, 0.14)' : '#09090b',
                  color: modelVersion === v ? '#06b6d4' : '#a1a1aa',
                }}
              >
                {v.toUpperCase()}
              </button>
            ))}
            <button
              onClick={onClose}
              style={{
                background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa',
                padding: 4, borderRadius: 3, cursor: 'pointer', display: 'flex'
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Match Banner Bar */}
        {activeMatch && (
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid #27272a',
            background: '#09090b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TeamLogo teamName={activeMatch.homeTeam} size={20} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fafafa' }}>{activeMatch.homeTeam}</span>
              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#71717a' }}>VS</span>
              <TeamLogo teamName={activeMatch.awayTeam} size={20} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fafafa' }}>{activeMatch.awayTeam}</span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#a1a1aa' }}>
              1N2 ({modelVersion.toUpperCase()}) :{' '}
              <strong style={{ color: '#10b981' }}>{activeMatch.probabilities?.home}</strong> ·{' '}
              <span>{activeMatch.probabilities?.draw}</span> ·{' '}
              <strong style={{ color: '#06b6d4' }}>{activeMatch.probabilities?.away}</strong>
            </div>
          </div>
        )}

        {/* Structured RAG Content */}
        <div style={{ padding: 16 }}>
          <RagTacticalBriefPanel match={activeMatch} modelVersion={modelVersion} compact={false} />
        </div>
      </div>
    </div>
  );
}
