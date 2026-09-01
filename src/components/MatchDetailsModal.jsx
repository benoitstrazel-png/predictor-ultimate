import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, MapPin, Shield, Trophy, Users, Activity, Sparkles, TrendingUp, Award, Clock, RefreshCw, UserCheck, CheckCircle2, XCircle } from 'lucide-react';
import TeamLogo from './ui/TeamLogo';
import MatchTimeline from './MatchTimeline';
import TeamMatchStats from './TeamMatchStats';
import MatchPrediction from './MatchPrediction';
import UNIFIED_HISTORY from '../data/unified_history.json';
import { evaluateMatchPrediction } from '../utils/matchPredictionEvaluator';

/**
 * MatchDetailsModal Component
 * Comprehensive luxury modal displaying match details:
 * - Tab 1: Chronologie (Timeline as in user's reference image)
 * - Tab 2: Statistiques Comparatives (Dual progress bars for 10+ certified metrics)
 * - Tab 3: Compositions & Notes (Lineups, Starters, Bench, Ratings, Formations, Coaches)
 * - Tab 4: Pronostics & Analyse IA (Odds, Dixon-Coles prediction, Referee, Weather)
 */
export default function MatchDetailsModal({ match, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('timeline');
  const [isRefreshingOdds, setIsRefreshingOdds] = useState(false);

  // Lookup complete match data in UNIFIED_HISTORY if partial match was passed
  const activeMatch = useMemo(() => {
    if (!match) return null;
    if (match.lineups?.home?.starters?.length > 0) return match;
    const found = (UNIFIED_HISTORY || []).find(m =>
      m.id === match.id ||
      (m.homeTeam === (match.homeTeam || match.home_team) && m.awayTeam === (match.awayTeam || match.away_team) && (m.date === match.date || m.round === match.round))
    );
    return found ? { ...found, ...match, lineups: found.lineups || match.lineups, formations: found.formations || match.formations, coaches: found.coaches || match.coaches, timeline: found.timeline || match.timeline, teamStats: found.teamStats || match.teamStats } : match;
  }, [match]);

  const [currentMatch, setCurrentMatch] = useState(activeMatch);

  useEffect(() => {
    setCurrentMatch(activeMatch);
  }, [activeMatch]);

  const handleRefreshOdds = async () => {
    if (!match) return;
    setIsRefreshingOdds(true);
    try {
      const res = await fetch('http://localhost:5175/api/odds/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: match.id,
          homeTeam: match.homeTeam || match.home_team,
          awayTeam: match.awayTeam || match.away_team
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.betclicOdds) {
          match.betclicOdds = json.data.betclicOdds;
          match.oddsStatus = json.data.oddsStatus;
          match.oddsMarginPct = json.data.oddsMarginPct;
          match.probabilities = json.data.probabilities;
          match.valueBets = json.data.valueBets;
          setCurrentMatch({ ...match });
        }
      }
    } catch (e) {
      console.warn('API refresh offline:', e.message);
    } finally {
      setIsRefreshingOdds(false);
    }
  };

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !match) return null;

  const targetMatch = currentMatch || activeMatch || match;
  const homeTeam = targetMatch.homeTeam || targetMatch.home_team || 'Domicile';
  const awayTeam = targetMatch.awayTeam || targetMatch.away_team || 'Extérieur';
  const isFinished = targetMatch.status === 'FINISHED' || targetMatch.score !== 'À Venir';
  const isLive = targetMatch.status === 'LIVE';

  const scoreDisplay = targetMatch.score ? (typeof targetMatch.score === 'object' ? `${targetMatch.score.home} - ${targetMatch.score.away}` : targetMatch.score.replace('-', ' - ')) : (isFinished ? `${targetMatch.homeScore} - ${targetMatch.awayScore}` : (isLive ? 'LIVE' : 'VS'));

  const refereeName = typeof targetMatch.referee === 'object' ? targetMatch.referee?.name : (targetMatch.referee || 'Arbitre Officiel');
  const stadiumName = targetMatch.location || `Stade de ${homeTeam}`;

  const homeStarters = targetMatch.lineups?.home?.starters || [];
  const homeBench = targetMatch.lineups?.home?.bench || [];
  const homeFormation = targetMatch.lineups?.home?.formation || targetMatch.formations?.home || '4-3-3';
  const homeCoach = targetMatch.lineups?.home?.coach || targetMatch.coaches?.home || 'Entraîneur';

  const awayStarters = targetMatch.lineups?.away?.starters || [];
  const awayBench = targetMatch.lineups?.away?.bench || [];
  const awayFormation = targetMatch.lineups?.away?.formation || targetMatch.formations?.away || '4-3-3';
  const awayCoach = targetMatch.lineups?.away?.coach || targetMatch.coaches?.away || 'Entraîneur';

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          background: 'rgba(4, 6, 12, 0.85)',
          backdropFilter: 'blur(16px)',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 820,
            maxHeight: '92vh',
            background: 'var(--obsidian-2)',
            border: '1px solid var(--gold-border)',
            borderRadius: 24,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 70px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(201, 169, 110, 0.15)',
          }}
        >
          {/* ── MODAL HEADER / SCOREBOARD ── */}
          <div style={{
            position: 'relative',
            background: 'linear-gradient(180deg, rgba(26, 34, 54, 0.9) 0%, rgba(13, 18, 32, 0.95) 100%)',
            padding: '24px 28px 18px',
            borderBottom: '1px solid var(--ivory-border)',
          }}>
            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: 18,
                right: 18,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--ivory-border)',
                borderRadius: '50%',
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ivory)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              className="hover:bg-white/10"
            >
              <X size={18} />
            </button>

            {/* League & Round & Metadata tags */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <span style={{
                fontSize: 10,
                padding: '3px 9px',
                borderRadius: 6,
                background: 'var(--gold-muted)',
                color: 'var(--gold)',
                fontWeight: 800,
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                {match.league || 'Ligue 1'}
              </span>
              <span style={{
                fontSize: 11,
                padding: '3px 9px',
                borderRadius: 6,
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--ivory-dim)',
                border: '1px solid var(--ivory-border)',
                fontWeight: 600
              }}>
                {match.round || 'Journée 1'} · {match.season || '2026-2027'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--neutral)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={12} /> {match.date || match.matchDate || 'Date officielle'}
              </span>
            </div>

            {/* Match Teams Score Banner */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: 16,
            }}>
              {/* Home Team */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'flex-start' }}>
                <TeamLogo teamName={homeTeam} size="lg" />
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ivory)', margin: 0 }}>
                    {homeTeam}
                  </h2>
                  <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>👔 {homeCoach}</span>
                    <span>·</span>
                    <span>{homeFormation}</span>
                    {targetMatch.homeXg ? <span>· {targetMatch.homeXg} xG</span> : null}
                  </div>
                </div>
              </div>

              {/* Score Center Box */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 18px',
                background: 'var(--obsidian)',
                border: '1px solid var(--gold-border)',
                borderRadius: 14,
                boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)',
              }}>
                <span style={{
                  fontSize: 26,
                  fontWeight: 900,
                  color: isLive ? '#4ade80' : 'var(--ivory)',
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em'
                }}>
                  {scoreDisplay}
                </span>
                {targetMatch.halfTimeScore && (
                  <span style={{ fontSize: 10, color: 'var(--neutral)', marginTop: 2 }}>
                    (Mi-temps : {targetMatch.halfTimeScore})
                  </span>
                )}
                {isLive && (
                  <span style={{ fontSize: 9, color: '#4ade80', fontWeight: 800, textTransform: 'uppercase', marginTop: 2 }}>
                    ● En Direct
                  </span>
                )}
              </div>

              {/* Away Team */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'flex-end', textAlign: 'right' }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ivory)', margin: 0 }}>
                    {awayTeam}
                  </h2>
                  <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {targetMatch.awayXg ? <span>{targetMatch.awayXg} xG ·</span> : null}
                    <span>{awayFormation}</span>
                    <span>·</span>
                    <span>👔 {awayCoach}</span>
                  </div>
                </div>
                <TeamLogo teamName={awayTeam} size="lg" />
              </div>
            </div>

            {/* Stadium & Referee Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 14,
              paddingTop: 10,
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              fontSize: 11,
              color: 'var(--neutral)',
              flexWrap: 'wrap',
              gap: 8,
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={13} color="var(--gold)" /> {stadiumName}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Shield size={13} color="var(--gold)" /> Arbitre : <strong style={{ color: 'var(--ivory)' }}>{refereeName}</strong>
              </span>
            </div>
          </div>

          {/* ── TABS NAVIGATION BAR ── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--obsidian)',
            borderBottom: '1px solid var(--ivory-border)',
            padding: '0 20px',
            gap: 8,
            overflowX: 'auto',
          }}>
            {[
              { id: 'timeline', label: '📋 Chronologie (PJ)', icon: Clock },
              { id: 'stats', label: '📊 Statistiques Match', icon: Activity },
              { id: 'lineups', label: '👥 Compositions & Notes', icon: Users },
              { id: 'prediction', label: '🤖 Pronostics & IA', icon: Sparkles },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '12px 16px',
                    fontSize: 12,
                    fontWeight: isActive ? 800 : 500,
                    color: isActive ? 'var(--gold)' : 'var(--neutral)',
                    borderBottom: `2px solid ${isActive ? 'var(--gold)' : 'transparent'}`,
                    background: 'transparent',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── TAB CONTENT AREA (SCROLLABLE) ── */}
          <div style={{
            padding: 20,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            flex: 1,
          }}>
            {/* TAB 1: CHRONOLOGIE (MATCH TIMELINE) */}
            {activeTab === 'timeline' && (
              <MatchTimeline match={match} />
            )}

            {/* TAB 2: STATISTIQUES COMPARATIVES */}
            {activeTab === 'stats' && (
              <TeamMatchStats match={match} />
            )}

            {/* TAB 3: COMPOSITIONS & NOTES */}
            {activeTab === 'lineups' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {/* Home Team Lineup */}
                  <div style={{
                    background: 'rgba(13, 18, 32, 0.65)',
                    borderRadius: 16,
                    padding: 18,
                    border: '1px solid var(--ivory-border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TeamLogo teamName={homeTeam} size="xs" />
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ivory)' }}>{homeTeam}</span>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 800 }}>Titulaires (XI)</span>
                    </div>

                    {/* Home Coach & Formation Card */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(201, 169, 110, 0.08)',
                      border: '1px solid var(--gold-border)',
                      borderRadius: 10,
                      marginBottom: 12,
                      fontSize: 11,
                    }}>
                      <span style={{ color: 'var(--gold)', fontWeight: 800 }}>
                        📐 {homeFormation}
                      </span>
                      <span style={{ color: 'var(--ivory)', fontWeight: 700 }}>
                        👔 Entraîneur : <strong style={{ color: 'var(--gold)' }}>{homeCoach}</strong>
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {homeStarters.length > 0 ? (
                        homeStarters.map((p, idx) => {
                          const roleColor = p.role === 'G' ? '#38bdf8' : (p.role === 'D' ? '#60a5fa' : (p.role === 'M' ? '#4ade80' : '#fbbf24'));
                          const roleBg = p.role === 'G' ? 'rgba(56, 189, 248, 0.15)' : (p.role === 'D' ? 'rgba(96, 165, 250, 0.15)' : (p.role === 'M' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(251, 191, 36, 0.15)'));

                          return (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '5px 10px',
                                borderRadius: 6,
                                background: 'rgba(255, 255, 255, 0.03)',
                                fontSize: 11,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 18, fontSize: 10, color: 'var(--neutral)', fontFamily: 'monospace' }}>
                                  #{p.num || idx + 1}
                                </span>
                                <span style={{ fontWeight: 600, color: 'var(--ivory)' }}>
                                  {p.name} {p.captain ? ' (C)' : ''}
                                </span>
                                <span style={{
                                  fontSize: 9,
                                  fontWeight: 800,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: roleBg,
                                  color: roleColor
                                }}>
                                  {p.role}
                                </span>
                              </div>
                              {p.rating && (
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: p.rating >= 7.5 ? 'var(--gold)' : (p.rating >= 6.5 ? 'var(--positive)' : 'var(--neutral)'),
                                  background: 'rgba(0,0,0,0.3)',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                }}>
                                  {p.rating}
                                </span>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--neutral)', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                          Composition officielle non renseignée.
                        </div>
                      )}
                    </div>

                    {/* Home Bench */}
                    {homeBench.length > 0 && (
                      <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>
                          Remplaçants :
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {homeBench.map((p, idx) => (
                            <span key={idx} style={{
                              fontSize: 10,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: 'rgba(255, 255, 255, 0.04)',
                              color: 'var(--ivory-dim)',
                            }}>
                              {p.name} {p.subIn ? `(${p.subIn}')` : ''} {p.rating ? `· ★${p.rating}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Away Team Lineup */}
                  <div style={{
                    background: 'rgba(13, 18, 32, 0.65)',
                    borderRadius: 16,
                    padding: 18,
                    border: '1px solid var(--ivory-border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TeamLogo teamName={awayTeam} size="xs" />
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ivory)' }}>{awayTeam}</span>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 800 }}>Titulaires (XI)</span>
                    </div>

                    {/* Away Coach & Formation Card */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(201, 169, 110, 0.08)',
                      border: '1px solid var(--gold-border)',
                      borderRadius: 10,
                      marginBottom: 12,
                      fontSize: 11,
                    }}>
                      <span style={{ color: 'var(--gold)', fontWeight: 800 }}>
                        📐 {awayFormation}
                      </span>
                      <span style={{ color: 'var(--ivory)', fontWeight: 700 }}>
                        👔 Entraîneur : <strong style={{ color: 'var(--gold)' }}>{awayCoach}</strong>
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {awayStarters.length > 0 ? (
                        awayStarters.map((p, idx) => {
                          const roleColor = p.role === 'G' ? '#38bdf8' : (p.role === 'D' ? '#60a5fa' : (p.role === 'M' ? '#4ade80' : '#fbbf24'));
                          const roleBg = p.role === 'G' ? 'rgba(56, 189, 248, 0.15)' : (p.role === 'D' ? 'rgba(96, 165, 250, 0.15)' : (p.role === 'M' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(251, 191, 36, 0.15)'));

                          return (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '5px 10px',
                                borderRadius: 6,
                                background: 'rgba(255, 255, 255, 0.03)',
                                fontSize: 11,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 18, fontSize: 10, color: 'var(--neutral)', fontFamily: 'monospace' }}>
                                  #{p.num || idx + 1}
                                </span>
                                <span style={{ fontWeight: 600, color: 'var(--ivory)' }}>
                                  {p.name} {p.captain ? ' (C)' : ''}
                                </span>
                                <span style={{
                                  fontSize: 9,
                                  fontWeight: 800,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: roleBg,
                                  color: roleColor
                                }}>
                                  {p.role}
                                </span>
                              </div>
                              {p.rating && (
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: p.rating >= 7.5 ? 'var(--gold)' : (p.rating >= 6.5 ? 'var(--positive)' : 'var(--neutral)'),
                                  background: 'rgba(0,0,0,0.3)',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                }}>
                                  {p.rating}
                                </span>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--neutral)', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                          Composition officielle non renseignée.
                        </div>
                      )}
                    </div>

                    {/* Away Bench */}
                    {awayBench.length > 0 && (
                      <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>
                          Remplaçants :
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {awayBench.map((p, idx) => (
                            <span key={idx} style={{
                              fontSize: 10,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: 'rgba(255, 255, 255, 0.04)',
                              color: 'var(--ivory-dim)',
                            }}>
                              {p.name} {p.subIn ? `(${p.subIn}')` : ''} {p.rating ? `· ★${p.rating}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: PRONOSTICS & ANALYSE IA */}
            {activeTab === 'prediction' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Finished Match Prediction Post-Mortem Audit */}
                {isFinished && (() => {
                  const evalRes = evaluateMatchPrediction(targetMatch);
                  if (!evalRes || evalRes.isCorrect === null) return null;

                  return (
                    <div style={{
                      background: evalRes.isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${evalRes.isCorrect ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
                      borderRadius: 16,
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: evalRes.isCorrect ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: evalRes.isCorrect ? '#4ade80' : '#f87171',
                        }}>
                          {evalRes.isCorrect ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: evalRes.isCorrect ? '#4ade80' : '#f87171' }}>
                            {evalRes.isCorrect ? '✔ Prédiction 1N2 Validée par le Modèle' : '✖ Prédiction 1N2 Non Confirmée'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ivory-dim)', marginTop: 2 }}>
                            Prédit : <strong style={{ color: 'var(--ivory)' }}>{evalRes.predictedLabel} ({evalRes.predictedProb})</strong> · Résultat final officiel : <strong style={{ color: 'var(--gold)' }}>{evalRes.realScore} ({evalRes.realOutcome === '1' ? 'Victoire Dom' : evalRes.realOutcome === '2' ? 'Victoire Ext' : 'Nul'})</strong>
                          </div>
                        </div>
                      </div>

                      {evalRes.valueBet && (
                        <div style={{
                          padding: '4px 10px',
                          borderRadius: 8,
                          background: evalRes.valueBetWon ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          border: `1px solid ${evalRes.valueBetWon ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                          fontSize: 11,
                          fontWeight: 700,
                          color: evalRes.valueBetWon ? '#4ade80' : '#f87171',
                        }}>
                          Value Bet : {evalRes.valueBetWon ? `+${evalRes.valueBetNetProfit} U GAGNÉ` : '-1.00 U PERDU'}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* AI Summary Card */}
                <div style={{
                  background: 'rgba(13, 18, 32, 0.65)',
                  borderRadius: 16,
                  padding: 20,
                  border: '1px solid var(--ivory-border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 10 }}>
                    <Sparkles size={16} /> Résumé Analytique & Contexte de la Rencontre
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--ivory)', lineHeight: 1.6, margin: 0 }}>
                    {currentMatch.aiSummary || `Rencontre officielle ${currentMatch.league || 'Ligue'} ${currentMatch.season || '2026-2027'} : ${homeTeam} ${currentMatch.score || 'VS'} ${awayTeam}.`}
                  </p>
                </div>

                {/* Complete Detailed Prediction Engine */}
                <MatchPrediction match={currentMatch} />
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
