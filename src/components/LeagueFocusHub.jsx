import React, { useState, useMemo, useEffect } from 'react';
import APP_DATA from '../data/app_data.json';
import PLAYER_PHOTOS from '../data/player_photos.json';
import PLAYER_REGISTRY from '../data/compiled/players_master_registry.json';
import { fetchHistoryMatches } from '../services/historyService';

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

  const [historyMatches, setHistoryMatches] = useState([]);

  // Chargement asynchrone des matchs historiques pour la saison & ligue sélectionnées
  useEffect(() => {
    let isMounted = true;
    fetchHistoryMatches(selectedSeason, selectedLeague).then(data => {
      if (isMounted) {
        setHistoryMatches(data || []);
      }
    });
    return () => { isMounted = false; };
  }, [selectedSeason, selectedLeague]);

  // Combinaison des données historiques et actuelles
  const allMatches = useMemo(() => {
    return buildCombinedMatches(historyMatches, APP_DATA?.fullSchedule || []);
  }, [historyMatches]);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1400, margin: '0 auto' }}>
      {/* ── 1. Top Terminal Toolbar ── */}
      <div
        style={{
          background: '#121215',
          border: '1px solid #27272a',
          borderRadius: 6,
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              color: '#06b6d4', fontFamily: "'JetBrains Mono', monospace",
              textTransform: 'uppercase',
            }}>
              <Trophy size={13} /> FOCUS CHAMPIONNAT & STATS OFFICIELLES
            </span>
            <span style={{ color: '#27272a' }}>|</span>
            <span style={{ fontSize: 11, color: '#71717a', fontFamily: "'JetBrains Mono', monospace" }}>
              CLASSEMENTS · BUTEURS · PASSEURS · ARBITRAGE
            </span>
          </div>

          {/* Saison Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#71717a', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
              <Calendar size={12} color="#06b6d4" /> Saison :
            </span>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                background: '#18181b',
                border: '1px solid #27272a',
                color: '#fafafa',
                cursor: 'pointer',
                outline: 'none',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {AVAILABLE_SEASONS.map((s) => (
                <option key={s.code} value={s.code} style={{ background: '#121215', color: '#fafafa' }}>
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
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 2,
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
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: active ? 700 : 500,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: active ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid #27272a',
                  background: active ? 'rgba(6, 182, 212, 0.12)' : '#18181b',
                  color: active ? '#06b6d4' : '#a1a1aa',
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: 'all 0.15s',
                }}
              >
                <span>{l.flag}</span>
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
            background: '#121215',
            border: '1px solid #27272a',
            borderRadius: 4,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 12, color: '#71717a' }}>Équipes</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fafafa', fontFamily: 'var(--font-mono)' }}>
            {leagueKpis.teamsCount}
          </span>
        </div>

        <div
          style={{
            background: '#121215',
            border: '1px solid #27272a',
            borderRadius: 4,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 12, color: '#71717a' }}>Matchs Disputés</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#06b6d4', fontFamily: 'var(--font-mono)' }}>
            {leagueKpis.totalMatchesPlayed}
          </span>
        </div>

        <div
          style={{
            background: '#121215',
            border: '1px solid #27272a',
            borderRadius: 4,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 12, color: '#71717a' }}>Buts Marqués</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#06b6d4', fontFamily: 'var(--font-mono)' }}>
            {leagueKpis.netGoals}
          </span>
        </div>

        <div
          style={{
            background: '#121215',
            border: '1px solid #27272a',
            borderRadius: 4,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 12, color: '#71717a' }}>Moyenne Buts / m</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
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
          borderBottom: '1px solid #27272a',
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
                borderRadius: 4,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                border: active ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid transparent',
                background: active ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(139, 106, 60, 0.15))' : 'transparent',
                color: active ? '#06b6d4' : '#71717a',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={16} color={active ? '#06b6d4' : 'currentColor'} />
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
