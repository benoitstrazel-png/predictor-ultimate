import React, { useState, useMemo, useEffect } from 'react';
import APP_DATA from '../data/app_data.json';
import TeamLogo from './ui/TeamLogo';
import MatchDetailsModal from './MatchDetailsModal';
import { Search, Calendar, Tv, ShieldAlert, Award, ChevronDown, ChevronUp, Play, Users, Trophy, TrendingUp, Clock, ExternalLink, RefreshCw, CheckCircle2, XCircle, Sparkles, AlertCircle } from 'lucide-react';
import { evaluateMatchPrediction } from '../utils/matchPredictionEvaluator';
import { formatMatchTime } from '../utils/formatMatchTime';
import { fetchHistoryMatches } from '../services/historyService';

const parseRoundNumber = (val) => {
  if (!val || val === 'ALL') return null;
  if (typeof val === 'number') return val;
  const match = String(val).match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
};

export default function MatchHistoryHub() {
  const [historyArchiveMatches, setHistoryArchiveMatches] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState('2026-2027');
  const [selectedLeague, setSelectedLeague] = useState('FRA-L1');
  const [selectedRound, setSelectedRound] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [selectedModalMatch, setSelectedModalMatch] = useState(null);

  // Charger les archives à la demande dès que la saison ou la ligue change
  useEffect(() => {
    let isMounted = true;
    fetchHistoryMatches(selectedSeason, selectedLeague).then(data => {
      if (isMounted) {
        setHistoryArchiveMatches(data || []);
      }
    });
    return () => { isMounted = false; };
  }, [selectedSeason, selectedLeague]);

  // Combine les archives chargées avec APP_DATA fullSchedule
  const allMatchesHistory = useMemo(() => {
    const map = new Map();

    const getMatchKey = (m) => {
      const season = m.season || '2026-2027';
      const league = m.league || 'FRA-L1';
      const roundNum = parseRoundNumber(m.round || m.week) || 1;
      const home = (m.homeTeam || m.home || '').trim().toLowerCase();
      const away = (m.awayTeam || m.away || '').trim().toLowerCase();
      return `${season}_${league}_${roundNum}_${home}_${away}`;
    };

    // 1. Matchs historiques certifiés chargés dynamiquement
    (historyArchiveMatches || []).forEach(m => {
      const key = getMatchKey(m);
      map.set(key, {
        ...m,
        season: m.season || selectedSeason,
        round: m.round || (typeof m.week === 'number' ? `Journée ${m.week}` : 'Journée 1'),
        status: m.status || 'FINISHED',
      });
    });

    // 2. Calendrier complet 2026-2027 (J1 à J38 terminés + programmés)
    (APP_DATA?.fullSchedule || []).forEach(m => {
      const key = getMatchKey(m);
      const existing = map.get(key);
      if (existing) {
        // Fusion intelligente : si l'une des sources a FINISHED ou LIVE, ce statut prévaut sur SCHEDULED
        const isFin = m.status === 'FINISHED' || existing.status === 'FINISHED';
        const isLive = !isFin && (m.status === 'LIVE' || existing.status === 'LIVE');
        const resolvedStatus = isFin ? 'FINISHED' : (isLive ? 'LIVE' : 'SCHEDULED');

        // Score : privilégier un score chiffré réel sur "À Venir"
        let resolvedScore = 'À Venir';
        if (m.score && typeof m.score === 'object') {
          resolvedScore = `${m.score.home}-${m.score.away}`;
        } else if (m.score && m.score !== 'À Venir') {
          resolvedScore = m.score;
        } else if (existing.score && existing.score !== 'À Venir') {
          resolvedScore = existing.score;
        } else if (resolvedStatus === 'FINISHED') {
          const h = m.homeScore ?? existing.homeScore ?? 0;
          const a = m.awayScore ?? existing.awayScore ?? 0;
          resolvedScore = `${h}-${a}`;
        }

        map.set(key, {
          ...existing,
          ...m,
          id: m.id || existing.id,
          week: m.week || existing.week,
          round: typeof m.week === 'number' ? `Journée ${m.week}` : (m.round || existing.round),
          date: m.matchDate || m.date || existing.date,
          matchDate: m.matchDate || existing.matchDate,
          kickoffUtc: m.kickoffUtc || existing.kickoffUtc,
          homeTeam: m.homeTeam || existing.homeTeam,
          awayTeam: m.awayTeam || existing.awayTeam,
          homeLogo: m.homeLogo || existing.homeLogo,
          awayLogo: m.awayLogo || existing.awayLogo,
          score: resolvedScore,
          homeScore: (m.homeScore !== undefined && m.homeScore !== null) ? m.homeScore : existing.homeScore,
          awayScore: (m.awayScore !== undefined && m.awayScore !== null) ? m.awayScore : existing.awayScore,
          referee: (m.referee && typeof m.referee === 'object') ? m.referee : (existing.referee || m.referee),
          goals: (m.goals && m.goals.length > 0) ? m.goals : (existing.goals || []),
          status: resolvedStatus,
          aiSummary: m.aiSummary || existing.aiSummary,
          betclicOdds: m.betclicOdds || existing.betclicOdds,
          probabilities: m.probabilities || existing.probabilities,
          valueBets: (m.valueBets && m.valueBets.length > 0) ? m.valueBets : (existing.valueBets || []),
          weather: m.weather || existing.weather,
          lineups: existing.lineups || m.lineups,
          formations: existing.formations || m.formations,
          coaches: existing.coaches || m.coaches,
          timeline: (existing.timeline && existing.timeline.length > 0) ? existing.timeline : (m.timeline || []),
          teamStats: existing.teamStats || m.teamStats,
        });
      } else {
        map.set(key, {
          ...m,
          id: m.id,
          league: m.league,
          season: m.season || '2026-2027',
          round: typeof m.week === 'number' ? `Journée ${m.week}` : (m.week || 'Journée 1'),
          week: m.week,
          date: m.matchDate || m.date || '2026-2027',
          matchDate: m.matchDate,
          kickoffUtc: m.kickoffUtc,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          homeLogo: m.homeLogo,
          awayLogo: m.awayLogo,
          score: m.score ? (typeof m.score === 'object' ? `${m.score.home}-${m.score.away}` : m.score) : (m.status === 'FINISHED' ? `${m.homeScore}-${m.awayScore}` : (m.status === 'LIVE' ? 'LIVE' : 'À Venir')),
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          referee: m.referee?.name || (typeof m.referee === 'string' ? m.referee : 'Arbitre Officiel'),
          goals: m.goals || [],
          status: m.status || 'SCHEDULED',
          aiSummary: m.aiSummary || `Rencontre officielle de ${m.league} (${m.season || '2026-2027'}) opposant ${m.homeTeam} à ${m.awayTeam}.`,
          betclicOdds: m.betclicOdds,
          probabilities: m.probabilities,
          valueBets: m.valueBets || [],
          weather: m.weather,
          lineups: m.lineups,
          formations: m.formations,
          coaches: m.coaches,
          timeline: m.timeline,
          teamStats: m.teamStats,
        });
      }
    });

    const baseList = Array.from(map.values());
    return baseList;
  }, [historyArchiveMatches, selectedSeason]);

  const [liveOddsUpdates, setLiveOddsUpdates] = useState({});
  const [refreshingMatchId, setRefreshingMatchId] = useState(null);

  const handleRefreshOdds = async (e, match) => {
    e.stopPropagation();
    if (!match?.id) return;
    setRefreshingMatchId(match.id);
    try {
      let res;
      try {
        res = await fetch('/api/odds/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchId: match.id,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam
          })
        });
      } catch {
        res = await fetch('http://localhost:5175/api/odds/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchId: match.id,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam
          })
        });
      }
      if (res && res.ok) {
        const json = await res.json();
        if (json.data) {
          setLiveOddsUpdates(prev => ({
            ...prev,
            [match.id]: json.data
          }));
        }
      }
    } catch (err) {
      console.warn('API refresh error:', err.message);
    } finally {
      setRefreshingMatchId(null);
    }
  };



  // Maximum rounds depending on League (Ligue 1 & Bundesliga = 34, UEFA = 6-8, others = 38)
  const maxRoundsForLeague = useMemo(() => {
    if (selectedLeague === 'FRA-L1' || selectedLeague === 'GER-BL') return 34;
    if (selectedLeague === 'EUR-CL' || selectedLeague === 'EUR-EL') return 8;
    if (selectedLeague === 'EUR-ECL') return 6;
    return 38;
  }, [selectedLeague]);

  // Available Journées options
  const roundOptions = useMemo(() => {
    return ['ALL', ...Array.from({ length: maxRoundsForLeague }, (_, i) => `Journée ${i + 1}`)];
  }, [maxRoundsForLeague]);

  // Handle League change with automatic round clamping
  const handleLeagueChange = (newLeague) => {
    setSelectedLeague(newLeague);
    const maxR = (newLeague === 'FRA-L1' || newLeague === 'GER-BL') ? 34 : (newLeague.startsWith('EUR') ? 8 : 38);
    const curRoundNum = parseRoundNumber(selectedRound);
    if (curRoundNum && curRoundNum > maxR) {
      setSelectedRound('ALL');
    }
  };

  // Filtered Matches
  const filteredMatches = useMemo(() => {
    return allMatchesHistory.filter(m => {
      // Season filter
      if (selectedSeason !== 'ALL' && m.season && m.season !== selectedSeason) return false;

      // League filter
      if (selectedLeague !== 'ALL' && m.league !== selectedLeague) return false;

      // Round (Journée) filter with robust numeric parsing
      if (selectedRound !== 'ALL') {
        const filterNum = parseRoundNumber(selectedRound);
        const matchNum = parseRoundNumber(m.round);
        if (filterNum !== null && matchNum !== null) {
          if (filterNum !== matchNum) return false;
        } else if (m.round !== selectedRound) {
          return false;
        }
      }

      // Search term filter
      if (searchTerm.trim().length > 0) {
        const term = searchTerm.toLowerCase().trim();
        const matchInTeams = (m.homeTeam && m.homeTeam.toLowerCase().includes(term)) || (m.awayTeam && m.awayTeam.toLowerCase().includes(term));
        const matchInRef = m.referee && String(m.referee).toLowerCase().includes(term);
        const matchInRound = m.round && String(m.round).toLowerCase().includes(term);
        const matchInGoals = (m.goals || []).some(g =>
          (g.player && g.player.toLowerCase().includes(term)) ||
          (g.detail && g.detail.toLowerCase().includes(term)) ||
          (g.team && g.team.toLowerCase().includes(term))
        );
        return matchInTeams || matchInRef || matchInGoals || matchInRound;
      }
      return true;
    });
  }, [allMatchesHistory, selectedSeason, selectedLeague, selectedRound, searchTerm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── HEADER (QUANT TERMINAL TOOLBAR) ── */}
      <section style={{
        background: '#121215',
        border: '1px solid #27272a',
        borderRadius: 6,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            color: '#06b6d4', textTransform: 'uppercase',
          }}>
            <Tv size={13} /> HISTORIQUE & ARCHIVES CERTIFIÉES DES RENCONTRES
          </span>
          <span style={{ color: '#27272a' }}>|</span>
          <span style={{ fontSize: 11, color: '#71717a' }}>
            ARCHIVES OFFICIELLES · BUTEURS & PASSEURS · CHRONOLOGIE PJ
          </span>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: '#18181b',
          border: '1px solid #27272a',
          borderRadius: 4,
          padding: '4px 10px',
          color: '#06b6d4',
          fontSize: 11,
          fontWeight: 700,
        }}>
          <span>{allMatchesHistory.length} MATCHS CERTIFIÉS</span>
        </div>
      </section>

      {/* ── 4-LEVEL CONTEXTUAL SELECTOR BAR ── */}
      <section style={{
        background: '#121215',
        border: '1px solid #27272a',
        borderRadius: 6,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🎯 Sélecteur Contextuel : Saison ➔ Championnat ➔ Journée ➔ Match
          </div>
          {selectedRound !== 'ALL' && (
            <button
              onClick={() => setSelectedRound('ALL')}
              style={{
                fontSize: 11,
                color: '#06b6d4',
                background: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                padding: '3px 10px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Afficher Toutes les Journées ✕
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.2fr 2fr', gap: 16 }}>
          {/* Level 1: Saison */}
          <div>
            <label style={{ fontSize: 10, color: '#71717a', display: 'block', marginBottom: 4 }}>Saison</label>
            <select
              value={selectedSeason}
              onChange={e => setSelectedSeason(e.target.value)}
              style={{
                width: '100%',
                background: '#121215',
                border: '1px solid #27272a',
                borderRadius: 4,
                color: '#fafafa',
                padding: '8px 12px',
                fontSize: 12,
                outline: 'none',
              }}
            >
              <option value="ALL">Toutes les Saisons</option>
              <option value="2026-2027">Saison 2026-2027 (En cours)</option>
              <option value="2025-2026">Saison 2025-2026</option>
              <option value="2024-2025">Saison 2024-2025</option>
            </select>
          </div>

          {/* Level 2: Championnat */}
          <div>
            <label style={{ fontSize: 10, color: '#71717a', display: 'block', marginBottom: 4 }}>Championnat</label>
            <select
              value={selectedLeague}
              onChange={e => handleLeagueChange(e.target.value)}
              style={{
                width: '100%',
                background: '#121215',
                border: '1px solid #27272a',
                borderRadius: 4,
                color: '#fafafa',
                padding: '8px 12px',
                fontSize: 12,
                outline: 'none',
              }}
            >
              <option value="ALL">Tous les Championnats</option>
              <option value="FRA-L1">🇫🇷 Ligue 1 ({maxRoundsForLeague}J)</option>
              <option value="ENG-PL">🇬🇧 Premier League (38J)</option>
              <option value="ESP-LL">🇪🇸 La Liga (38J)</option>
              <option value="ITA-SA">🇮🇹 Serie A (38J)</option>
              <option value="GER-BL">🇩🇪 Bundesliga (34J)</option>
              <option value="EUR-CL">🇪🇺 Ligue des Champions (8J)</option>
              <option value="EUR-EL">🇪🇺 Ligue Europa (8J)</option>
              <option value="EUR-ECL">🇪🇺 Ligue Conférence (6J)</option>
            </select>
          </div>

          {/* Level 3: Journée */}
          <div>
            <label style={{ fontSize: 10, color: '#71717a', display: 'block', marginBottom: 4 }}>
              Journée ({selectedLeague === 'FRA-L1' || selectedLeague === 'GER-BL' ? '1 à 34' : selectedLeague.startsWith('EUR') ? '1 à ' + maxRoundsForLeague : '1 à 38'})
            </label>
            <select
              value={selectedRound}
              onChange={e => setSelectedRound(e.target.value)}
              style={{
                width: '100%',
                background: '#121215',
                border: selectedRound !== 'ALL' ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid #27272a',
                borderRadius: 4,
                color: selectedRound !== 'ALL' ? '#06b6d4' : '#fafafa',
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: selectedRound !== 'ALL' ? 700 : 400,
                outline: 'none',
              }}
            >
              {roundOptions.map(r => (
                <option key={r} value={r}>
                  {r === 'ALL' ? `Toutes les Journées (J1 - J${maxRoundsForLeague})` : `${r}`}
                </option>
              ))}
            </select>
          </div>

          {/* Level 4: Recherche instantanée */}
          <div>
            <label style={{ fontSize: 10, color: '#71717a', display: 'block', marginBottom: 4 }}>Recherche Instantanée</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="#71717a" style={{ position: 'absolute', left: 12, top: 11 }} />
              <input
                type="text"
                placeholder="Buteur (Mbappé, Haaland, Blas...), arbitre ou club..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  background: '#121215',
                  border: '1px solid #27272a',
                  borderRadius: 4,
                  color: '#fafafa',
                  padding: '8px 12px 8px 34px',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* Rapid Round Selector Buttons */}
        <div>
          <div style={{ fontSize: 10, color: '#71717a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Accès Rapide par Journée :
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
            <button
              className={`league-chip ${selectedRound === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedRound('ALL')}
              style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
            >
              Toutes ({maxRoundsForLeague}J)
            </button>
            {Array.from({ length: maxRoundsForLeague }, (_, i) => {
              const rName = `Journée ${i + 1}`;
              const isSelected = selectedRound === rName || parseRoundNumber(selectedRound) === (i + 1);
              return (
                <button
                  key={i}
                  className={`league-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedRound(rName)}
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    minWidth: 36,
                    textAlign: 'center',
                    background: isSelected ? '#06b6d4' : '#121215',
                    color: isSelected ? 'var(--obsidian-1)' : '#71717a',
                    fontWeight: isSelected ? 800 : 500,
                    border: `1px solid ${isSelected ? '#06b6d4' : '#27272a'}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  J{i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── MATCHES LIST & MULTIMEDIA CARDS ── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, color: '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            Résultats filtrés : <strong style={{ color: '#06b6d4' }}>{filteredMatches.length}</strong> rencontre(s) certifiée(s) trouvée(s)
            {selectedRound !== 'ALL' && <span> pour la <strong style={{ color: '#fafafa' }}>{selectedRound}</strong></span>}
            <span> ({selectedSeason === 'ALL' ? 'Toutes Saisons' : selectedSeason})</span>
          </span>
          {searchTerm && (
            <span style={{ fontSize: 11, color: '#06b6d4' }}>
              Filtre actif : « {searchTerm} »
            </span>
          )}
        </div>

        {filteredMatches.length === 0 ? (
          <div style={{
            padding: '36px 20px',
            textAlign: 'center',
            background: '#121215',
            border: '1px solid #27272a',
            borderRadius: 6,
            color: '#71717a',
          }}>
            <Trophy size={32} color="#71717a" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div style={{ fontSize: 14, color: '#fafafa', fontWeight: 600 }}>Aucune rencontre trouvée</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Essayez de réinitialiser le filtre Journée ou votre terme de recherche.</div>
            <button
              onClick={() => { setSelectedRound('ALL'); setSearchTerm(''); }}
              style={{
                marginTop: 14,
                fontSize: 11,
                background: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                color: '#06b6d4',
                padding: '6px 14px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          filteredMatches.map(m => {
            const isExpanded = expandedMatchId === m.id;
            const isFinished = m.status === 'FINISHED';
            const isLive = m.status === 'LIVE';
            const scoreDisplay = m.score ? (typeof m.score === 'object' ? `${m.score.home}-${m.score.away}` : m.score) : (isFinished ? `${m.homeScore}-${m.awayScore}` : (isLive ? 'LIVE' : 'VS'));
            const isZeroZero = scoreDisplay === '0-0' || scoreDisplay === '0 - 0';

            return (
              <div
                key={m.id}
                style={{
                  background: '#121215',
                  border: `1px solid ${isExpanded ? 'rgba(6, 182, 212, 0.35)' : '#27272a'}`,
                  borderRadius: 6,
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                }}
              >
                {/* Main Card Header */}
                <div
                  onClick={() => setExpandedMatchId(isExpanded ? null : m.id)}
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isExpanded ? '#18181b' : 'transparent',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    {/* League & Round & Status Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4', fontWeight: 700 }}>
                        {m.league}
                      </span>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', border: '1px solid #27272a', fontWeight: 600 }}>
                        {m.round || 'Journée'}
                      </span>
                      {isLive ? (
                        <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.2)', color: '#4ade80', fontWeight: 800, border: '1px solid rgba(34,197,94,0.4)' }}>
                          ● EN DIRECT
                        </span>
                      ) : !isFinished ? (
                        <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(234,179,8,0.15)', color: '#facc15', fontWeight: 700 }}>
                          À VENIR
                        </span>
                      ) : null}
                    </div>

                    {/* Match Score Strip */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TeamLogo teamName={m.homeTeam} size="sm" />
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#fafafa' }}>{m.homeTeam}</span>
                      </div>

                      <span style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: isLive ? '#4ade80' : isFinished ? (isZeroZero ? '#71717a' : '#06b6d4') : '#a1a1aa',
                        background: '#121215',
                        padding: '4px 12px',
                        borderRadius: 4,
                        border: '1px solid #27272a'
                      }}>
                        {scoreDisplay}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#fafafa' }}>{m.awayTeam}</span>
                        <TeamLogo teamName={m.awayTeam} size="sm" />
                      </div>
                    </div>

                    {/* Algo Prediction Result Badge (Green if correct, Red if incorrect) */}
                    {isFinished && (() => {
                      const evalRes = evaluateMatchPrediction(m);
                      if (!evalRes || evalRes.isCorrect === null) return null;
                      return (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: evalRes.isCorrect ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                            border: `1px solid ${evalRes.isCorrect ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                            color: evalRes.isCorrect ? '#4ade80' : '#f87171',
                          }}
                          title={`Prédiction Algo : ${evalRes.predictedLabel} (${evalRes.predictedProb || ''}) | Résultat Réel : ${evalRes.realScore}`}
                        >
                          {evalRes.isCorrect ? <CheckCircle2 size={12} color="#4ade80" /> : <XCircle size={12} color="#f87171" />}
                          <span>{evalRes.isCorrect ? 'Algo Validé' : 'Algo Erreur'}</span>
                          <span style={{ opacity: 0.75, fontSize: 9 }}>({evalRes.predictedOutcome})</span>
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 11, color: '#71717a', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{m.date || m.season || '2026-2027'}</span>
                      <span style={{ color: '#06b6d4', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={11} /> {formatMatchTime(m)}
                      </span>
                      <span>· Arbitre : <strong style={{ color: '#fafafa' }}>{typeof m.referee === 'object' ? m.referee.name : m.referee}</strong></span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedModalMatch(m);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'rgba(6, 182, 212, 0.14)',
                        border: '1px solid rgba(6, 182, 212, 0.35)',
                        color: '#06b6d4',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '5px 12px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      title="Voir la chronologie et les statistiques complètes du match"
                    >
                      <Clock size={13} />
                      <span>Détails & Chronologie</span>
                    </button>
                    {isExpanded ? <ChevronUp size={18} color="#06b6d4" /> : <ChevronDown size={18} color="#71717a" />}
                  </div>
                </div>

                {/* Goalscorers & Assists Strip if finished */}
                {(m.goals || []).length > 0 ? (
                  <div style={{
                    padding: '8px 20px',
                    background: 'rgba(0,0,0,0.25)',
                    borderTop: '1px solid rgba(255,255,255,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 10, color: '#06b6d4', fontWeight: 800, letterSpacing: '0.05em' }}>⚽ BUTEURS & PASSEURS :</span>
                    {m.goals.map((g, gIdx) => {
                      const isAssist = (g.detail && g.detail.startsWith('Assist:')) || Boolean(g.assist);
                      const assistName = g.assist || (g.detail && g.detail.startsWith('Assist:') ? g.detail.replace('Assist:', '').trim() : null);
                      const isPenalty = g.isPenalty || (g.detail && (g.detail.toLowerCase().includes('pénalty') || g.detail.toLowerCase().includes('penalty')));
                      const isOwnGoal = g.isOwnGoal || (g.detail && (g.detail.toLowerCase().includes('csc') || g.detail.toLowerCase().includes('contre son camp')));
                      const isCleanDetail = g.detail && !g.detail.startsWith('Assist:') && !g.detail.toLowerCase().includes('tir cadré') && !g.detail.toLowerCase().includes('pénalty') && !g.detail.toLowerCase().includes('penalty') && !g.detail.toLowerCase().includes('csc');

                      return (
                        <span key={gIdx} style={{
                          fontSize: 11,
                          background: '#18181b',
                          border: '1px solid #27272a',
                          padding: '3px 8px',
                          borderRadius: 6,
                          color: '#fafafa',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          <strong style={{ color: '#fafafa' }}>{g.player}</strong>
                          <span style={{ color: '#06b6d4', fontSize: 10, fontWeight: 700 }}>({g.time}')</span>
                          {isPenalty ? (
                            <span style={{
                              fontSize: 10,
                              background: 'rgba(234, 179, 8, 0.15)',
                              border: '1px solid rgba(234, 179, 8, 0.3)',
                              padding: '1px 5px',
                              borderRadius: 4,
                              color: '#fbbf24',
                              fontWeight: 600,
                            }}>
                              (Pénalty)
                            </span>
                          ) : isOwnGoal ? (
                            <span style={{
                              fontSize: 10,
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              padding: '1px 5px',
                              borderRadius: 4,
                              color: '#f87171',
                              fontWeight: 600,
                            }}>
                              (CSC)
                            </span>
                          ) : null}
                          {isAssist && assistName ? (
                            <span style={{
                              fontSize: 10,
                              background: 'rgba(6, 182, 212, 0.14)',
                              border: '1px solid rgba(6, 182, 212, 0.35)',
                              padding: '1px 5px',
                              borderRadius: 4,
                              color: '#22d3ee',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3
                            }}>
                              <span>🎯</span>
                              <strong>{assistName}</strong>
                            </span>
                          ) : isCleanDetail ? (
                            <span style={{ color: '#71717a', fontSize: 9 }}>· {g.detail}</span>
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                ) : !isFinished ? (
                  (() => {
                    const live = liveOddsUpdates[m.id];
                    const effectiveOdds = live ? live.betclicOdds : m.betclicOdds;
                    const effectiveMargin = live ? live.oddsMarginPct : m.oddsMarginPct;
                    const effectiveValueBets = live ? live.valueBets : (m.valueBets || []);
                    const isRefreshing = refreshingMatchId === m.id;

                    if (effectiveOdds && effectiveOdds.home) {
                      return (
                        <div style={{
                          padding: '8px 20px',
                          background: 'rgba(0,0,0,0.25)',
                          borderTop: '1px solid rgba(255,255,255,0.03)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          flexWrap: 'wrap',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, color: '#06b6d4', fontWeight: 800, letterSpacing: '0.05em' }}>🎲 COTES BETCLIC :</span>
                            <span style={{ fontSize: 11, color: '#fafafa' }}>1: <strong style={{ color: '#06b6d4' }}>{effectiveOdds.home}</strong></span>
                            <span style={{ fontSize: 11, color: '#fafafa' }}>N: <strong style={{ color: '#06b6d4' }}>{effectiveOdds.draw}</strong></span>
                            <span style={{ fontSize: 11, color: '#fafafa' }}>2: <strong style={{ color: '#06b6d4' }}>{effectiveOdds.away}</strong></span>
                            {effectiveMargin && (
                              <span style={{ fontSize: 9, color: '#71717a', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>
                                Marge: {effectiveMargin}%
                              </span>
                            )}
                            {effectiveValueBets && effectiveValueBets.length > 0 && (
                              <span style={{
                                fontSize: 10,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: 'rgba(34,197,94,0.15)',
                                color: '#4ade80',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}>
                                <TrendingUp size={12} /> {effectiveValueBets[0].side} ({effectiveValueBets[0].edge_percentage || effectiveValueBets[0].edge})
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => handleRefreshOdds(e, m)}
                            disabled={isRefreshing}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: 'rgba(206, 240, 2, 0.12)',
                              border: '1px solid rgba(206, 240, 2, 0.4)',
                              color: '#CEF002',
                              borderRadius: 6,
                              padding: '3px 8px',
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: isRefreshing ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <RefreshCw size={11} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                            {isRefreshing ? 'Vérification...' : 'Actualiser'}
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div style={{
                        padding: '8px 20px',
                        background: 'rgba(245, 158, 11, 0.06)',
                        borderTop: '1px dashed rgba(245, 158, 11, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', fontSize: 11, fontWeight: 600 }}>
                          <AlertCircle size={14} color="#f59e0b" />
                          <span>Cote absente pour l'instant</span>
                        </div>
                        <button
                          onClick={(e) => handleRefreshOdds(e, m)}
                          disabled={isRefreshing}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'linear-gradient(135deg, #CEF002 0%, #a3c200 100%)',
                            color: '#000',
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: isRefreshing ? 'not-allowed' : 'pointer',
                            boxShadow: '0 2px 8px rgba(206, 240, 2, 0.2)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <RefreshCw size={12} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                          {isRefreshing ? 'Recherche en cours...' : '⚡ Actualiser la cote Betclic'}
                        </button>
                      </div>
                    );
                  })()
                ) : null}

                {/* Expanded Drawer Details */}
                {isExpanded && (
                  <div style={{
                    padding: '16px 20px',
                    background: '#121215',
                    borderTop: '1px solid #27272a',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}>
                    <div style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.6 }}>
                      🤖 <strong style={{ color: '#fafafa' }}>{m.aiSummary}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedModalMatch(m);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'rgba(6, 182, 212, 0.14)',
                          border: '1px solid rgba(6, 182, 212, 0.35)',
                          color: '#06b6d4',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '6px 14px',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                      >
                        <Clock size={13} />
                        <span>Ouvrir la Chronologie & Stats Détaillées</span>
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* Match Details Modal (Chronologie format PJ + Statistiques) */}
      <MatchDetailsModal
        match={selectedModalMatch}
        isOpen={Boolean(selectedModalMatch)}
        onClose={() => setSelectedModalMatch(null)}
      />
    </div>
  );
}
