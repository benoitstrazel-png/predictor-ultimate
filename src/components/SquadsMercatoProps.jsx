import React, { useState, useMemo } from 'react';
import PassingNetwork from './PassingNetwork';
import PLAYERS_DATA from '../data/players.json';
import SCD2_MERCATO from '../data/squads_mercato_scd2.json';
import TRANSFERS_ENRICHED from '../data/compiled/transfers_enriched_master.json';
import COACHES_SCD2 from '../data/compiled/coaches_unified_scd2.json';
import { SQUADS_MANIFEST, getClubSquad } from '../data/squads_index';
import { getTeamLogo } from '../utils/logos';
import TeamLogo from './ui/TeamLogo';
import PlayerAvatar from './ui/PlayerAvatar';
import TransferCard from './ui/TransferCard';
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

  // ── ENRICHED FOCUS TRANSFERTS STATE ──
  const [transferSeason, setTransferSeason] = useState('ALL');
  const [transferRole, setTransferRole] = useState('ALL');
  const [transferTypeFilter, setTransferTypeFilter] = useState('ALL');
  const [transferFeeRange, setTransferFeeRange] = useState('ALL');
  const [transferSearch, setTransferSearch] = useState('');
  const [transferSort, setTransferSort] = useState('DATE_DESC');

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

  // ── HEAD COACH RESOLUTION (SCD Type 2) ──
  const currentClubCoach = useMemo(() => {
    if (!selectedClub) return null;
    const clubNorm = selectedClub.toLowerCase().trim();
    return (COACHES_SCD2 || []).find(c => {
      const nameMatch = (c.team_name || '').toLowerCase().includes(clubNorm) ||
                        clubNorm.includes((c.team_name || '').toLowerCase());
      if (!nameMatch) return false;
      if (selectedSeason === 'ALL') return c.is_current;
      return (c.seasons_covered || []).includes(selectedSeason);
    }) || (COACHES_SCD2 || []).find(c => {
      return (c.team_name || '').toLowerCase().includes(clubNorm) ||
             clubNorm.includes((c.team_name || '').toLowerCase());
    });
  }, [selectedClub, selectedSeason]);

  // ── ENRICHED FOCUS TRANSFERTS FILTERED DATA ──
  const filteredTransfers = useMemo(() => {
    return (TRANSFERS_ENRICHED || []).filter(item => {
      // Season filter
      if (transferSeason !== 'ALL' && item.season !== transferSeason) return false;
      // Role filter
      if (transferRole !== 'ALL' && item.player_role !== transferRole) return false;
      // Type filter
      if (transferTypeFilter !== 'ALL' && item.transfer_type !== transferTypeFilter) return false;
      // Fee Range filter
      if (transferFeeRange === 'HIGH' && item.fee_numeric_eur < 50000000) return false;
      if (transferFeeRange === 'MID' && (item.fee_numeric_eur < 15000000 || item.fee_numeric_eur >= 50000000)) return false;
      if (transferFeeRange === 'LOW' && (item.fee_numeric_eur <= 0 || item.fee_numeric_eur >= 15000000)) return false;
      if (transferFeeRange === 'FREE' && item.fee_numeric_eur !== 0) return false;

      // Text search
      if (transferSearch.trim()) {
        const q = transferSearch.toLowerCase().trim();
        const matchPlayer = (item.player_name || '').toLowerCase().includes(q);
        const matchFrom = (item.from_team_name || '').toLowerCase().includes(q);
        const matchTo = (item.to_team_name || '').toLowerCase().includes(q);
        const matchNat = (item.player_nationality || '').toLowerCase().includes(q);
        const matchPos = (item.player_position || '').toLowerCase().includes(q);
        const matchNotes = (item.transfer_notes || '').toLowerCase().includes(q);
        return matchPlayer || matchFrom || matchTo || matchNat || matchPos || matchNotes;
      }
      return true;
    }).sort((a, b) => {
      if (transferSort === 'FEE_DESC') return b.fee_numeric_eur - a.fee_numeric_eur;
      if (transferSort === 'VALUE_DESC') return b.market_value_eur - a.market_value_eur;
      return new Date(b.transfer_date) - new Date(a.transfer_date);
    });
  }, [transferSeason, transferRole, transferTypeFilter, transferFeeRange, transferSearch, transferSort]);

  // Transfer KPI Metrics
  const transferStats = useMemo(() => {
    const list = filteredTransfers;
    const total = list.length;
    if (total === 0) return { total: 0, totalFeeM: '0.0 M€', avgAge: '0 ans', recordFee: '0 M€', recordPlayer: 'N/A' };
    
    const totalFee = list.reduce((sum, t) => sum + (t.fee_numeric_eur || 0), 0) / 1000000;
    const totalAge = list.reduce((sum, t) => sum + (t.age_at_transfer || 25), 0);
    const avgAge = (totalAge / total).toFixed(1);
    
    const sortedByFee = [...list].sort((a, b) => b.fee_numeric_eur - a.fee_numeric_eur);
    const record = sortedByFee[0];
    
    return {
      total,
      totalFeeM: `${totalFee.toFixed(1)} M€`,
      avgAge: `${avgAge} ans`,
      recordFee: record ? record.fee_display : '0 M€',
      recordPlayer: record ? `${record.player_name} (${record.to_team_name})` : 'N/A'
    };
  }, [filteredTransfers]);

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
            <TrendingUp size={15} />
            <span>Focus Transferts ({filteredTransfers.length})</span>
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
                      <TeamLogo teamName={c.club_name} size="xs" />
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
                <TeamLogo teamName={currentClubSquad.club_name} size="lg" />
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

          {/* Head Coach / Staff Technique Card */}
          {currentClubCoach && (
            <div style={{
              background: 'var(--glass-primary)',
              border: '1px solid var(--ivory-border)',
              borderRadius: 14,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <PlayerAvatar name={currentClubCoach.coach_name} photoUrl={currentClubCoach.photo_url} size={46} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ivory)' }}>
                      {currentClubCoach.coach_name}
                    </span>
                    <span style={{ fontSize: 13 }} title={currentClubCoach.nationality}>
                      {currentClubCoach.nationality_flag || '🌍'}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: currentClubCoach.is_current ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: currentClubCoach.is_current ? '#4ade80' : '#f87171',
                      border: `1px solid ${currentClubCoach.is_current ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                    }}>
                      {currentClubCoach.is_current ? '👔 En Poste (Actuel)' : '👔 Ancien Mandat'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, fontSize: 11, color: 'var(--neutral)', flexWrap: 'wrap' }}>
                    <span>{currentClubCoach.nationality} · <strong style={{ color: 'var(--ivory)' }}>{currentClubCoach.age} ans</strong></span>
                    <span>·</span>
                    <span>Schéma type : <strong style={{ color: 'var(--gold)' }}>{currentClubCoach.preferred_formation}</strong></span>
                    <span>·</span>
                    <span>Mandat : <strong style={{ color: 'var(--ivory)' }}>{currentClubCoach.valid_from}</strong> ➔ <strong style={{ color: currentClubCoach.valid_to ? '#f87171' : '#4ade80' }}>{currentClubCoach.valid_to || 'Présent'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Coach Stats */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, background: 'var(--obsidian-2)', padding: '8px 14px', borderRadius: 10, border: '1px solid var(--ivory-border)', flexWrap: 'wrap' }}>
                <span>🏟️ <strong style={{ color: 'var(--ivory)' }}>{currentClubCoach.matches_count}</strong> matchs</span>
                <span>·</span>
                <span>🏆 <strong style={{ color: '#4ade80' }}>{currentClubCoach.wins}V</strong> - {currentClubCoach.draws}N - {currentClubCoach.losses}D</span>
                <span>·</span>
                <span>📈 <strong style={{ color: 'var(--gold)' }}>{currentClubCoach.win_rate_pct}%</strong> victoires</span>
                <span>·</span>
                <span>⚡ <strong style={{ color: 'var(--ivory)' }}>{currentClubCoach.points_per_match}</strong> PPM</span>
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
      {/* ── TAB 2 : FOCUS TRANSFERTS & MOUVEMENTS ENRICHIS (3 SAISONS) ── */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'mercato' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── 1. KPI SUMMARY BAR ── */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(20,20,20,0.6) 100%)',
            border: '1px solid var(--gold-border)',
            borderRadius: 16,
            padding: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
          }}>
            <div style={{ background: 'var(--obsidian-2)', border: '1px solid var(--ivory-border)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mouvements Suivis</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ivory)', marginTop: 4 }}>
                {transferStats.total} <span style={{ fontSize: 12, color: 'var(--gold)' }}>transferts</span>
              </div>
            </div>

            <div style={{ background: 'var(--obsidian-2)', border: '1px solid var(--ivory-border)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Volume Financier Total</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#4ade80', marginTop: 4 }}>
                {transferStats.totalFeeM}
              </div>
            </div>

            <div style={{ background: 'var(--obsidian-2)', border: '1px solid var(--ivory-border)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Âge Moyen au Transfert</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)', marginTop: 4 }}>
                {transferStats.avgAge}
              </div>
            </div>

            <div style={{ background: 'var(--obsidian-2)', border: '1px solid var(--ivory-border)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transfert Record</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {transferStats.recordFee}
              </div>
              <div style={{ fontSize: 10, color: 'var(--neutral)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {transferStats.recordPlayer}
              </div>
            </div>
          </div>

          {/* ── 2. MULTI-DIMENSIONAL CONTROLS & FILTER BAR ── */}
          <div style={{
            background: 'var(--glass-primary)',
            border: '1px solid var(--ivory-border)',
            borderRadius: 16,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            {/* Top row: Seasons & Sort */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              {/* Season Pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'ALL', label: 'Toutes les Saisons (3 ans)' },
                  { id: '2026-2027', label: '⚡ 2026-2027 (En cours)' },
                  { id: '2025-2026', label: '2025-2026' },
                  { id: '2024-2025', label: '2024-2025' },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setTransferSeason(s.id)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 600,
                      border: `1px solid ${transferSeason === s.id ? 'var(--gold-border)' : 'var(--ivory-border)'}`,
                      background: transferSeason === s.id ? 'var(--gold-muted)' : 'var(--obsidian-2)',
                      color: transferSeason === s.id ? 'var(--gold)' : 'var(--neutral)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Sort Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--neutral)' }}>Trier par :</span>
                <select
                  value={transferSort}
                  onChange={e => setTransferSort(e.target.value)}
                  style={{
                    background: 'var(--obsidian-2)',
                    border: '1px solid var(--ivory-border)',
                    borderRadius: 10,
                    color: 'var(--ivory)',
                    padding: '6px 12px',
                    fontSize: 11,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="DATE_DESC">Plus Récents (Date)</option>
                  <option value="FEE_DESC">Montant Décroissant (€)</option>
                  <option value="VALUE_DESC">Valeur Marchande (€)</option>
                </select>
              </div>
            </div>

            {/* Middle row: Role, Operation Type & Fee range */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              {/* Position / Role Pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'ALL', label: 'Tous Postes' },
                  { id: 'G', label: '🧤 Gardiens' },
                  { id: 'D', label: '🛡️ Défenseurs' },
                  { id: 'M', label: '⚙️ Milieux' },
                  { id: 'A', label: '⚡ Attaquants' },
                ].map(r => (
                  <button
                    key={r.id}
                    onClick={() => setTransferRole(r.id)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 600,
                      border: `1px solid ${transferRole === r.id ? 'var(--gold-border)' : 'var(--ivory-border)'}`,
                      background: transferRole === r.id ? 'var(--gold-muted)' : 'rgba(255,255,255,0.02)',
                      color: transferRole === r.id ? 'var(--gold)' : 'var(--neutral)',
                      cursor: 'pointer',
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Fee Range Pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'ALL', label: 'Tous Montants' },
                  { id: 'HIGH', label: '💎 > 50 M€' },
                  { id: 'MID', label: '15 - 50 M€' },
                  { id: 'LOW', label: '< 15 M€' },
                  { id: 'FREE', label: '🆓 Libres' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setTransferFeeRange(f.id)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 600,
                      border: `1px solid ${transferFeeRange === f.id ? 'var(--gold-border)' : 'var(--ivory-border)'}`,
                      background: transferFeeRange === f.id ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255,255,255,0.02)',
                      color: transferFeeRange === f.id ? '#4ade80' : 'var(--neutral)',
                      cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom row: Instant Search */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--obsidian-2)',
              border: '1px solid var(--ivory-border)',
              borderRadius: 10,
              padding: '8px 14px',
            }}>
              <Search size={14} color="var(--gold)" style={{ marginRight: 10 }} />
              <input
                type="text"
                value={transferSearch}
                onChange={e => setTransferSearch(e.target.value)}
                placeholder="Rechercher joueur, club vendeur/acheteur, nationalité (ex: Mbappé, PSG, Man City, France)..."
                style={{ width: '100%', background: 'transparent', border: 'none', fontSize: 12, color: 'var(--ivory)', outline: 'none' }}
              />
              {transferSearch && (
                <button
                  onClick={() => setTransferSearch('')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--neutral)', cursor: 'pointer', fontSize: 11 }}
                >
                  Effacer
                </button>
              )}
            </div>
          </div>

          {/* ── 3. ENRICHED TRANSFER CARDS GRID ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
            gap: 16,
          }}>
            {filteredTransfers.map((item) => (
              <TransferCard key={item.transfer_id} transfer={item} />
            ))}
          </div>

          {filteredTransfers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--glass-primary)', borderRadius: 16, border: '1px solid var(--ivory-border)' }}>
              <Users size={32} color="var(--neutral)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, color: 'var(--ivory)', fontWeight: 600 }}>Aucun mouvement trouvé pour ces critères</div>
              <div style={{ fontSize: 12, color: 'var(--neutral)', marginTop: 4 }}>Modifiez les filtres de saison, de poste ou la recherche pour explorer les transferts.</div>
            </div>
          )}
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
