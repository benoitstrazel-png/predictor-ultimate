import React, { useState, useMemo } from 'react';
import UNIFIED_HISTORY from '../data/unified_history.json';
import APP_DATA from '../data/app_data.json';
import PLAYER_PHOTOS from '../data/player_photos.json';
import PLAYER_REGISTRY from '../data/compiled/players_master_registry.json';

import {
  buildCombinedMatches,
  computeLeagueStandings,
  computeTopScorers,
  computeTopAssists,
  computeDisciplineStats,
  computeRefereeStats,
} from '../utils/standingsEngine';

import StandingsTable from './league/StandingsTable';
import ScorersAssistsView from './league/ScorersAssistsView';
import DisciplineView from './league/DisciplineView';
import RefereeLeaderboard from './league/RefereeLeaderboard';

import {
  Trophy,
  Flame,
  ShieldAlert,
  Scale,
  Calendar,
  Layers,
  ChevronDown,
  Activity,
  Goal,
  Sparkles,
} from 'lucide-react';

const SUPPORTED_LEAGUES = [
  { code: 'FRA-L1', name: 'Ligue 1', flag: '🇫🇷', country: 'France' },
  { code: 'ENG-PL', name: 'Premier League', flag: '🇬🇧', country: 'Angleterre' },
  { code: 'ESP-LL', name: 'La Liga', flag: '🇪🇸', country: 'Espagne' },
  { code: 'ITA-SA', name: 'Serie A', flag: '🇮🇹', country: 'Italie' },
  { code: 'GER-BL', name: 'Bundesliga', flag: '🇩🇪', country: 'Allemagne' },
  { code: 'EUR-CL', name: 'Ligue des Champions', flag: '🇪🇺', country: 'Europe' },
  { code: 'EUR-EL', name: 'Ligue Europa', flag: '🇪🇺', country: 'Europe' },
  { code: 'EUR-ECL', name: 'Ligue Conférence', flag: '🇪🇺', country: 'Europe' },
];

const AVAILABLE_SEASONS = [
  { code: '2026-2027', label: 'Saison 2026-2027 (Actuelle)' },
  { code: '2025-2026', label: 'Saison 2025-2026' },
  { code: '2024-2025', label: 'Saison 2024-2025' },
];

export default function LeagueFocusHub() {
  const [selectedLeague, setSelectedLeague] = useState('FRA-L1');
  const [selectedSeason, setSelectedSeason] = useState('2025-2026');
  const [activeSubTab, setActiveSubTab] = useState('STANDINGS'); // 'STANDINGS' | 'SCORERS_ASSISTS' | 'DISCIPLINE' | 'REFEREES'
  const [viewMode, setViewMode] = useState('ALL'); // 'ALL' | 'HOME' | 'AWAY'

  // Combinaison des données historiques et actuelles
  const allMatches = useMemo(() => {
    return buildCombinedMatches(UNIFIED_HISTORY || [], APP_DATA?.fullSchedule || []);
  }, []);

  // Calculs analytiques ultra-performants via le Standings Engine (mémoïsé)
  const standings = useMemo(() => {
    return computeLeagueStandings(allMatches, selectedLeague, selectedSeason, viewMode);
  }, [allMatches, selectedLeague, selectedSeason, viewMode]);

  const topScorers = useMemo(() => {
    return computeTopScorers(allMatches, selectedLeague, selectedSeason, PLAYER_REGISTRY, PLAYER_PHOTOS, 50);
  }, [allMatches, selectedLeague, selectedSeason]);

  const topAssists = useMemo(() => {
    return computeTopAssists(allMatches, selectedLeague, selectedSeason, PLAYER_REGISTRY, PLAYER_PHOTOS, 50);
  }, [allMatches, selectedLeague, selectedSeason]);

  const disciplineData = useMemo(() => {
    return computeDisciplineStats(allMatches, selectedLeague, selectedSeason, PLAYER_REGISTRY, PLAYER_PHOTOS, 50);
  }, [allMatches, selectedLeague, selectedSeason]);

  const refereeStats = useMemo(() => {
    return computeRefereeStats(allMatches, selectedLeague, selectedSeason);
  }, [allMatches, selectedLeague, selectedSeason]);

  // Statistiques globales de la compétition sélectionnée
  const leagueKpis = useMemo(() => {
    const totalGoals = standings.reduce((acc, t) => acc + (t.goalsFor || 0), 0);
    // Diviser par 2 car chaque but est compté pour le club et contre l'adversaire en vue générale
    const netGoals = viewMode === 'ALL' ? Math.round(totalGoals / 2) : totalGoals;
    const totalMatchesPlayed = Math.round(standings.reduce((acc, t) => acc + (t.played || 0), 0) / 2);
    const avgGoalsPerMatch = totalMatchesPlayed > 0 ? (netGoals / totalMatchesPlayed).toFixed(2) : '0.00';

    return {
      totalMatchesPlayed,
      netGoals,
      avgGoalsPerMatch,
      teamsCount: standings.length,
    };
  }, [standings, viewMode]);

  const currentLeagueObj = SUPPORTED_LEAGUES.find((l) => l.code === selectedLeague) || SUPPORTED_LEAGUES[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* ── 1. Top Cinematic Cockpit Header ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(20, 26, 38, 0.95) 0%, rgba(13, 17, 26, 0.98) 100%)',
          border: '1px solid var(--gold-border)',
          borderRadius: 20,
          padding: '24px 28px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), inset 0 0 30px rgba(212, 175, 55, 0.05)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle background glow */}
        <div
          style={{
            position: 'absolute',
            top: -60,
            right: -60,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.25), rgba(139, 106, 60, 0.15))',
                border: '1px solid rgba(212, 175, 55, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--gold)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              <Trophy size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: 'var(--ivory)',
                    fontFamily: 'var(--font-serif)',
                    letterSpacing: '-0.02em',
                    margin: 0,
                  }}
                >
                  Focus Championnat & Stats
                </h1>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(212, 175, 55, 0.15)',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                    color: '#f5d77f',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  ENGINE V2
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(245, 240, 232, 0.6)' }}>
                Exploration analytique, classements officiels, buteurs, passeurs et baromètre d'arbitrage.
              </p>
            </div>
          </div>

          {/* Saison Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(245,240,232,0.6)', fontSize: 12, fontWeight: 600 }}>
              <Calendar size={15} color="var(--gold)" />
              Saison :
            </div>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--gold-border)',
                color: '#f5d77f',
                cursor: 'pointer',
                outline: 'none',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {AVAILABLE_SEASONS.map((s) => (
                <option key={s.code} value={s.code} style={{ background: '#141a26', color: '#f5d77f' }}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── 2. Competition Carousel / Pills ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
            scrollbarWidth: 'none',
          }}
        >
          {SUPPORTED_LEAGUES.map((l) => {
            const active = selectedLeague === l.code;
            return (
              <button
                key={l.code}
                onClick={() => setSelectedLeague(l.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: active ? '1px solid rgba(212, 175, 55, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: active ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.25), rgba(139, 106, 60, 0.2))' : 'rgba(0, 0, 0, 0.25)',
                  color: active ? '#f5d77f' : 'rgba(245, 240, 232, 0.7)',
                  transition: 'all 0.2s',
                  boxShadow: active ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                <span style={{ fontSize: 16 }}>{l.flag}</span>
                <span>{l.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. Quick KPI Ribbon ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 12, color: 'rgba(245, 240, 232, 0.6)' }}>Équipes</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--ivory)', fontFamily: 'var(--font-mono)' }}>
            {leagueKpis.teamsCount}
          </span>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 12, color: 'rgba(245, 240, 232, 0.6)' }}>Matchs Disputés</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
            {leagueKpis.totalMatchesPlayed}
          </span>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 12, color: 'rgba(245, 240, 232, 0.6)' }}>Buts Marqués</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#f5d77f', fontFamily: 'var(--font-mono)' }}>
            {leagueKpis.netGoals}
          </span>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 12, color: 'rgba(245, 240, 232, 0.6)' }}>Moyenne Buts / m</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
            {leagueKpis.avgGoalsPerMatch}
          </span>
        </div>
      </div>

      {/* ── 4. Main Sub-Navigation Tabs ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: 12,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {[
          { key: 'STANDINGS', label: '1. Classement Officiel', icon: Trophy },
          { key: 'SCORERS_ASSISTS', label: '2. Buteurs & Passeurs', icon: Flame },
          { key: 'DISCIPLINE', label: '3. Fautes & Discipline', icon: ShieldAlert },
          { key: 'REFEREES', label: '4. Baromètre des Arbitres', icon: Scale },
        ].map(({ key, label, icon: Icon }) => {
          const active = activeSubTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveSubTab(key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                border: active ? '1px solid rgba(212, 175, 55, 0.4)' : '1px solid transparent',
                background: active ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(139, 106, 60, 0.15))' : 'transparent',
                color: active ? '#f5d77f' : 'rgba(245, 240, 232, 0.6)',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={16} color={active ? '#f5d77f' : 'currentColor'} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── 5. Dynamic Cockpit Sub-Views ── */}
      <div>
        {activeSubTab === 'STANDINGS' && (
          <StandingsTable
            standings={standings}
            viewMode={viewMode}
            setViewMode={setViewMode}
            leagueId={selectedLeague}
            season={selectedSeason}
          />
        )}

        {activeSubTab === 'SCORERS_ASSISTS' && (
          <ScorersAssistsView
            scorers={topScorers}
            assists={topAssists}
            leagueId={selectedLeague}
            season={selectedSeason}
          />
        )}

        {activeSubTab === 'DISCIPLINE' && (
          <DisciplineView
            disciplineData={disciplineData}
            leagueId={selectedLeague}
            season={selectedSeason}
          />
        )}

        {activeSubTab === 'REFEREES' && (
          <RefereeLeaderboard
            refereeStats={refereeStats}
            leagueId={selectedLeague}
            season={selectedSeason}
          />
        )}
      </div>
    </div>
  );
}
