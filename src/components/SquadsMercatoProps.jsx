import React, { useState, useMemo, useEffect } from 'react';
import PassingNetwork from './PassingNetwork';
import { SQUADS_MANIFEST, getClubSquad } from '../data/squads_index';
import { resolveTeamCoach } from '../utils/coachResolver';
import { fetchTransfers } from '../services/historyService';
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
  const [transfersData, setTransfersData] = useState([]);

  useEffect(() => {
    let isMounted = true;
    fetchTransfers().then(data => {
      if (isMounted && Array.isArray(data)) {
        setTransfersData(data);
      }
    });
    return () => { isMounted = false; };
  }, []);

  // ── 3-TIER MULTI-SEASON ROSTER EXPLORER STATE ──
  const [rosterLeague, setRosterLeague] = useState(targetMatch?.league || 'FRA-L1');
  const [selectedSeason, setSelectedSeason] = useState('2026-2027');
  const [selectedClub, setSelectedClub] = useState(targetMatch?.homeTeam || 'Marseille');
  const [rosterPosition, setRosterPosition] = useState('ALL');
  const [rosterSearch, setRosterSearch] = useState('');

  // ── ENRICHED FOCUS TRANSFERTS STATE ──
  const [transferSeason, setTransferSeason] = useState('2026-2027');
  const [transferRole, setTransferRole] = useState('ALL');
  const [transferTypeFilter, setTransferTypeFilter] = useState('ALL');
  const [transferFeeRange, setTransferFeeRange] = useState('ALL');
  const [transferSearch, setTransferSearch] = useState('');
  const [transferSort, setTransferSort] = useState('DATE_DESC');
  const [transferDisplayLimit, setTransferDisplayLimit] = useState(36);

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

  // ── DYNAMIC ARRIVALS & DEPARTURES FOR CURRENT CLUB & SEASON ──
  const clubTransfersIn = useMemo(() => {
    if (!selectedClub) return [];
    const clubNorm = selectedClub.toLowerCase().trim();
    return (transfersData || []).filter(t => {
      const toMatch = (t.to_team_name || '').toLowerCase().includes(clubNorm) ||
                      clubNorm.includes((t.to_team_name || '').toLowerCase());
      if (!toMatch) return false;
      if (selectedSeason !== 'ALL' && t.season !== selectedSeason) return false;
      return true;
    });
  }, [selectedClub, selectedSeason, transfersData]);

  const clubTransfersOut = useMemo(() => {
    if (!selectedClub) return [];
    const clubNorm = selectedClub.toLowerCase().trim();
    return (transfersData || []).filter(t => {
      const fromMatch = (t.from_team_name || '').toLowerCase().includes(clubNorm) ||
                        clubNorm.includes((t.from_team_name || '').toLowerCase());
      if (!fromMatch) return false;
      if (selectedSeason !== 'ALL' && t.season !== selectedSeason) return false;
      return true;
    });
  }, [selectedClub, selectedSeason, transfersData]);

  const departedPlayers = useMemo(() => {
    const list = [];
    const seen = new Set();
    
    // 1. From recorded official transfers
    clubTransfersOut.forEach(t => {
      const pKey = (t.player_name || '').toLowerCase().trim();
      seen.add(pKey);
      list.push({
        id: `dep_${t.transfer_id}`,
        name: t.player_name,
        number: t.number || '-',
        position: t.player_position || 'Joueur',
        role_category: t.player_role || 'M',
        nationality: t.player_nationality || 'France',
        age: t.age_at_transfer || 24,
        market_value: t.market_value_display || '15.00 M€',
        joined_date: t.joined_date || '2024-07-01',
        left_date: t.transfer_date || '2026-07-01',
        destination_club: t.to_team_name,
        destination_logo: t.to_team_logo,
        fee_display: t.fee_display || 'Transfert',
        transfer_type_label: t.transfer_type_label || '💰 Transfert',
        status: 'TRANSFERRED',
        photo: t.player_photo_url || '/assets/players/defaults/m_default.webp',
        stats: { appearances: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0 }
      });
    });

    // 2. From diff with previous season (if any)
    const prevSquad = selectedSeason === '2026-2027' ? getClubSquad(selectedClub, '2025-2026') :
                      (selectedSeason === '2025-2026' ? getClubSquad(selectedClub, '2024-2025') : null);
    const currentNames = new Set((currentClubSquad?.players || []).map(p => (p.name || '').toLowerCase().trim()));
    
    (prevSquad?.players || []).forEach(p => {
      const pKey = (p.name || '').toLowerCase().trim();
      if (!currentNames.has(pKey) && !seen.has(pKey)) {
        seen.add(pKey);
        list.push({
          ...p,
          id: `dep_${p.id}`,
          left_date: p.left_date || (selectedSeason === '2026-2027' ? '2026-07-01' : '2025-07-01'),
          status: 'TRANSFERRED',
          destination_club: p.destination_club || 'Nouveau Club',
          fee_display: p.fee_display || 'Fin de contrat / Transfert',
          transfer_type_label: '🚪 Départ'
        });
      }
    });

    return list;
  }, [clubTransfersOut, currentClubSquad, selectedClub, selectedSeason]);

  const newSignings = useMemo(() => {
    const list = [];
    const seen = new Set();
    
    // 1. Players in current squad with NEW_SIGNING status or joined in this season
    (currentClubSquad?.players || []).forEach(p => {
      const joinedYr = (p.joined_date || '').substring(0, 4);
      const isRecrue = p.status === 'NEW_SIGNING' || 
                       (selectedSeason === '2026-2027' && joinedYr === '2026') ||
                       (selectedSeason === '2025-2026' && joinedYr === '2025');
      if (isRecrue) {
        seen.add((p.name || '').toLowerCase().trim());
        list.push(p);
      }
    });

    // 2. Transferred IN players from database
    clubTransfersIn.forEach(t => {
      const pKey = (t.player_name || '').toLowerCase().trim();
      if (!seen.has(pKey)) {
        seen.add(pKey);
        list.push({
          id: `rec_${t.transfer_id}`,
          name: t.player_name,
          number: t.number || 9,
          position: t.player_position || 'Attaquant',
          role_category: t.player_role || 'A',
          nationality: t.player_nationality || 'France',
          age: t.age_at_transfer || 24,
          market_value: t.market_value_display || '20.00 M€',
          joined_date: t.transfer_date || '2026-07-01',
          left_date: null,
          from_club: t.from_team_name,
          from_logo: t.from_team_logo,
          fee_display: t.fee_display || 'Transfert',
          transfer_type_label: t.transfer_type_label || '✨ Recrue',
          status: 'NEW_SIGNING',
          photo: t.player_photo_url || '/assets/players/defaults/m_default.webp',
          stats: { appearances: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0 }
        });
      }
    });

    return list;
  }, [clubTransfersIn, currentClubSquad, selectedSeason]);

  // Squad KPI Metrics
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

    return {
      total,
      avgAge,
      totalVal: `${valSum.toFixed(1)}M €`,
      arrivals: newSignings.length,
      departures: departedPlayers.length
    };
  }, [currentClubSquad, newSignings, departedPlayers]);

  // Filtered Roster for Card Grid
  const filteredRoster = useMemo(() => {
    let baseList = [];
    if (rosterPosition === 'RECRUES') {
      baseList = newSignings;
    } else if (rosterPosition === 'DEPARTS') {
      baseList = departedPlayers;
    } else {
      baseList = currentClubSquad?.players || [];
    }

    return baseList.filter(p => {
      // Position filter
      if (rosterPosition === 'G' && p.role_category !== 'G') return false;
      if (rosterPosition === 'D' && p.role_category !== 'D') return false;
      if (rosterPosition === 'M' && p.role_category !== 'M') return false;
      if (rosterPosition === 'A' && p.role_category !== 'A') return false;

      // Search filter
      if (rosterSearch.trim()) {
        const q = rosterSearch.toLowerCase().trim();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchNat = (p.nationality || '').toLowerCase().includes(q);
        const matchPos = (p.position || '').toLowerCase().includes(q);
        const matchNum = String(p.number || '') === q;
        const matchDest = (p.destination_club || '').toLowerCase().includes(q);
        const matchFrom = (p.from_club || '').toLowerCase().includes(q);
        return matchName || matchNat || matchPos || matchNum || matchDest || matchFrom;
      }
      return true;
    });
  }, [currentClubSquad, rosterPosition, rosterSearch, newSignings, departedPlayers]);

  // ── HEAD COACH RESOLUTION (SCD Type 2 & Master Profiles) ──
  const currentClubCoach = useMemo(() => {
    if (!selectedClub) return null;
    return resolveTeamCoach(selectedClub, selectedSeason);
  }, [selectedClub, selectedSeason]);

  // ── ENRICHED FOCUS TRANSFERTS FILTERED DATA ──
  const filteredTransfers = useMemo(() => {
    return (transfersData || []).filter(item => {
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

  // Reset pagination when transfer filters change
  React.useEffect(() => {
    setTransferDisplayLimit(36);
  }, [transferSeason, transferRole, transferTypeFilter, transferFeeRange, transferSearch, transferSort]);

  const visibleTransfers = useMemo(() => {
    return filteredTransfers.slice(0, transferDisplayLimit);
  }, [filteredTransfers, transferDisplayLimit]);

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
      default: return { label: 'Joueur', bg: 'rgba(255, 255, 255, 0.1)', color: '#fafafa', border: '#27272a' };
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
    return <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(255, 255, 255, 0.05)', color: '#71717a', border: '1px solid #27272a' }}>✅ ACTIF</span>;
  };

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
            <Users size={13} /> SQUADS & MERCATO SCD TYPE 2
          </span>
          <span style={{ color: '#27272a' }}>|</span>
          <span style={{ fontSize: 11, color: '#71717a' }}>
            RÉFÉRENTIEL 3 SAISONS · TRANSFERMARKT · PROPS & PASSES
          </span>
        </div>

        {/* Sub-Navigation Switcher */}
        <div style={{
          display: 'flex',
          background: '#18181b',
          border: '1px solid #27272a',
          borderRadius: 4,
          padding: 2,
          gap: 2,
        }}>
          <button
            onClick={() => setActiveSubTab('roster')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 3,
              fontSize: 11,
              fontWeight: activeSubTab === 'roster' ? 700 : 500,
              background: activeSubTab === 'roster' ? 'rgba(6, 182, 212, 0.14)' : 'transparent',
              color: activeSubTab === 'roster' ? '#06b6d4' : '#71717a',
              border: activeSubTab === 'roster' ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid transparent',
              cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <Users size={12} />
            <span>Effectifs (3 Saisons)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('mercato')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 3,
              fontSize: 11,
              fontWeight: activeSubTab === 'mercato' ? 700 : 500,
              background: activeSubTab === 'mercato' ? 'rgba(6, 182, 212, 0.14)' : 'transparent',
              color: activeSubTab === 'mercato' ? '#06b6d4' : '#71717a',
              border: activeSubTab === 'mercato' ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid transparent',
              cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <TrendingUp size={12} />
            <span>Transferts ({filteredTransfers.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('props')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 3,
              fontSize: 11,
              fontWeight: activeSubTab === 'props' ? 700 : 500,
              background: activeSubTab === 'props' ? 'rgba(6, 182, 212, 0.14)' : 'transparent',
              color: activeSubTab === 'props' ? '#06b6d4' : '#71717a',
              border: activeSubTab === 'props' ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid transparent',
              cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <Sparkles size={12} />
            <span>Passes & Props</span>
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
            background: '#121215',
            border: '1px solid #27272a',
            borderRadius: 6,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            {/* Top Bar: League + Season Selector */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              {/* League Selector Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Championnat :</span>
                {leaguesList.map(lg => (
                  <button
                    key={lg.id}
                    onClick={() => {
                      setRosterLeague(lg.id);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: rosterLeague === lg.id ? 700 : 500,
                      background: rosterLeague === lg.id ? 'rgba(6, 182, 212, 0.12)' : '#121215',
                      border: `1px solid ${rosterLeague === lg.id ? 'rgba(6, 182, 212, 0.35)' : '#27272a'}`,
                      color: rosterLeague === lg.id ? '#06b6d4' : '#fafafa',
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
                <span style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Saison :</span>
                <div style={{ display: 'flex', background: '#121215', borderRadius: 4, padding: 3, border: '1px solid #27272a', gap: 3 }}>
                  {availableSeasons.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSeason(s.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: selectedSeason === s.id ? 700 : 500,
                        background: selectedSeason === s.id ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                        color: selectedSeason === s.id ? '#06b6d4' : '#71717a',
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
              <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 600 }}>
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
                        borderRadius: 4,
                        background: isSelected ? 'rgba(6, 182, 212, 0.12)' : '#121215',
                        border: `1px solid ${isSelected ? 'rgba(6, 182, 212, 0.35)' : '#27272a'}`,
                        color: isSelected ? '#06b6d4' : '#fafafa',
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
              border: '1px solid rgba(6, 182, 212, 0.35)',
              borderRadius: 6,
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
                    <h2 style={{ fontSize: '1.6rem', color: '#fafafa', margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
                      {currentClubSquad.club_name}
                    </h2>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#121215', color: '#06b6d4', border: '1px solid #27272a' }}>
                      Saison {selectedSeason}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4, fontSize: 12, color: '#71717a' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={13} color="#06b6d4" />
                      {currentClubSquad.stadium} ({currentClubSquad.country})
                    </span>
                    <span>·</span>
                    <span>Championnat : <strong style={{ color: '#fafafa' }}>{currentClubSquad.league}</strong></span>
                  </div>
                </div>
              </div>

              {/* KPI Badges */}
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 4, padding: '10px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase' }}>Effectif</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', marginTop: 2 }}>{squadStats.total} <span style={{ fontSize: 11, color: '#71717a' }}>joueurs</span></div>
                </div>

                <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 4, padding: '10px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase' }}>Âge Moyen</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#06b6d4', marginTop: 2 }}>{squadStats.avgAge} <span style={{ fontSize: 11, color: '#71717a' }}>ans</span></div>
                </div>

                <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 4, padding: '10px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase' }}>Valeur Totale</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80', marginTop: 2 }}>{squadStats.totalVal}</div>
                </div>

                {squadStats.arrivals > 0 && (
                  <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: 4, padding: '10px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#4ade80', textTransform: 'uppercase' }}>Nouvelles Recrues</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80', marginTop: 2 }}>+{squadStats.arrivals}</div>
                  </div>
                )}

                {squadStats.departures > 0 && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 4, padding: '10px 16px', textAlign: 'center' }}>
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
              background: '#121215',
              border: '1px solid #27272a',
              borderRadius: 6,
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
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#fafafa' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, fontSize: 11, color: '#71717a', flexWrap: 'wrap' }}>
                    <span>{currentClubCoach.nationality} · <strong style={{ color: '#fafafa' }}>{currentClubCoach.age} ans</strong></span>
                    <span>·</span>
                    <span>Schéma type : <strong style={{ color: '#06b6d4' }}>{currentClubCoach.preferred_formation}</strong></span>
                    <span>·</span>
                    <span>Mandat : <strong style={{ color: '#fafafa' }}>{currentClubCoach.valid_from}</strong> ➔ <strong style={{ color: currentClubCoach.valid_to ? '#f87171' : '#4ade80' }}>{currentClubCoach.valid_to || 'Présent'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Coach Stats */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, background: '#121215', padding: '8px 14px', borderRadius: 4, border: '1px solid #27272a', flexWrap: 'wrap' }}>
                <span>🏟️ <strong style={{ color: '#fafafa' }}>{currentClubCoach.matches_count}</strong> matchs</span>
                <span>·</span>
                <span>🏆 <strong style={{ color: '#4ade80' }}>{currentClubCoach.wins}V</strong> - {currentClubCoach.draws}N - {currentClubCoach.losses}D</span>
                <span>·</span>
                <span>📈 <strong style={{ color: '#06b6d4' }}>{currentClubCoach.win_rate_pct}%</strong> victoires</span>
                <span>·</span>
                <span>⚡ <strong style={{ color: '#fafafa' }}>{currentClubCoach.points_per_match}</strong> PPM</span>
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
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    border: `1px solid ${rosterPosition === pos.id ? 'rgba(6, 182, 212, 0.35)' : '#27272a'}`,
                    background: rosterPosition === pos.id ? 'rgba(6, 182, 212, 0.12)' : '#121215',
                    color: rosterPosition === pos.id ? '#06b6d4' : '#71717a',
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
              background: '#121215',
              border: '1px solid #27272a',
              borderRadius: 4,
              padding: '8px 14px',
              width: 280,
            }}>
              <Search size={14} color="#06b6d4" style={{ marginRight: 8 }} />
              <input
                type="text"
                value={rosterSearch}
                onChange={e => setRosterSearch(e.target.value)}
                placeholder="Rechercher joueur, n°, poste..."
                style={{ width: '100%', background: 'transparent', border: 'none', fontSize: 12, color: '#fafafa', outline: 'none' }}
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
                    background: '#121215',
                    border: '1px solid #27272a',
                    borderRadius: 6,
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
                        borderRadius: 4,
                        background: '#121215',
                        border: '1px solid #27272a',
                        color: '#06b6d4',
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
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {player.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                        {player.nationality} · <strong style={{ color: '#fafafa' }}>{player.age} ans</strong>
                      </div>
                      <div style={{ fontSize: 11, color: '#06b6d4', fontWeight: 600, marginTop: 2 }}>
                        {player.position}
                      </div>
                    </div>
                  </div>

                  {/* Transfermarkt Dates & Value Box */}
                  <div style={{
                    background: '#121215',
                    border: '1px solid #27272a',
                    borderRadius: 4,
                    padding: 10,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    fontSize: 11
                  }}>
                    <div>
                      <span style={{ color: '#71717a', display: 'block', fontSize: 10 }}>Arrivée Club</span>
                      <strong style={{ color: '#fafafa' }}>{player.joined_date || '01/07/2024'}</strong>
                    </div>

                    <div>
                      <span style={{ color: '#71717a', display: 'block', fontSize: 10 }}>
                        {player.left_date ? 'Date de Départ' : 'Fin Contrat'}
                      </span>
                      <strong style={{ color: player.left_date ? '#f87171' : '#06b6d4' }}>
                        {player.left_date || player.contract_until || '2028-06-30'}
                      </strong>
                    </div>

                    <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #27272a', paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#71717a', fontSize: 10 }}>Valeur Marchande Transfermarkt</span>
                      <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 12 }}>
                        {player.market_value}
                      </span>
                    </div>

                    {player.destination_club && (
                      <div style={{ gridColumn: '1 / -1', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 4, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#f87171', fontSize: 11, fontWeight: 600 }}>➔ Vers {player.destination_club}</span>
                        <span style={{ color: '#06b6d4', fontSize: 11, fontWeight: 700 }}>{player.fee_display}</span>
                      </div>
                    )}

                    {player.from_club && (
                      <div style={{ gridColumn: '1 / -1', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 4, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#4ade80', fontSize: 11, fontWeight: 600 }}>✨ Depuis {player.from_club}</span>
                        <span style={{ color: '#06b6d4', fontSize: 11, fontWeight: 700 }}>{player.fee_display}</span>
                      </div>
                    )}
                  </div>

                  {/* Season Stats mini-bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', fontSize: 11, color: '#71717a', background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: 4 }}>
                    <span>🏟️ <strong style={{ color: '#fafafa' }}>{player.stats?.appearances || 0}</strong> matchs</span>
                    <span>⚽ <strong style={{ color: '#4ade80' }}>{player.stats?.goals || 0}</strong> buts</span>
                    <span>🎯 <strong style={{ color: '#06b6d4' }}>{player.stats?.assists || 0}</strong> passes</span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredRoster.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: '#121215', borderRadius: 6, border: '1px solid #27272a' }}>
              <Users size={32} color="#71717a" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, color: '#fafafa', fontWeight: 600 }}>Aucun joueur trouvé pour ce filtre</div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>Essayez de modifier votre terme de recherche ou le filtre de poste.</div>
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
            border: '1px solid rgba(6, 182, 212, 0.35)',
            borderRadius: 6,
            padding: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
          }}>
            <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 4, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mouvements Suivis</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', marginTop: 4 }}>
                {transferStats.total} <span style={{ fontSize: 12, color: '#06b6d4' }}>transferts</span>
              </div>
            </div>

            <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 4, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Volume Financier Total</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#4ade80', marginTop: 4 }}>
                {transferStats.totalFeeM}
              </div>
            </div>

            <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 4, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Âge Moyen au Transfert</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#06b6d4', marginTop: 4 }}>
                {transferStats.avgAge}
              </div>
            </div>

            <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 4, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transfert Record</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#06b6d4', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {transferStats.recordFee}
              </div>
              <div style={{ fontSize: 10, color: '#71717a', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {transferStats.recordPlayer}
              </div>
            </div>
          </div>

          {/* ── 2. MULTI-DIMENSIONAL CONTROLS & FILTER BAR ── */}
          <div style={{
            background: '#121215',
            border: '1px solid #27272a',
            borderRadius: 6,
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
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      border: `1px solid ${transferSeason === s.id ? 'rgba(6, 182, 212, 0.35)' : '#27272a'}`,
                      background: transferSeason === s.id ? 'rgba(6, 182, 212, 0.12)' : '#121215',
                      color: transferSeason === s.id ? '#06b6d4' : '#71717a',
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
                <span style={{ fontSize: 11, color: '#71717a' }}>Trier par :</span>
                <select
                  value={transferSort}
                  onChange={e => setTransferSort(e.target.value)}
                  style={{
                    background: '#121215',
                    border: '1px solid #27272a',
                    borderRadius: 4,
                    color: '#fafafa',
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
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      border: `1px solid ${transferRole === r.id ? 'rgba(6, 182, 212, 0.35)' : '#27272a'}`,
                      background: transferRole === r.id ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255,255,255,0.02)',
                      color: transferRole === r.id ? '#06b6d4' : '#71717a',
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
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      border: `1px solid ${transferFeeRange === f.id ? 'rgba(6, 182, 212, 0.35)' : '#27272a'}`,
                      background: transferFeeRange === f.id ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255,255,255,0.02)',
                      color: transferFeeRange === f.id ? '#4ade80' : '#71717a',
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
              background: '#121215',
              border: '1px solid #27272a',
              borderRadius: 4,
              padding: '8px 14px',
            }}>
              <Search size={14} color="#06b6d4" style={{ marginRight: 10 }} />
              <input
                type="text"
                value={transferSearch}
                onChange={e => setTransferSearch(e.target.value)}
                placeholder="Rechercher joueur, club vendeur/acheteur, nationalité (ex: Mbappé, PSG, Man City, France)..."
                style={{ width: '100%', background: 'transparent', border: 'none', fontSize: 12, color: '#fafafa', outline: 'none' }}
              />
              {transferSearch && (
                <button
                  onClick={() => setTransferSearch('')}
                  style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 11 }}
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
            {visibleTransfers.map((item) => (
              <TransferCard key={item.transfer_id} transfer={item} />
            ))}
          </div>

          {/* Pagination Progressive */}
          {visibleTransfers.length < filteredTransfers.length && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              <button
                onClick={() => setTransferDisplayLimit(prev => prev + 36)}
                style={{
                  background: '#121215',
                  border: '1px solid rgba(6, 182, 212, 0.35)',
                  color: '#06b6d4',
                  padding: '10px 24px',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
              >
                <span>Afficher plus de mouvements ({visibleTransfers.length} / {filteredTransfers.length})</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {filteredTransfers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: '#121215', borderRadius: 6, border: '1px solid #27272a' }}>
              <Users size={32} color="#71717a" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, color: '#fafafa', fontWeight: 600 }}>Aucun mouvement trouvé pour ces critères</div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>Modifiez les filtres de saison, de poste ou la recherche pour explorer les transferts.</div>
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3 : PROPS & PASSING NETWORK ── */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'props' && (
        <PassingNetwork
          initialLeague={rosterLeague}
          initialClub={selectedClub}
          initialSeason={selectedSeason}
        />
      )}

    </div>
  );
}
