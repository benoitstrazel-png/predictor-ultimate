import React, { useState, useMemo } from 'react';
import PassingNetwork from './PassingNetwork';
import PLAYERS_DATA from '../data/players.json';
import SCD2_MERCATO from '../data/squads_mercato_scd2.json';
import { SQUADS_MANIFEST, getClubSquad } from '../data/squads_index';
import { getTeamLogo } from '../utils/logos';
import PlayerAvatar from './ui/PlayerAvatar';
import {
  Users, Filter, Search, ShieldCheck, AlertTriangle, ArrowRight,
  TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight, Calendar,
  Clock, CheckCircle2, XCircle, Sparkles, Trophy, Award, MapPin
} from 'lucide-react';

export default function SquadsMercatoProps({ targetMatch }) {
  const [activeSubTab, setActiveSubTab] = useState('roster'); // 'roster', 'mercato', 'props'

  // ── 3-TIER MULTI-SEASON ROSTER EXPLORER STATE ──
  const [rosterLeague, setRosterLeague] = useState(targetMatch?.league || 'FRA-L1');
  const [selectedSeason, setSelectedSeason] = useState('2026-2027');
  const [selectedClub, setSelectedClub] = useState(targetMatch?.homeTeam || 'Marseille');
  const [rosterPosition, setRosterPosition] = useState('ALL');
  const [rosterSearch, setRosterSearch] = useState('');

  // ── MERCATO SCD TYPE 2 STATE ──
  const [mercatoSeason, setMercatoSeason] = useState('ALL');
  const [mercatoLeague, setMercatoLeague] = useState('ALL');
  const [mercatoStatusFilter, setMercatoStatusFilter] = useState('ALL');
  const [mercatoSearch, setMercatoSearch] = useState('');

  // ── PROPS TAB STATE ──
  const [propsLeague, setPropsLeague] = useState(targetMatch?.league || 'ALL');
  const [propsSearch, setPropsSearch] = useState('');

  // Leagues Definition
  const leaguesList = [
    { id: 'FRA-L1', label: '🇫🇷 Ligue 1', country: 'France' },
    { id: 'ENG-PL', label: '🇬🇧 Premier League', country: 'Angleterre' },
    { id: 'ESP-LL', label: '🇪🇸 La Liga', country: 'Espagne' },
    { id: 'ITA-SA', label: '🇮🇹 Serie A', country: 'Italie' },
    { id: 'GER-BL', label: '🇩🇪 Bundesliga', country: 'Allemagne' },
    { id: 'EUR-CL', label: "🇪🇺 Coupes d'Europe", country: 'Europe' },
  ];

  // Available seasons
  const availableSeasons = [
    { id: '2026-2027', label: '2026-2027 (En cours)', badge: 'Actuelle' },
    { id: '2025-2026', label: '2025-2026', badge: 'Archive' },
    { id: '2024-2025', label: '2024-2025', badge: 'Archive' },
  ];

  // Clubs belonging to currently selected league
  const leagueClubs = useMemo(() => {
    return (SQUADS_MANIFEST.clubs || []).filter(c => c.league === rosterLeague);
  }, [rosterLeague]);

  // Ensure selectedClub belongs to current league
  React.useEffect(() => {
    if (leagueClubs.length > 0) {
      const exists = leagueClubs.some(c => c.club_name === selectedClub || c.slug === selectedClub);
      if (!exists) {
        setSelectedClub(leagueClubs[0].club_name);
      }
    }
  }, [rosterLeague, leagueClubs, selectedClub]);

  // Get active club squad object from Transfermarkt repository
  const currentClubSquad = useMemo(() => {
    return getClubSquad(selectedClub, selectedSeason);
  }, [selectedClub, selectedSeason]);

  // Calculate squad KPI statistics
  const squadStats = useMemo(() => {
    const players = currentClubSquad?.players || [];
    const total = players.length;
    if (total === 0) return { total: 0, avgAge: 0, totalVal: '0M €', arrivals: 0, departures: 0 };

    const totalAge = players.reduce((sum, p) => sum + (p.age || 25), 0);
    const avgAge = (totalAge / total).toFixed(1);

    let valSum = 0;
    players.forEach(p => {
      const str = p.market_value || '0';
      const num = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
      if (str.includes('K')) valSum += num / 1000;
      else valSum += num;
    });

    const arrivals = players.filter(p => p.status === 'NEW_SIGNING').length;
    const departures = players.filter(p => p.status === 'TRANSFERRED' || p.left_date).length;

    return {
      total,
      avgAge,
      totalVal: `${valSum.toFixed(1)}M €`,
      arrivals,
      departures
    };
  }, [currentClubSquad]);

  // Filtered Roster for Card Grid
  const filteredRoster = useMemo(() => {
    const players = currentClubSquad?.players || [];
    return players.filter(p => {
      // Position filter
      if (rosterPosition === 'G' && p.role_category !== 'G') return false;
      if (rosterPosition === 'D' && p.role_category !== 'D') return false;
      if (rosterPosition === 'M' && p.role_category !== 'M') return false;
      if (rosterPosition === 'A' && p.role_category !== 'A') return false;
      if (rosterPosition === 'RECRUES' && p.status !== 'NEW_SIGNING') return false;
      if (rosterPosition === 'DEPARTS' && p.status !== 'TRANSFERRED' && !p.left_date) return false;

      // Search filter
      if (rosterSearch.trim()) {
        const q = rosterSearch.toLowerCase().trim();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchNat = (p.nationality || '').toLowerCase().includes(q);
        const matchPos = (p.position || '').toLowerCase().includes(q);
        const matchNum = String(p.number || '') === q;
        return matchName || matchNat || matchPos || matchNum;
      }
      return true;
    });
  }, [currentClubSquad, rosterPosition, rosterSearch]);

  // Filtered Mercato SCD2 Records
  const filteredSCD2 = useMemo(() => {
    return (SCD2_MERCATO || []).filter(item => {
      if (mercatoSeason !== 'ALL') {
        const hasSeason = (item.seasons || []).some(s => s.includes(mercatoSeason));
        if (!hasSeason) return false;
      }
      if (mercatoLeague !== 'ALL' && item.league !== mercatoLeague) return false;
      if (mercatoStatusFilter === 'ACTIVE' && !item.is_current) return false;
      if (mercatoStatusFilter === 'DEPARTED' && item.is_current) return false;

      if (mercatoSearch.trim()) {
        const t = mercatoSearch.toLowerCase().trim();
        return item.player_name.toLowerCase().includes(t) ||
               item.club.toLowerCase().includes(t) ||
               (item.note && item.note.toLowerCase().includes(t)) ||
               item.position.toLowerCase().includes(t);
      }
      return true;
    });
  }, [mercatoSeason, mercatoLeague, mercatoStatusFilter, mercatoSearch]);

  const getRoleCategoryBadge = (roleCat) => {
    switch (roleCat) {
      case 'G': return { label: '🧤 Gardien', bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: 'rgba(234, 179, 8, 0.3)' };
      case 'D': return { label: '🛡️ Défenseur', bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' };
      case 'M': return { label: '⚙️ Milieu', bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' };
      case 'A': return { label: '⚡ Attaquant', bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
      default: return { label: 'Joueur', bg: 'rgba(255, 255, 255, 0.1)', color: 'var(--ivory)', border: 'var(--ivory-border)' };
    }
  };

  const getStatusBadge = (status, leftDate) => {
    if (status === 'NEW_SIGNING') {
      return <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.4)' }}>✨ RECRUE</span>;
    }
    if (status === 'TRANSFERRED' || leftDate) {
      return <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' }}>🚪 DÉPART</span>;
    }
    if (status === 'LOANED_OUT') {
      return <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.4)' }}>🔄 PRÊT</span>;
    }
    return <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(255, 255, 255, 0.05)', color: 'var(--neutral)', border: '1px solid var(--ivory-border)' }}>✅ ACTIF</span>;
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
          }}>
            Effectifs & Mercato Multi-Saisons (Transfermarkt)
          </h1>
          <p style={{ fontSize: 12, color: 'var(--neutral)', marginTop: 4 }}>
            Référentiel Officiel 3 Saisons (2024-2027) · Traçabilité SCD Type 2 · Dates d'Entrée/Sortie & Valeurs Marchandes
          </p>
        </div>

        {/* Sub-Navigation Switcher */}
        <div style={{
          display: 'flex',
          background: 'var(--obsidian-2)',
          border: '1px solid var(--ivory-border)',
          borderRadius: 14,
          padding: 4,
          gap: 4,
        }}>
          <button
            onClick={() => setActiveSubTab('roster')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: activeSubTab === 'roster' ? 700 : 500,
              background: activeSubTab === 'roster' ? 'var(--gold-muted)' : 'transparent',
              color: activeSubTab === 'roster' ? 'var(--gold)' : 'var(--neutral)',
              border: activeSubTab === 'roster' ? '1px solid var(--gold-border)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Users size={15} />
            <span>Explorateur Effectif (3 Saisons)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('mercato')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: activeSubTab === 'mercato' ? 700 : 500,
              background: activeSubTab === 'mercato' ? 'var(--gold-muted)' : 'transparent',
              color: activeSubTab === 'mercato' ? 'var(--gold)' : 'var(--neutral)',
              border: activeSubTab === 'mercato' ? '1px solid var(--gold-border)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Clock size={15} />
            <span>Traçabilité Mercato (SCD Type 2)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('props')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: activeSubTab === 'props' ? 700 : 500,
              background: activeSubTab === 'props' ? 'var(--gold-muted)' : 'transparent',
              color: activeSubTab === 'props' ? 'var(--gold)' : 'var(--neutral)',
              border: activeSubTab === 'props' ? '1px solid var(--gold-border)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <TrendingUp size={15} />
            <span>Réseaux de Passes & Props</span>
          </button>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1 : EXPLORATEUR EFFECTIF MULTI-SAISONS ── */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'roster' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* 3-Tier Controls Bar */}
          <div style={{
            background: 'var(--glass-primary)',
            border: '1px solid var(--ivory-border)',
            borderRadius: 16,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            {/* Top Bar: League + Season Selector */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              {/* League Selector Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--neutral)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Championnat :</span>
                {leaguesList.map(lg => (
                  <button
                    key={lg.id}
                    onClick={() => {
                      setRosterLeague(lg.id);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: rosterLeague === lg.id ? 700 : 500,
                      background: rosterLeague === lg.id ? 'var(--gold-muted)' : 'var(--obsidian-2)',
                      border: `1px solid ${rosterLeague === lg.id ? 'var(--gold-border)' : 'var(--ivory-border)'}`,
                      color: rosterLeague === lg.id ? 'var(--gold)' : 'var(--ivory)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {lg.label}
                  </button>
                ))}
              </div>

              {/* Season Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--neutral)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Saison :</span>
                <div style={{ display: 'flex', background: 'var(--obsidian-2)', borderRadius: 10, padding: 3, border: '1px solid var(--ivory-border)', gap: 3 }}>
                  {availableSeasons.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSeason(s.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: selectedSeason === s.id ? 700 : 500,
                        background: selectedSeason === s.id ? 'var(--gold-muted)' : 'transparent',
                        color: selectedSeason === s.id ? 'var(--gold)' : 'var(--neutral)',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Club Selection Scrollable Row */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--neutral)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 600 }}>
                Sélection du Club ({leagueClubs.length} clubs répertoriés) :
              </div>
              <div style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 6,
              }}>
                {leagueClubs.map(c => {
                  const isSelected = selectedClub === c.club_name || selectedClub === c.slug;
                  return (
                    <button
                      key={c.slug}
                      onClick={() => setSelectedClub(c.club_name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 14px',
                        borderRadius: 12,
                        background: isSelected ? 'var(--gold-muted)' : 'var(--obsidian-2)',
                        border: `1px solid ${isSelected ? 'var(--gold-border)' : 'var(--ivory-border)'}`,
                        color: isSelected ? 'var(--gold)' : 'var(--ivory)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        fontWeight: isSelected ? 700 : 400,
                        fontSize: 12,
                        transition: 'all 0.2s'
                      }}
                    >
                      <img src={getTeamLogo(c.club_name)} alt={c.club_name} style={{ width: 20, height: 20, objectFit: 'contain' }} />
                      <span>{c.club_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Club Roster Header KPI Card */}
          {currentClubSquad && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(20,20,20,0.6) 100%)',
              border: '1px solid var(--gold-border)',
              borderRadius: 16,
              padding: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <img
                  src={getTeamLogo(currentClubSquad.club_name)}
                  alt={currentClubSquad.club_name}
                  style={{ width: 56, height: 56, objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--ivory)', margin: 0, fontFamily: 'var(--font-serif)' }}>
                      {currentClubSquad.club_name}
                    </h2>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'var(--obsidian-2)', color: 'var(--gold)', border: '1px solid var(--ivory-border)' }}>
                      Saison {selectedSeason}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4, fontSize: 12, color: 'var(--neutral)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={13} color="var(--gold)" />
                      {currentClubSquad.stadium} ({currentClubSquad.country})
                    </span>
                    <span>·</span>
                    <span>Championnat : <strong style={{ color: 'var(--ivory)' }}>{currentClubSquad.league}</strong></span>
                  </div>
                </div>
              </div>

              {/* KPI Badges */}
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ background: 'var(--obsidian-2)', border: '1px solid var(--ivory-border)', borderRadius: 12, padding: '10px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase' }}>Effectif</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ivory)', marginTop: 2 }}>{squadStats.total} <span style={{ fontSize: 11, color: 'var(--neutral)' }}>joueurs</span></div>
                </div>

                <div style={{ background: 'var(--obsidian-2)', border: '1px solid var(--ivory-border)', borderRadius: 12, padding: '10px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase' }}>Âge Moyen</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)', marginTop: 2 }}>{squadStats.avgAge} <span style={{ fontSize: 11, color: 'var(--neutral)' }}>ans</span></div>
                </div>

                <div style={{ background: 'var(--obsidian-2)', border: '1px solid var(--ivory-border)', borderRadius: 12, padding: '10px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase' }}>Valeur Totale</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80', marginTop: 2 }}>{squadStats.totalVal}</div>
                </div>

                {squadStats.arrivals > 0 && (
                  <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: 12, padding: '10px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#4ade80', textTransform: 'uppercase' }}>Nouvelles Recrues</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80', marginTop: 2 }}>+{squadStats.arrivals}</div>
                  </div>
                )}

                {squadStats.departures > 0 && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12, padding: '10px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#f87171', textTransform: 'uppercase' }}>Départs / Transferts</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#f87171', marginTop: 2 }}>-{squadStats.departures}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Filters & Instant Search Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: 'Tous' },
                { id: 'G', label: '🧤 Gardiens' },
                { id: 'D', label: '🛡️ Défenseurs' },
                { id: 'M', label: '⚙️ Milieux' },
                { id: 'A', label: '⚡ Attaquants' },
                { id: 'RECRUES', label: '✨ Recrues' },
                { id: 'DEPARTS', label: '🚪 Départs' },
              ].map(pos => (
                <button
                  key={pos.id}
                  onClick={() => setRosterPosition(pos.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    border: `1px solid ${rosterPosition === pos.id ? 'var(--gold-border)' : 'var(--ivory-border)'}`,
                    background: rosterPosition === pos.id ? 'var(--gold-muted)' : 'var(--obsidian-2)',
                    color: rosterPosition === pos.id ? 'var(--gold)' : 'var(--neutral)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {pos.label}
                </button>
              ))}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--obsidian-2)',
              border: '1px solid var(--ivory-border)',
              borderRadius: 10,
              padding: '8px 14px',
              width: 280,
            }}>
              <Search size={14} color="var(--gold)" style={{ marginRight: 8 }} />
              <input
                type="text"
                value={rosterSearch}
                onChange={e => setRosterSearch(e.target.value)}
                placeholder="Rechercher joueur, n°, poste..."
                style={{ width: '100%', background: 'transparent', border: 'none', fontSize: 12, color: 'var(--ivory)', outline: 'none' }}
              />
            </div>
          </div>

          {/* High-Fidelity Player Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: 16,
          }}>
            {filteredRoster.map((player) => {
              const roleBadge = getRoleCategoryBadge(player.role_category);
              return (
                <div
                  key={player.id}
                  style={{
                    background: 'var(--glass-primary)',
                    border: '1px solid var(--ivory-border)',
                    borderRadius: 16,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Card Header : Kit Number + Position Badge + Status Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'var(--obsidian-2)',
                        border: '1px solid var(--ivory-border)',
                        color: 'var(--gold)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700
                      }}>
                        #{player.number}
                      </span>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        background: roleBadge.bg,
                        color: roleBadge.color,
                        border: `1px solid ${roleBadge.border}`
                      }}>
                        {roleBadge.label}
                      </span>
                    </div>

                    <div>
                      {getStatusBadge(player.status, player.left_date)}
                    </div>
                  </div>

                  {/* Player Avatar & Identity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <PlayerAvatar name={player.name} photoUrl={player.photo} size={50} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ivory)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {player.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 2 }}>
                        {player.nationality} · <strong style={{ color: 'var(--ivory)' }}>{player.age} ans</strong>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, marginTop: 2 }}>
                        {player.position}
                      </div>
                    </div>
                  </div>

                  {/* Transfermarkt Dates & Value Box */}
                  <div style={{
                    background: 'var(--obsidian-2)',
                    border: '1px solid var(--ivory-border)',
                    borderRadius: 12,
                    padding: 10,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    fontSize: 11
                  }}>
                    <div>
                      <span style={{ color: 'var(--neutral)', display: 'block', fontSize: 10 }}>Arrivée Club</span>
                      <strong style={{ color: 'var(--ivory)' }}>{player.joined_date || '01/07/2024'}</strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--neutral)', display: 'block', fontSize: 10 }}>
                        {player.left_date ? 'Date de Départ' : 'Fin Contrat'}
                      </span>
                      <strong style={{ color: player.left_date ? '#f87171' : 'var(--gold)' }}>
                        {player.left_date || player.contract_until || '2028-06-30'}
                      </strong>
                    </div>

                    <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--ivory-border)', paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--neutral)', fontSize: 10 }}>Valeur Marchande Transfermarkt</span>
                      <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 12 }}>
                        {player.market_value}
                      </span>
                    </div>
                  </div>

                  {/* Season Stats mini-bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', fontSize: 11, color: 'var(--neutral)', background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: 8 }}>
                    <span>🏟️ <strong style={{ color: 'var(--ivory)' }}>{player.stats?.appearances || 0}</strong> matchs</span>
                    <span>⚽ <strong style={{ color: '#4ade80' }}>{player.stats?.goals || 0}</strong> buts</span>
                    <span>🎯 <strong style={{ color: 'var(--gold)' }}>{player.stats?.assists || 0}</strong> passes</span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredRoster.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--glass-primary)', borderRadius: 16, border: '1px solid var(--ivory-border)' }}>
              <Users size={32} color="var(--neutral)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, color: 'var(--ivory)', fontWeight: 600 }}>Aucun joueur trouvé pour ce filtre</div>
              <div style={{ fontSize: 12, color: 'var(--neutral)', marginTop: 4 }}>Essayez de modifier votre terme de recherche ou le filtre de poste.</div>
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2 : MERCATO SCD TYPE 2 (3 SAISONS) ── */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'mercato' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Controls Bar */}
          <div style={{
            background: 'var(--glass-primary)',
            border: '1px solid var(--ivory-border)',
            borderRadius: 16,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🔍 Filtres & Traçabilité Temporelle (Dates d'Entrée & Sortie d'Effectif)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.2fr 2fr', gap: 14 }}>
              {/* Season filter */}
              <div>
                <label style={{ fontSize: 10, color: 'var(--neutral)', display: 'block', marginBottom: 4 }}>Saison Historique</label>
                <select
                  value={mercatoSeason}
                  onChange={e => setMercatoSeason(e.target.value)}
                  style={{ width: '100%', background: 'var(--obsidian-2)', border: '1px solid var(--ivory-border)', borderRadius: 10, color: 'var(--ivory)', padding: '8px 12px', fontSize: 12, outline: 'none' }}
                >
                  <option value="ALL">Toutes les Saisons (3 ans)</option>
                  <option value="2026-2027">Saison 2026-2027</option>
                  <option value="2025-2026">Saison 2025-2026</option>
                  <option value="2024-2025">Saison 2024-2025</option>
                </select>
              </div>

              {/* League filter */}
              <div>
                <label style={{ fontSize: 10, color: 'var(--neutral)', display: 'block', marginBottom: 4 }}>Championnat</label>
                <select
                  value={mercatoLeague}
                  onChange={e => setMercatoLeague(e.target.value)}
                  style={{ width: '100%', background: 'var(--obsidian-2)', border: '1px solid var(--ivory-border)', borderRadius: 10, color: 'var(--ivory)', padding: '8px 12px', fontSize: 12, outline: 'none' }}
                >
                  <option value="ALL">Tous les Championnats</option>
                  <option value="FRA-L1">🇫🇷 Ligue 1</option>
                  <option value="ENG-PL">🇬🇧 Premier League</option>
                  <option value="ESP-LL">🇪🇸 La Liga</option>
                  <option value="ITA-SA">🇮🇹 Serie A</option>
                  <option value="GER-BL">🇩🇪 Bundesliga</option>
                </select>
              </div>

              {/* Status filter */}
              <div>
                <label style={{ fontSize: 10, color: 'var(--neutral)', display: 'block', marginBottom: 4 }}>Statut dans l'Effectif</label>
                <select
                  value={mercatoStatusFilter}
                  onChange={e => setMercatoStatusFilter(e.target.value)}
                  style={{ width: '100%', background: 'var(--obsidian-2)', border: '1px solid var(--ivory-border)', borderRadius: 10, color: 'var(--ivory)', padding: '8px 12px', fontSize: 12, outline: 'none' }}
                >
                  <option value="ALL">Tous les Statuts</option>
                  <option value="ACTIVE">✅ Actifs dans le Club (2026-2027)</option>
                  <option value="DEPARTED">🚪 Joueurs Partis / Transférés</option>
                </select>
              </div>

              {/* Search */}
              <div>
                <label style={{ fontSize: 10, color: 'var(--neutral)', display: 'block', marginBottom: 4 }}>Recherche Joueur ou Club</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} color="var(--neutral)" style={{ position: 'absolute', left: 12, top: 11 }} />
                  <input
                    type="text"
                    value={mercatoSearch}
                    onChange={e => setMercatoSearch(e.target.value)}
                    placeholder="Ex: Greenwood, Rulli, Mbappé..."
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
          </div>

          {/* SCD2 Timeline Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 16,
          }}>
            {filteredSCD2.map((item, idx) => {
              const isActive = item.is_current;
              return (
                <div
                  key={idx}
                  style={{
                    background: 'var(--glass-primary)',
                    border: `1px solid ${isActive ? 'var(--ivory-border)' : 'rgba(239, 68, 68, 0.3)'}`,
                    borderRadius: 16,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <PlayerAvatar name={item.player_name} photoUrl={item.photoUrl} size={42} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ivory)' }}>
                          {item.player_name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--neutral)' }}>
                          {item.position} · <strong style={{ color: 'var(--gold)' }}>{item.club}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: 8,
                      background: isActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: isActive ? '#4ade80' : '#f87171',
                      border: `1px solid ${isActive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}>
                      {isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      <span>{isActive ? 'ACTIF 2026-2027' : 'ANCIEN JOUEUR'}</span>
                    </div>
                  </div>

                  <div style={{
                    background: 'var(--obsidian-2)',
                    border: '1px solid var(--ivory-border)',
                    borderRadius: 12,
                    padding: 10,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    fontSize: 11,
                  }}>
                    <div>
                      <span style={{ color: 'var(--neutral)', display: 'block', fontSize: 10 }}>Date d'entrée (Valid From)</span>
                      <strong style={{ color: 'var(--ivory)' }}>{item.valid_from}</strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--neutral)', display: 'block', fontSize: 10 }}>Date de sortie (Valid To)</span>
                      <strong style={{ color: item.valid_to ? '#f87171' : '#4ade80' }}>
                        {item.valid_to ? item.valid_to : 'Toujours au club'}
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(item.seasons || []).map(s => (
                        <span
                          key={s}
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 6,
                            background: s.includes('2026') ? 'var(--gold-muted)' : 'var(--obsidian-2)',
                            color: s.includes('2026') ? 'var(--gold)' : 'var(--neutral)',
                            border: '1px solid var(--ivory-border)',
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>

                    {item.note && (
                      <span style={{ fontSize: 10, color: 'var(--gold)', fontStyle: 'italic' }}>
                        ℹ️ {item.note}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3 : PROPS & PASSING NETWORK ── */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'props' && (
        <PassingNetwork />
      )}

    </div>
  );
}
