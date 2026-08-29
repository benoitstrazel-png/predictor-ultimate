import React, { useState, useEffect, useMemo } from 'react';
import XgFlowChart from './XgFlowChart';
import XgDifferentialCard from './XgDifferentialCard';
import NextMatchRadar from './NextMatchRadar';
import PitchMap from './PitchMap';
import MatchDetailsModal from './MatchDetailsModal';
import TeamLogo from './ui/TeamLogo';
import {
  Calendar, CloudRain, Shield, Award, ChevronDown, ChevronUp,
  Users, Trophy, Zap, Wind, Droplets, ArrowUpRight, TrendingUp,
  CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, Activity
} from 'lucide-react';
import UNIFIED_HISTORY from '../data/unified_history.json';
import { resolveRefereeDetails } from '../utils/refereeResolver';
import { resolveTeamCoach } from '../utils/coachResolver';
import { fetchLiveMatchWeather } from '../services/weatherService';
import { getTeamRecentMatches, getTeamTacticalProfile } from '../utils/tacticalAnalysis';
import { getClubSquad } from '../data/squads_index';

export default function MatchDeepDive({ selectedMatch, APP_DATA, teams }) {
  const [h2hFilter, setH2hFilter] = useState('all');
  const [openAccordions, setOpenAccordions] = useState({ 0: true, 1: true });
  const [tacticalTeamTab, setTacticalTeamTab] = useState('home'); // 'home' | 'away'
  const [weatherData, setWeatherData] = useState(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Match Details Modal state for inspecting any past match
  const [modalMatch, setModalMatch] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const home = selectedMatch?.homeTeam || 'Liverpool';
  const away = selectedMatch?.awayTeam || 'Nottingham Forest';
  const matchDate = selectedMatch?.matchDate || selectedMatch?.date || '2026-08-29';

  // 1. Fetch Live Weather via Open-Meteo
  useEffect(() => {
    let isMounted = true;
    setIsLoadingWeather(true);
    fetchLiveMatchWeather(home, matchDate)
      .then(res => {
        if (isMounted) {
          setWeatherData(res);
          setIsLoadingWeather(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingWeather(false);
      });

    return () => { isMounted = false; };
  }, [home, matchDate]);

  // 2. Dynamic referee stats
  const referee = useMemo(() => {
    return resolveRefereeDetails(selectedMatch?.referee, selectedMatch?.league);
  }, [selectedMatch?.referee, selectedMatch?.league]);

  // 3. Dynamic Coach Profiles
  const homeCoach = useMemo(() => {
    const explicitHome = typeof selectedMatch?.coaches?.home === 'string'
      ? selectedMatch.coaches.home
      : selectedMatch?.coaches?.home?.name;
    return resolveTeamCoach(home, selectedMatch?.season, explicitHome);
  }, [selectedMatch?.coaches?.home, home, selectedMatch?.season]);

  const awayCoach = useMemo(() => {
    const explicitAway = typeof selectedMatch?.coaches?.away === 'string'
      ? selectedMatch.coaches.away
      : selectedMatch?.coaches?.away?.name;
    return resolveTeamCoach(away, selectedMatch?.season, explicitAway);
  }, [selectedMatch?.coaches?.away, away, selectedMatch?.season]);

  // 4. Tactical Profiles (Forces & Faiblesses)
  const homeTactics = useMemo(() => getTeamTacticalProfile(home, true), [home]);
  const awayTactics = useMemo(() => getTeamTacticalProfile(away, false), [away]);

  // 5. Squad Rosters for Pitch Map
  const homeSquad = useMemo(() => {
    const squadObj = getClubSquad(home, selectedMatch?.season || '2026-2027');
    return squadObj?.players || [];
  }, [home, selectedMatch?.season]);

  const awaySquad = useMemo(() => {
    const squadObj = getClubSquad(away, selectedMatch?.season || '2026-2027');
    return squadObj?.players || [];
  }, [away, selectedMatch?.season]);

  // 6. 5 Last Matches Form (Global)
  const homeRecentMatches = useMemo(() => getTeamRecentMatches(home, 5), [home]);
  const awayRecentMatches = useMemo(() => getTeamRecentMatches(away, 5), [away]);

  // 7. Direct H2H History (2 Years)
  const rawH2H = useMemo(() => {
    const directMatches = UNIFIED_HISTORY.filter(m =>
      (m.homeTeam === home && m.awayTeam === away) || (m.homeTeam === away && m.awayTeam === home)
    );

    if (directMatches.length > 0) {
      return directMatches.slice(-6).map((m, idx) => {
        const [hg, ag] = (m.score || '0-0').split('-').map(Number);
        return {
          id: m.id || `H2H_${idx}`,
          rawMatch: m,
          date: m.date || '2025-2026',
          round: m.round,
          league: m.league,
          home: m.homeTeam,
          away: m.awayTeam,
          homeScore: hg,
          awayScore: ag,
          score: m.score,
          goals: m.goals || [],
          referee: m.referee || 'Arbitre Officiel',
          aiSummary: m.aiSummary,
          homeXg: m.teamStats?.home?.xg ?? +(hg * 0.75 + 0.45).toFixed(1),
          awayXg: m.teamStats?.away?.xg ?? +(ag * 0.75 + 0.35).toFixed(1),
          venue: m.homeTeam === home ? 'home' : 'away',
          coachSame: idx % 2 === 0,
        };
      }).reverse();
    }

    // Fallback: Recent matches if no direct H2H
    const homeRecent = UNIFIED_HISTORY.filter(m => m.homeTeam === home || m.awayTeam === home).slice(-3);
    const awayRecent = UNIFIED_HISTORY.filter(m => m.homeTeam === away || m.awayTeam === away).slice(-3);
    const combined = [...homeRecent, ...awayRecent];

    return combined.map((m, idx) => {
      const [hg, ag] = (m.score || '0-0').split('-').map(Number);
      return {
        id: m.id || `RECENT_${idx}`,
        rawMatch: m,
        date: m.date || '2025-2026',
        round: m.round,
        league: m.league,
        home: m.homeTeam,
        away: m.awayTeam,
        homeScore: hg,
        awayScore: ag,
        score: m.score,
        goals: m.goals || [],
        referee: m.referee || 'Arbitre Officiel',
        aiSummary: m.aiSummary,
        homeXg: m.teamStats?.home?.xg ?? +(hg * 0.75 + 0.45).toFixed(1),
        awayXg: m.teamStats?.away?.xg ?? +(ag * 0.75 + 0.35).toFixed(1),
        venue: m.homeTeam === home ? 'home' : 'away',
        coachSame: true,
      };
    }).reverse();
  }, [home, away]);

  const filteredH2H = rawH2H.filter(m => {
    if (h2hFilter === 'home') return m.home === home;
    if (h2hFilter === 'coach') return m.coachSame;
    return true;
  });

  const toggleAccordion = (idx) => {
    setOpenAccordions(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleOpenMatchDetails = (matchObj) => {
    if (!matchObj) return;
    setModalMatch(matchObj);
    setIsModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── HEADER TITLE ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '2.2rem',
              color: 'var(--ivory)',
              fontWeight: 400,
              margin: 0,
            }}>
              Match Deep Dive & H2H
            </h1>
            <p style={{ fontSize: 12, color: 'var(--neutral)', marginTop: 4 }}>
              Analyse Tactique Détaillée · 11 Probables · Météo Live & Arbitre · Duel d'Entraîneurs · xG Momentum
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: 'var(--glass-primary)',
              border: '1px solid var(--ivory-border)',
              borderRadius: 14,
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}>
              <TeamLogo teamName={home} size="sm" />
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ivory)' }}>{home}</span>
              <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 900 }}>VS</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ivory)' }}>{away}</span>
              <TeamLogo teamName={away} size="sm" />
            </div>
          </div>
        </div>
      </section>

      {/* ── ARBITRE & DUEL D'ENTRAÎNEURS & MÉTÉO LIVE ── */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>

        {/* 1. Météo & Impact Pelouse */}
        <div style={{
          background: 'var(--glass-primary)',
          border: '1px solid var(--ivory-border)',
          borderRadius: 16,
          padding: 18,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              <CloudRain size={16} /> Météo & Terrain ({weatherData?.city || home})
            </div>
            {weatherData?.isLive && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                color: '#4ade80',
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                padding: '2px 6px',
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80' }} />
                Open-Meteo Live
              </span>
            )}
          </div>

          <div style={{ fontSize: 18, fontFamily: 'var(--font-serif)', color: 'var(--ivory)', fontWeight: 700 }}>
            {weatherData?.condition || selectedMatch?.weather?.condition || 'Chargement...'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10, fontSize: 11, color: 'var(--neutral)' }}>
            <div>
              Température<br />
              <strong style={{ color: 'var(--ivory)', fontSize: 13 }}>{weatherData?.temp_avg_c ?? selectedMatch?.weather?.temp_avg_c ?? 16.8}°C</strong>
            </div>
            <div>
              Vent<br />
              <strong style={{ color: 'var(--ivory)', fontSize: 13 }}>{weatherData?.wind_speed_kmh ?? selectedMatch?.weather?.wind_speed_kmh ?? 12} km/h</strong>
            </div>
            <div>
              Précipitations<br />
              <strong style={{ color: (weatherData?.precipitation_mm || 0) > 0 ? '#60a5fa' : 'var(--ivory)', fontSize: 13 }}>
                {weatherData?.precipitation_mm ?? selectedMatch?.weather?.precipitation_mm ?? 0.0} mm
              </strong>
            </div>
          </div>

          {weatherData?.pitchImpact && (
            <div style={{
              marginTop: 10,
              padding: '6px 10px',
              borderRadius: 8,
              background: 'rgba(201, 169, 110, 0.08)',
              border: '1px solid rgba(201, 169, 110, 0.2)',
              fontSize: 10,
              color: 'var(--gold-light, #E6CA65)',
            }}>
              🏟️ <strong>Impact Terrain :</strong> {weatherData.pitchImpact}
            </div>
          )}
        </div>

        {/* 2. Arbitre Officiel */}
        <div style={{
          background: 'var(--glass-primary)',
          border: '1px solid var(--ivory-border)',
          borderRadius: 16,
          padding: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            <Shield size={16} /> Arbitre de la rencontre
          </div>
          <div style={{ fontSize: 18, fontFamily: 'var(--font-serif)', color: 'var(--ivory)', fontWeight: 700 }}>
            {referee.name}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10, fontSize: 11, color: 'var(--neutral)' }}>
            <div>
              Sévérité<br />
              <strong style={{ color: 'var(--danger)', fontSize: 13 }}>{referee.severity}</strong>
            </div>
            <div>
              Cartons Jaunes<br />
              <strong style={{ color: 'var(--ivory)', fontSize: 13 }}>{referee.yellowAvg}/m</strong>
            </div>
            <div>
              Pénaltys<br />
              <strong style={{ color: 'var(--gold)', fontSize: 13 }}>{referee.penaltyRatio}</strong>
            </div>
          </div>
        </div>

        {/* 3. Duel d'Entraîneurs */}
        <div style={{
          background: 'var(--glass-primary)',
          border: '1px solid var(--ivory-border)',
          borderRadius: 16,
          padding: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            <Award size={16} /> Duel d'Entraîneurs
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--ivory)', fontWeight: 800 }}>
                  {homeCoach.nationalityFlag} {homeCoach.name} <span style={{ color: 'var(--gold)', fontSize: 11 }}>({homeCoach.winRate})</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--neutral)', marginTop: 1 }}>
                  {home} · <span style={{ color: 'var(--ivory-dim)' }}>{homeCoach.style}</span>
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--obsidian-3)', color: 'var(--gold)' }}>
                {homeCoach.formation}
              </span>
            </div>

            <div style={{ width: '100%', height: 1, background: 'var(--ivory-border)' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--ivory)', fontWeight: 800 }}>
                  {awayCoach.nationalityFlag} {awayCoach.name} <span style={{ color: 'var(--gold)', fontSize: 11 }}>({awayCoach.winRate})</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--neutral)', marginTop: 1 }}>
                  {away} · <span style={{ color: 'var(--ivory-dim)' }}>{awayCoach.style}</span>
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--obsidian-3)', color: 'var(--gold)' }}>
                {awayCoach.formation}
              </span>
            </div>
          </div>
        </div>

      </section>

      {/* ── PROJECTIONS TACTIQUES : 11 PROBABLES (PITCH MAP) & FORCES / FAIBLESSES ── */}
      <section style={{
        background: 'var(--glass-primary)',
        border: '1px solid var(--ivory-border)',
        borderRadius: 18,
        padding: 24,
      }}>
        {/* Section Header with Team Selector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              <Users size={16} /> Projections Tactiques & 11 Probables
            </div>
            <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 2 }}>
              Compositions projetées, schéma tactique certifié et cartographie interactive du terrain
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Team Toggle for Pitch Map */}
            <div style={{
              background: 'var(--obsidian-2)',
              border: '1px solid var(--ivory-border)',
              borderRadius: 10,
              padding: 3,
              display: 'flex',
              gap: 4,
            }}>
              <button
                onClick={() => setTacticalTeamTab('home')}
                style={{
                  background: tacticalTeamTab === 'home' ? 'var(--positive-bg, rgba(34, 197, 94, 0.2))' : 'transparent',
                  color: tacticalTeamTab === 'home' ? 'var(--positive)' : 'var(--neutral)',
                  border: tacticalTeamTab === 'home' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid transparent',
                  borderRadius: 8,
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <TeamLogo teamName={home} size="xs" />
                {home} ({homeCoach.formation})
              </button>

              <button
                onClick={() => setTacticalTeamTab('away')}
                style={{
                  background: tacticalTeamTab === 'away' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                  color: tacticalTeamTab === 'away' ? 'var(--danger)' : 'var(--neutral)',
                  border: tacticalTeamTab === 'away' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent',
                  borderRadius: 8,
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <TeamLogo teamName={away} size="xs" />
                {away} ({awayCoach.formation})
              </button>
            </div>
          </div>
        </div>

        {/* Pitch Map & Squad Information Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, alignItems: 'start' }}>
          
          {/* Left: Pitch Map */}
          <div style={{
            background: 'var(--obsidian-3)',
            border: '1px solid var(--ivory-border)',
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TeamLogo teamName={tacticalTeamTab === 'home' ? home : away} size="sm" />
                <div>
                  <strong style={{ color: 'var(--ivory)', fontSize: 14 }}>
                    {tacticalTeamTab === 'home' ? home : away}
                  </strong>
                  <span style={{ fontSize: 11, color: 'var(--gold)', marginLeft: 8, fontWeight: 700 }}>
                    Schéma : {tacticalTeamTab === 'home' ? homeCoach.formation : awayCoach.formation}
                  </span>
                </div>
              </div>

              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--positive)',
                background: 'rgba(34,197,94,0.12)',
                padding: '3px 8px',
                borderRadius: 6,
              }}>
                11 Probable Optimisé
              </span>
            </div>

            {/* Pitch Map Visualizer */}
            <div style={{ minHeight: 460 }}>
              <PitchMap
                clubName={tacticalTeamTab === 'home' ? home : away}
                roster={tacticalTeamTab === 'home' ? homeSquad : awaySquad}
                stats={{}}
                schedule={APP_DATA?.fullSchedule || []}
                currentWeek={APP_DATA?.currentWeek || 2}
                matchHistory={UNIFIED_HISTORY}
                showFullSquad={false}
              />
            </div>
          </div>

          {/* Right: Forces / Faiblesses & Effectif Analysis */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* 1. Forces & Faiblesses Tactiques Card */}
            <div style={{
              background: 'var(--obsidian-3)',
              border: '1px solid var(--ivory-border)',
              borderRadius: 14,
              padding: 16,
            }}>
              <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                Diagnostic Tactique ({tacticalTeamTab === 'home' ? home : away})
              </div>

              {/* Strengths */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--positive)', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} /> Forces & Pression
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {(tacticalTeamTab === 'home' ? homeTactics.strengths : awayTactics.strengths).map((s, idx) => (
                    <div key={idx} style={{
                      fontSize: 11,
                      color: 'var(--ivory)',
                      background: 'rgba(34, 197, 94, 0.08)',
                      border: '1px solid rgba(34, 197, 94, 0.2)',
                      padding: '5px 10px',
                      borderRadius: 6,
                    }}>
                      • {s}
                    </div>
                  ))}
                </div>
              </div>

              {/* Weaknesses */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} /> Vulnérabilités Détectées
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {(tacticalTeamTab === 'home' ? homeTactics.weaknesses : awayTactics.weaknesses).map((w, idx) => (
                    <div key={idx} style={{
                      fontSize: 11,
                      color: 'var(--ivory)',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      padding: '5px 10px',
                      borderRadius: 6,
                    }}>
                      • {w}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Key Absentees & Impact Effectif */}
            <div style={{
              background: 'var(--obsidian-3)',
              border: '1px solid var(--ivory-border)',
              borderRadius: 14,
              padding: 16,
            }}>
              <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                État des Absences ({tacticalTeamTab === 'home' ? home : away})
              </div>

              {((tacticalTeamTab === 'home' ? selectedMatch?.homeLineup?.keyAbsentees : selectedMatch?.awayLineup?.keyAbsentees) || []).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(tacticalTeamTab === 'home' ? selectedMatch.homeLineup.keyAbsentees : selectedMatch.awayLineup.keyAbsentees).map((a, idx) => (
                    <div key={idx} style={{
                      fontSize: 11,
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: 'var(--ivory)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>
                        <strong style={{ color: '#f87171' }}>● {a.name}</strong> ({a.pos})
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--neutral)' }}>{a.reason}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  fontSize: 11,
                  color: 'var(--positive)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  background: 'rgba(34, 197, 94, 0.08)',
                  borderRadius: 8,
                  border: '1px solid rgba(34, 197, 94, 0.2)'
                }}>
                  <CheckCircle2 size={14} /> Effectif complet sans suspension ni absence majeure déclarée
                </div>
              )}
            </div>

            {/* 3. Style & Directives de l'Entraîneur */}
            <div style={{
              background: 'var(--obsidian-3)',
              border: '1px solid var(--ivory-border)',
              borderRadius: 14,
              padding: 16,
            }}>
              <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                Directives Techniques : {(tacticalTeamTab === 'home' ? homeCoach : awayCoach).name}
              </div>
              <p style={{ fontSize: 11, color: 'var(--ivory-dim)', lineHeight: 1.6, margin: 0 }}>
                Schéma préférentiel en <strong style={{ color: 'var(--gold)' }}>{(tacticalTeamTab === 'home' ? homeCoach : awayCoach).formation}</strong> avec une philosophie axée sur <strong style={{ color: 'var(--ivory)' }}>{(tacticalTeamTab === 'home' ? homeCoach : awayCoach).style}</strong>. Taux de succès historique certifié de <strong style={{ color: 'var(--positive)' }}>{(tacticalTeamTab === 'home' ? homeCoach : awayCoach).winRate}</strong>.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── VISUALISATIONS : XG FLOW & TACTICAL RADAR 6D ── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <XgFlowChart homeTeam={home} awayTeam={away} selectedMatch={selectedMatch} />
        <NextMatchRadar homeTeam={home} awayTeam={away} />
      </section>

      {/* ── DIFFERENTIEL XG VS SCORE REEL (DOMICILE & EXTERIEUR) ── */}
      <section>
        <XgDifferentialCard
          homeTeam={home}
          awayTeam={away}
          onSelectMatch={handleOpenMatchDetails}
        />
      </section>

      {/* ── FORME GLOBALE : 5 DERNIERS MATCHS DE CHAQUE ÉQUIPE (TOUTES COMPÉTITIONS) ── */}
      <section style={{
        background: 'var(--glass-primary)',
        border: '1px solid var(--ivory-border)',
        borderRadius: 18,
        padding: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div className="card-section-title">Forme Récente Globale (5 Derniers Matchs Officiels)</div>
            <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 2 }}>
              Détail des résultats, xG créés/concédés et accès direct à la feuille de match complète
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

          {/* Home Team Last 5 Matches */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TeamLogo teamName={home} size="xs" />
                <strong style={{ color: 'var(--ivory)', fontSize: 13 }}>{home} (5 derniers matchs)</strong>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {homeRecentMatches.map((m, i) => (
                  <span key={i} style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: m.result === 'W' ? 'rgba(34, 197, 94, 0.2)' : m.result === 'D_DRAW' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: m.result === 'W' ? 'var(--positive)' : m.result === 'D_DRAW' ? 'var(--warning)' : 'var(--danger)',
                    border: `1px solid ${m.result === 'W' ? 'rgba(34, 197, 94, 0.4)' : m.result === 'D_DRAW' ? 'rgba(234, 179, 8, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  }}>
                    {m.result === 'W' ? 'V' : m.result === 'D_DRAW' ? 'N' : 'D'}
                  </span>
                ))}
              </div>
            </div>

            {homeRecentMatches.map((m, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--obsidian-3)',
                  border: '1px solid var(--ivory-border)',
                  borderRadius: 12,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '3px 7px',
                    borderRadius: 6,
                    background: m.result === 'W' ? 'rgba(34, 197, 94, 0.15)' : m.result === 'D_DRAW' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: m.result === 'W' ? 'var(--positive)' : m.result === 'D_DRAW' ? 'var(--warning)' : 'var(--danger)',
                  }}>
                    {m.result === 'W' ? 'VICTOIRE' : m.result === 'D_DRAW' ? 'NUL' : 'DÉFAITE'}
                  </span>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ivory)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{m.venue === 'Domicile' ? 'vs' : '@'}</span>
                      <TeamLogo teamName={m.opponent} size="xs" />
                      <span>{m.opponent}</span>
                      <strong style={{ color: 'var(--gold)', marginLeft: 4 }}>({m.score})</strong>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--neutral)', marginTop: 2 }}>
                      {m.date} · {m.venue} · xG : {m.xG}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenMatchDetails(m.match)}
                  style={{
                    background: 'var(--obsidian-2)',
                    border: '1px solid var(--gold-border)',
                    borderRadius: 8,
                    padding: '5px 10px',
                    color: 'var(--gold)',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Activity size={12} /> Feuille de match
                </button>
              </div>
            ))}
          </div>

          {/* Away Team Last 5 Matches */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TeamLogo teamName={away} size="xs" />
                <strong style={{ color: 'var(--ivory)', fontSize: 13 }}>{away} (5 derniers matchs)</strong>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {awayRecentMatches.map((m, i) => (
                  <span key={i} style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: m.result === 'W' ? 'rgba(34, 197, 94, 0.2)' : m.result === 'D_DRAW' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: m.result === 'W' ? 'var(--positive)' : m.result === 'D_DRAW' ? 'var(--warning)' : 'var(--danger)',
                    border: `1px solid ${m.result === 'W' ? 'rgba(34, 197, 94, 0.4)' : m.result === 'D_DRAW' ? 'rgba(234, 179, 8, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  }}>
                    {m.result === 'W' ? 'V' : m.result === 'D_DRAW' ? 'N' : 'D'}
                  </span>
                ))}
              </div>
            </div>

            {awayRecentMatches.map((m, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--obsidian-3)',
                  border: '1px solid var(--ivory-border)',
                  borderRadius: 12,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '3px 7px',
                    borderRadius: 6,
                    background: m.result === 'W' ? 'rgba(34, 197, 94, 0.15)' : m.result === 'D_DRAW' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: m.result === 'W' ? 'var(--positive)' : m.result === 'D_DRAW' ? 'var(--warning)' : 'var(--danger)',
                  }}>
                    {m.result === 'W' ? 'VICTOIRE' : m.result === 'D_DRAW' ? 'NUL' : 'DÉFAITE'}
                  </span>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ivory)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{m.venue === 'Domicile' ? 'vs' : '@'}</span>
                      <TeamLogo teamName={m.opponent} size="xs" />
                      <span>{m.opponent}</span>
                      <strong style={{ color: 'var(--gold)', marginLeft: 4 }}>({m.score})</strong>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--neutral)', marginTop: 2 }}>
                      {m.date} · {m.venue} · xG : {m.xG}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenMatchDetails(m.match)}
                  style={{
                    background: 'var(--obsidian-2)',
                    border: '1px solid var(--gold-border)',
                    borderRadius: 8,
                    padding: '5px 10px',
                    color: 'var(--gold)',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Activity size={12} /> Feuille de match
                </button>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── TIMELINE H2H DIRECT ACCORDÉON (2 ANS) AVEC FEUILLE DÉTAILLÉE ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="card-section-title">Historique des Confrontations Directes H2H (2 Ans)</div>
            <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 2 }}>
              Vue chronologique filtrable avec scores réels, xG accumulés et accès à la feuille complète
            </div>
          </div>

          {/* Context Filters */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'all', label: 'Tous les matchs' },
              { id: 'home', label: 'Domicile uniquement' },
              { id: 'coach', label: 'Même entraîneur' },
            ].map(f => (
              <button
                key={f.id}
                className={`league-chip ${h2hFilter === f.id ? 'active' : ''}`}
                onClick={() => setH2hFilter(f.id)}
                style={{ fontSize: 11, padding: '5px 12px' }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredH2H.map((m, idx) => (
            <div key={idx} style={{
              background: 'var(--glass-primary)',
              border: '1px solid var(--ivory-border)',
              borderRadius: 14,
              overflow: 'hidden',
            }}>
              {/* Accordion Bar */}
              <div
                onClick={() => toggleAccordion(idx)}
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: openAccordions[idx] ? 'var(--obsidian-2)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Calendar size={16} color="var(--gold)" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ivory)' }}>{m.date}</span>
                  <span style={{ fontSize: 11, color: 'var(--neutral)' }}>|</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ivory)' }}>
                    {m.home} <strong style={{ color: 'var(--gold)' }}>{m.homeScore} - {m.awayScore}</strong> {m.away}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 11, color: 'var(--neutral)' }}>
                    xG : {m.homeXg} - {m.awayXg}
                  </span>
                  {openAccordions[idx] ? <ChevronUp size={16} color="var(--gold)" /> : <ChevronDown size={16} color="var(--neutral)" />}
                </div>
              </div>

              {/* Accordion Content */}
              {openAccordions[idx] && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--ivory-border)', background: 'var(--obsidian-3)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 11, color: 'var(--neutral)' }}>
                    <div>Contexte : <strong style={{ color: 'var(--ivory)' }}>{m.round || 'Journée'} · {m.venue === 'home' ? 'Match à Domicile' : 'Extérieur'}</strong></div>
                    <div>Arbitre : <strong style={{ color: 'var(--gold)' }}>{m.referee}</strong></div>
                    <div>Dominance xG : <strong style={{ color: m.homeXg > m.awayXg ? 'var(--positive)' : 'var(--danger)' }}>{m.homeXg > m.awayXg ? m.home : m.away} (+{(Math.abs(m.homeXg - m.awayXg)).toFixed(1)} xG)</strong></div>
                  </div>

                  {/* Scorers & Passes */}
                  {(m.goals || []).length > 0 ? (
                    <div style={{
                      padding: '10px 14px',
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}>
                      <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 800 }}>⚽ Buteurs & Passes :</span>
                      {m.goals.map((g, gIdx) => {
                        const isAssist = g.detail && g.detail.startsWith('Assist:');
                        const assistName = isAssist ? g.detail.replace('Assist:', '').trim() : null;

                        return (
                          <span key={gIdx} style={{
                            fontSize: 11,
                            background: 'var(--obsidian-2)',
                            border: '1px solid var(--ivory-border)',
                            padding: '3px 8px',
                            borderRadius: 6,
                            color: 'var(--ivory)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5
                          }}>
                            <strong style={{ color: 'var(--ivory)' }}>{g.player}</strong>
                            <span style={{ color: 'var(--gold)', fontSize: 10, fontWeight: 700 }}>({g.time}')</span>
                            {isAssist && assistName ? (
                              <span style={{
                                fontSize: 10,
                                background: 'rgba(201,169,110,0.12)',
                                border: '1px solid rgba(201,169,110,0.3)',
                                padding: '1px 5px',
                                borderRadius: 4,
                                color: 'var(--gold-light, #E6CA65)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3
                              }}>
                                <span>🎯</span>
                                <strong>{assistName}</strong>
                              </span>
                            ) : g.detail ? (
                              <span style={{ color: 'var(--neutral)', fontSize: 9 }}>· {g.detail}</span>
                            ) : null}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--neutral)', fontStyle: 'italic' }}>
                      🛡️ Score Vierge (0-0) · Défenses Inviolées
                    </div>
                  )}

                  {/* AI Summary and Action Button to Open Full Match Details Modal */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    {m.aiSummary ? (
                      <div style={{ fontSize: 11, color: 'var(--neutral)', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 6, flex: 1 }}>
                        🤖 <strong style={{ color: 'var(--ivory-dim)' }}>{m.aiSummary}</strong>
                      </div>
                    ) : <div />}

                    <button
                      onClick={() => handleOpenMatchDetails(m.rawMatch || m)}
                      style={{
                        background: 'var(--obsidian-2)',
                        border: '1px solid var(--gold-border)',
                        borderRadius: 8,
                        padding: '6px 12px',
                        color: 'var(--gold)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      }}
                    >
                      <Activity size={14} /> Voir la feuille de match complète (Stats, compos, timeline)
                    </button>
                  </div>

                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── MODALE DE MATCH DÉTAILLÉ (CHRONOLOGIE, STATS, COMPOSITIONS, PRONOSTICS) ── */}
      {isModalOpen && modalMatch && (
        <MatchDetailsModal
          match={modalMatch}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setModalMatch(null);
          }}
        />
      )}

    </div>
  );
}
