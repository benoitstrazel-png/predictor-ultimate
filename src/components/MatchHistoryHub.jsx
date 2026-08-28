import React, { useState, useMemo } from 'react';
import UNIFIED_HISTORY from '../data/unified_history.json';
import APP_DATA from '../data/app_data.json';
import TeamLogo from './ui/TeamLogo';
import { Search, Calendar, Tv, ShieldAlert, Award, ChevronDown, ChevronUp, Play, Users, Trophy, TrendingUp } from 'lucide-react';

const parseRoundNumber = (val) => {
  if (!val || val === 'ALL') return null;
  if (typeof val === 'number') return val;
  const match = String(val).match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
};

export default function MatchHistoryHub() {
  // Combine UNIFIED_HISTORY with APP_DATA fullSchedule (Saison 2026-2027 + archives)
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

    // 1. Matchs historiques certifiés (2024-2025, 2025-2026, 2026-2027 joués)
    (UNIFIED_HISTORY || []).forEach(m => {
      const key = getMatchKey(m);
      map.set(key, {
        ...m,
        season: m.season || '2025-2026',
        round: m.round || (typeof m.week === 'number' ? `Journée ${m.week}` : 'Journée 1'),
        status: m.status || 'FINISHED',
      });
    });

    // 2. Calendrier complet 2026-2027 (J1 à J38 terminés + programmés)
    (APP_DATA?.fullSchedule || []).forEach(m => {
      const key = getMatchKey(m);
      const existing = map.get(key);
      if (existing) {
        // Fusion intelligente en préservant les données les plus complètes (arbitre détaillé, cotes, logos, buteurs certifiés)
        map.set(key, {
          ...existing,
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
          score: (m.score && typeof m.score === 'object') ? `${m.score.home}-${m.score.away}` : (m.score || existing.score),
          homeScore: m.homeScore ?? existing.homeScore,
          awayScore: m.awayScore ?? existing.awayScore,
          referee: (m.referee && typeof m.referee === 'object') ? m.referee : (existing.referee || m.referee),
          goals: (m.goals && m.goals.length > 0) ? m.goals : (existing.goals || []),
          status: m.status || existing.status || 'SCHEDULED',
          aiSummary: m.aiSummary || existing.aiSummary,
          betclicOdds: m.betclicOdds || existing.betclicOdds,
          probabilities: m.probabilities || existing.probabilities,
          valueBets: m.valueBets || existing.valueBets || [],
          weather: m.weather || existing.weather,
        });
      } else {
        map.set(key, {
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
        });
      }
    });

    return Array.from(map.values());
  }, []);

  // 4-Level Contextual Selector State — Default to current season 2026-2027
  const [selectedSeason, setSelectedSeason] = useState('2026-2027');
  const [selectedLeague, setSelectedLeague] = useState('FRA-L1');
  const [selectedRound, setSelectedRound] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedMatchId, setExpandedMatchId] = useState(null);

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
          }}>
            Historique & Hub Multimédia des Matchs
          </h1>
          <p style={{ fontSize: 12, color: 'var(--neutral)', marginTop: 4 }}>
            Archives des Rencontres Officielles Certifiées · Référencement Intégral des Buteurs · Calendriers 2026-2027
          </p>
        </div>

        <div style={{
          background: 'var(--glass-primary)',
          border: '1px solid var(--gold-border)',
          borderRadius: 14,
          padding: '8px 16px',
          textAlign: 'right',
        }}>
          <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase' }}>Base Certifiée Multi-Saisons</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{allMatchesHistory.length} Matchs · 5 200+ Buteurs</div>
        </div>
      </section>

      {/* ── 4-LEVEL CONTEXTUAL SELECTOR BAR ── */}
      <section style={{
        background: 'var(--glass-primary)',
        border: '1px solid var(--ivory-border)',
        borderRadius: 18,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🎯 Sélecteur Contextuel : Saison ➔ Championnat ➔ Journée ➔ Match
          </div>
          {selectedRound !== 'ALL' && (
            <button
              onClick={() => setSelectedRound('ALL')}
              style={{
                fontSize: 11,
                color: 'var(--gold)',
                background: 'rgba(201,169,110,0.1)',
                border: '1px solid var(--gold-border)',
                padding: '3px 10px',
                borderRadius: 8,
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
            <label style={{ fontSize: 10, color: 'var(--neutral)', display: 'block', marginBottom: 4 }}>Saison</label>
            <select
              value={selectedSeason}
              onChange={e => setSelectedSeason(e.target.value)}
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
              <option value="ALL">Toutes les Saisons</option>
              <option value="2026-2027">Saison 2026-2027 (En cours)</option>
              <option value="2025-2026">Saison 2025-2026</option>
              <option value="2024-2025">Saison 2024-2025</option>
            </select>
          </div>

          {/* Level 2: Championnat */}
          <div>
            <label style={{ fontSize: 10, color: 'var(--neutral)', display: 'block', marginBottom: 4 }}>Championnat</label>
            <select
              value={selectedLeague}
              onChange={e => handleLeagueChange(e.target.value)}
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
            <label style={{ fontSize: 10, color: 'var(--neutral)', display: 'block', marginBottom: 4 }}>
              Journée ({selectedLeague === 'FRA-L1' || selectedLeague === 'GER-BL' ? '1 à 34' : selectedLeague.startsWith('EUR') ? '1 à ' + maxRoundsForLeague : '1 à 38'})
            </label>
            <select
              value={selectedRound}
              onChange={e => setSelectedRound(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--obsidian-2)',
                border: selectedRound !== 'ALL' ? '1px solid var(--gold-border)' : '1px solid var(--ivory-border)',
                borderRadius: 10,
                color: selectedRound !== 'ALL' ? 'var(--gold)' : 'var(--ivory)',
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
            <label style={{ fontSize: 10, color: 'var(--neutral)', display: 'block', marginBottom: 4 }}>Recherche Instantanée</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="var(--neutral)" style={{ position: 'absolute', left: 12, top: 11 }} />
              <input
                type="text"
                placeholder="Buteur (Mbappé, Haaland, Blas...), arbitre ou club..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--obsidian-2)',
                  border: '1px solid var(--ivory-border)',
                  borderRadius: 10,
                  color: 'var(--ivory)',
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
          <div style={{ fontSize: 10, color: 'var(--neutral)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                    background: isSelected ? 'var(--gold)' : 'var(--obsidian-2)',
                    color: isSelected ? 'var(--obsidian-1)' : 'var(--neutral)',
                    fontWeight: isSelected ? 800 : 500,
                    border: `1px solid ${isSelected ? 'var(--gold)' : 'var(--ivory-border)'}`,
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
        <div style={{ fontSize: 12, color: 'var(--neutral)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            Résultats filtrés : <strong style={{ color: 'var(--gold)' }}>{filteredMatches.length}</strong> rencontre(s) certifiée(s) trouvée(s)
            {selectedRound !== 'ALL' && <span> pour la <strong style={{ color: 'var(--ivory)' }}>{selectedRound}</strong></span>}
            <span> ({selectedSeason === 'ALL' ? 'Toutes Saisons' : selectedSeason})</span>
          </span>
          {searchTerm && (
            <span style={{ fontSize: 11, color: 'var(--gold)' }}>
              Filtre actif : « {searchTerm} »
            </span>
          )}
        </div>

        {filteredMatches.length === 0 ? (
          <div style={{
            padding: '36px 20px',
            textAlign: 'center',
            background: 'var(--glass-primary)',
            border: '1px solid var(--ivory-border)',
            borderRadius: 16,
            color: 'var(--neutral)',
          }}>
            <Trophy size={32} color="var(--neutral)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div style={{ fontSize: 14, color: 'var(--ivory)', fontWeight: 600 }}>Aucune rencontre trouvée</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Essayez de réinitialiser le filtre Journée ou votre terme de recherche.</div>
            <button
              onClick={() => { setSelectedRound('ALL'); setSearchTerm(''); }}
              style={{
                marginTop: 14,
                fontSize: 11,
                background: 'var(--gold-muted)',
                border: '1px solid var(--gold-border)',
                color: 'var(--gold)',
                padding: '6px 14px',
                borderRadius: 8,
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
                  background: 'var(--glass-primary)',
                  border: `1px solid ${isExpanded ? 'var(--gold-border)' : 'var(--ivory-border)'}`,
                  borderRadius: 16,
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
                    background: isExpanded ? 'var(--obsidian-3)' : 'transparent',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    {/* League & Round & Status Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'var(--gold-muted)', color: 'var(--gold)', fontWeight: 700 }}>
                        {m.league}
                      </span>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: 'var(--ivory-dim)', border: '1px solid var(--ivory-border)', fontWeight: 600 }}>
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
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ivory)' }}>{m.homeTeam}</span>
                      </div>

                      <span style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: isLive ? '#4ade80' : isFinished ? (isZeroZero ? 'var(--neutral)' : 'var(--gold)') : 'var(--ivory-dim)',
                        background: 'var(--obsidian-2)',
                        padding: '4px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--ivory-border)'
                      }}>
                        {scoreDisplay}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ivory)' }}>{m.awayTeam}</span>
                        <TeamLogo teamName={m.awayTeam} size="sm" />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--neutral)' }}>
                      {m.date || m.season || '2026-2027'} · Arbitre : <strong style={{ color: 'var(--ivory)' }}>{typeof m.referee === 'object' ? m.referee.name : m.referee}</strong>
                    </div>
                    {isExpanded ? <ChevronUp size={18} color="var(--gold)" /> : <ChevronDown size={18} color="var(--neutral)" />}
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
                    <span style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 800, letterSpacing: '0.05em' }}>⚽ BUTEURS & PASSEURS :</span>
                    {m.goals.map((g, gIdx) => {
                      const isAssist = (g.detail && g.detail.startsWith('Assist:')) || Boolean(g.assist);
                      const assistName = g.assist || (g.detail && g.detail.startsWith('Assist:') ? g.detail.replace('Assist:', '').trim() : null);
                      const isPenalty = g.isPenalty || (g.detail && (g.detail.toLowerCase().includes('pénalty') || g.detail.toLowerCase().includes('penalty')));
                      const isOwnGoal = g.isOwnGoal || (g.detail && (g.detail.toLowerCase().includes('csc') || g.detail.toLowerCase().includes('contre son camp')));
                      const isCleanDetail = g.detail && !g.detail.startsWith('Assist:') && !g.detail.toLowerCase().includes('tir cadré') && !g.detail.toLowerCase().includes('pénalty') && !g.detail.toLowerCase().includes('penalty') && !g.detail.toLowerCase().includes('csc');

                      return (
                        <span key={gIdx} style={{
                          fontSize: 11,
                          background: 'var(--obsidian-3)',
                          border: '1px solid var(--ivory-border)',
                          padding: '3px 8px',
                          borderRadius: 6,
                          color: 'var(--ivory)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          <strong style={{ color: 'var(--ivory)' }}>{g.player}</strong>
                          <span style={{ color: 'var(--gold)', fontSize: 10, fontWeight: 700 }}>({g.time}')</span>
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
                              background: 'rgba(201,169,110,0.15)',
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
                          ) : isCleanDetail ? (
                            <span style={{ color: 'var(--neutral)', fontSize: 9 }}>· {g.detail}</span>
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                ) : !isFinished && m.betclicOdds ? (
                  <div style={{
                    padding: '8px 20px',
                    background: 'rgba(0,0,0,0.25)',
                    borderTop: '1px solid rgba(255,255,255,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 800, letterSpacing: '0.05em' }}>🎲 COTES BETCLIC :</span>
                    <span style={{ fontSize: 11, color: 'var(--ivory)' }}>1: <strong style={{ color: 'var(--gold)' }}>{m.betclicOdds.home}</strong></span>
                    <span style={{ fontSize: 11, color: 'var(--ivory)' }}>N: <strong style={{ color: 'var(--gold)' }}>{m.betclicOdds.draw}</strong></span>
                    <span style={{ fontSize: 11, color: 'var(--ivory)' }}>2: <strong style={{ color: 'var(--gold)' }}>{m.betclicOdds.away}</strong></span>
                    {m.valueBets && m.valueBets.length > 0 && (
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
                        <TrendingUp size={12} /> {m.valueBets[0].side} ({m.valueBets[0].edge_percentage})
                      </span>
                    )}
                  </div>
                ) : null}

                {/* Expanded Drawer Details */}
                {isExpanded && (
                  <div style={{
                    padding: '16px 20px',
                    background: 'var(--obsidian-2)',
                    borderTop: '1px solid var(--ivory-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--ivory-dim)', lineHeight: 1.6 }}>
                      🤖 <strong style={{ color: 'var(--ivory)' }}>{m.aiSummary}</strong>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
