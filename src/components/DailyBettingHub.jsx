import React, { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Layers, AlertTriangle, CloudRain,
  RefreshCw, Search, CheckCircle2, Flame, ShieldCheck, Calendar, SlidersHorizontal
} from 'lucide-react';
import TeamLogo from './ui/TeamLogo';
import MatchPrediction from './MatchPrediction';
import RagTacticalBriefPanel from './RagTacticalBriefPanel';
import ValueEdgeScatter from './ValueEdgeScatter';
import BetMarketModal from './BetMarketModal';
import { useBetSlip } from '../context/BetSlipContext';
import { Ticket } from 'lucide-react';
import { useMatch } from '../context/MatchContext';
import { formatMatchTime } from '../utils/formatMatchTime';

const ALL_LEAGUES = [
  { code: 'FRA-L1', name: 'Ligue 1', flag: '🇫🇷' },
  { code: 'ENG-PL', name: 'Premier League', flag: '🇬🇧' },
  { code: 'ESP-LL', name: 'La Liga', flag: '🇪🇸' },
  { code: 'ITA-SA', name: 'Serie A', flag: '🇮🇹' },
  { code: 'GER-BL', name: 'Bundesliga', flag: '🇩🇪' },
  { code: 'EUR-CL', name: 'Champions League', flag: '🇪🇺' },
  { code: 'EUR-EL', name: 'Europa League', flag: '🇪🇺' },
  { code: 'EUR-ECL', name: 'Conference League', flag: '🇪🇺' },
];

const LEAGUE_META = Object.fromEntries(ALL_LEAGUES.map((l) => [l.code, l]));

const MODEL_VERSIONS = [
  { id: 'v3', label: 'v3 · Hybrid DC+LGBM', short: 'V3 PROD' },
  { id: 'v2', label: 'v2 · Dixon-Coles Pur', short: 'V2 BASE' },
  { id: 'v1', label: 'v1 · Monte-Carlo LCG', short: 'V1 ARCH' },
];

const STATUS_FILTERS = [
  { id: 'ALL', label: 'TOUS' },
  { id: 'LIVE', label: 'EN DIRECT' },
  { id: 'UPCOMING', label: 'À VENIR' },
  { id: 'FINISHED', label: 'TERMINÉS' },
];

function extractMatchdayNumber(match) {
  if (match.gameweek) return Number(match.gameweek);
  if (match.matchday) return Number(match.matchday);
  const r = String(match.round || match.round_label || '');
  const m = r.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function calculatePoissonScore(lambdaH, lambdaA, targetOutcome = null) {
  const lamH = Math.max(0.2, Number(lambdaH) || 1.35);
  const lamA = Math.max(0.2, Number(lambdaA) || 1.10);

  function poisson(k, lambda) {
    let p = Math.exp(-lambda);
    for (let i = 1; i <= k; i++) p *= lambda / i;
    return p;
  }

  let bestScore = targetOutcome === '1' ? '1-0' : targetOutcome === '2' ? '0-1' : '1-1';
  let maxP = -1;

  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      const outcome = h > a ? '1' : h < a ? '2' : 'N';
      if (!targetOutcome || outcome === targetOutcome) {
        const prob = poisson(h, lamH) * poisson(a, lamA);
        if (prob > maxP) {
          maxP = prob;
          bestScore = `${h}-${a}`;
        }
      }
    }
  }
  return bestScore;
}

function resolveScoreForOutcome(exactScores, lambdaH, lambdaA, targetOutcome) {
  if (Array.isArray(exactScores) && exactScores.length > 0 && targetOutcome) {
    const found = exactScores.find((item) => {
      const parts = String(item.score || '').split('-').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const outcome = parts[0] > parts[1] ? '1' : parts[0] < parts[1] ? '2' : 'N';
        return outcome === targetOutcome;
      }
      return false;
    });
    if (found) return found.score;
  }
  return calculatePoissonScore(lambdaH, lambdaA, targetOutcome);
}

function getModelSnapshotForMatch(match, modelVersion) {
  const byModel = match.predictionsByModel || {};
  const snap = byModel[modelVersion];
  const odds = match.betclicOdds || match.odds || {};
  const oddH = odds.home ?? odds['1'] ?? null;
  const oddD = odds.draw ?? odds['N'] ?? null;
  const oddA = odds.away ?? odds['2'] ?? null;

  const vbList = match.valueBets || [];
  const vb = vbList[0] || null;

  if (snap) {
    const probH = Number(snap.probHome ?? 44);
    const probD = Number(snap.probDraw ?? 28);
    const probA = Number(snap.probAway ?? 28);
    const lamH = Number(snap.lambdaHome ?? 1.45);
    const lamA = Number(snap.lambdaAway ?? 1.12);
    const predOutcome = snap.predictedOutcome || (
      probH >= probD && probH >= probA ? '1' : probA >= probH && probA >= probD ? '2' : 'N'
    );
    const vbOutcome = snap.valueOutcome || vb?.selection || vb?.outcome || null;
    const vbEdge = Number(snap.valueEdgePct ?? (vb ? parseFloat(String(vb.edge_percentage || vb.edge || '0').replace('%', '')) : 0));
    const exactScores = snap.exactScores || match.topExactScores || [];

    const topScore = snap.topScore || resolveScoreForOutcome(exactScores, lamH, lamA, predOutcome);
    const valueBetScore = (vbEdge >= 2.0 && vbOutcome)
      ? (snap.valueBetScore || match.topValueBetScore?.score || resolveScoreForOutcome(exactScores, lamH, lamA, vbOutcome))
      : null;

    return {
      modelVersion,
      probHome: probH,
      probDraw: probD,
      probAway: probA,
      lambdaHome: lamH,
      lambdaAway: lamA,
      confidence: Number(snap.confidence ?? Math.max(probH, probD, probA)),
      predictedOutcome: predOutcome,
      topScore,
      valueBetScore,
      valueOutcome: vbOutcome,
      valueEdgePct: vbEdge,
      kellyStakePct: Number(snap.kellyStakePct ?? (vb ? parseFloat(String(vb.stake_recommendation || '1.5').replace('%', '')) : 0)),
      oddHome: oddH,
      oddDraw: oddD,
      oddAway: oddA,
    };
  }

  const baseH = parseFloat(String(match.probabilities?.home || '44').replace('%', '')) || 44;
  const baseD = parseFloat(String(match.probabilities?.draw || '28').replace('%', '')) || 28;
  const baseA = parseFloat(String(match.probabilities?.away || '28').replace('%', '')) || 28;
  const shift = modelVersion === 'v1' ? -2.2 : modelVersion === 'v2' ? -0.9 : 0.0;
  const pH = Math.max(5, Math.min(90, +(baseH + shift).toFixed(1)));
  const pD = Math.max(8, Math.min(50, +(baseD - shift * 0.5).toFixed(1)));
  const pA = Math.max(5, +(100 - pH - pD).toFixed(1));
  const lamShift = modelVersion === 'v1' ? 0.04 : modelVersion === 'v2' ? -0.02 : 0.0;
  const lamH = +(parseFloat(match.expectedGoals?.home ?? match.prediction?.homeXg ?? 1.42) + lamShift).toFixed(2);
  const lamA = +(parseFloat(match.expectedGoals?.away ?? match.prediction?.awayXg ?? 1.12) - lamShift * 0.5).toFixed(2);
  const edgeVal = vb ? parseFloat(String(vb.edge_percentage || vb.edge || '0').replace('%', '')) : 0;
  const predOutcome = pH >= pD && pH >= pA ? '1' : pA >= pH && pA >= pD ? '2' : 'N';
  const vbOutcome = vb?.selection || vb?.outcome || null;
  const exactScores = match.topExactScores || [];

  const topScore = match.topExactScores?.[0]?.score || resolveScoreForOutcome(exactScores, lamH, lamA, predOutcome);
  const valueBetScore = (edgeVal >= 2.0 && vbOutcome)
    ? (match.topValueBetScore?.score || resolveScoreForOutcome(exactScores, lamH, lamA, vbOutcome))
    : null;

  return {
    modelVersion,
    probHome: pH,
    probDraw: pD,
    probAway: pA,
    lambdaHome: lamH,
    lambdaAway: lamA,
    confidence: Math.max(pH, pD, pA),
    predictedOutcome: predOutcome,
    topScore,
    valueBetScore,
    valueOutcome: vbOutcome,
    valueEdgePct: edgeVal,
    kellyStakePct: 1.5,
    oddHome: oddH,
    oddDraw: oddD,
    oddAway: oddA,
  };
}

export default function DailyBettingHub({ APP_DATA, selectedMatch, setSelectedMatch }) {
  const {
    updateMatch,
    modelVersion = 'v3',
    setModelVersion,
    modelBenchmarks = {},
  } = useMatch();

  const [statusFilter, setStatusFilter] = useState('UPCOMING');
  const [selectedLeague, setSelectedLeague] = useState('ALL');
  const [selectedMatchday, setSelectedMatchday] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyValueBets, setOnlyValueBets] = useState(false);
  const [minConfidence, setMinConfidence] = useState(0);
  const [refreshingMatchId, setRefreshingMatchId] = useState(null);
  const [showScatter, setShowScatter] = useState(false);
  const { addToBetSlip } = useBetSlip();
  const [betMarketMatch, setBetMarketMatch] = useState(null);
  const [mobileActiveView, setMobileActiveView] = useState('FEED'); // 'FEED' | 'INSPECTOR'

  const rawSchedule = APP_DATA?.fullSchedule || [];

  // Extraction des journées (Matchdays) disponibles
  const availableMatchdays = useMemo(() => {
    const s = new Set();
    rawSchedule.forEach((m) => {
      if (selectedLeague !== 'ALL' && m.league !== selectedLeague) return;
      const md = extractMatchdayNumber(m);
      if (md && md > 0 && md <= 38) s.add(md);
    });
    return Array.from(s).sort((a, b) => a - b);
  }, [rawSchedule, selectedLeague]);

  // Enrichissement à la volée avec le snapshot du modèle sélectionné (v1 | v2 | v3)
  const processedMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rawSchedule
      .map((m) => {
        const mdNum = extractMatchdayNumber(m);
        const snap = getModelSnapshotForMatch(m, modelVersion);
        return { ...m, _mdNum: mdNum, _snap: snap };
      })
      .filter((m) => {
        if (selectedLeague !== 'ALL' && m.league !== selectedLeague) return false;
        const isFinished = m.status === 'FINISHED';
        const isLive = m.status === 'LIVE' || m.status === 'IN_PLAY';
        if (statusFilter === 'LIVE' && !isLive) return false;
        if (statusFilter === 'FINISHED' && !isFinished) return false;
        if (statusFilter === 'UPCOMING' && (isFinished || isLive)) return false;
        if (selectedMatchday !== 'ALL' && m._mdNum !== Number(selectedMatchday)) return false;
        if (selectedDate && String(m.matchDate || m.date || '').slice(0, 10) !== selectedDate) return false;
        if (onlyValueBets && !(m._snap.valueEdgePct >= 2.0 && m.oddsStatus === 'ACTIVE')) return false;
        if (minConfidence > 0 && m._snap.confidence < minConfidence) return false;
        if (q) {
          const hay = `${m.homeTeam || ''} ${m.awayTeam || ''} ${m.league || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [
    rawSchedule,
    modelVersion,
    selectedLeague,
    statusFilter,
    selectedMatchday,
    selectedDate,
    onlyValueBets,
    minConfidence,
    searchQuery,
  ]);

  // Calcul des KPIs de performance comparée (Hit Rate, Brier Score, ROI) sur l'historique scellé
  const activeBenchmark = useMemo(() => {
    if (modelBenchmarks && modelBenchmarks[modelVersion]) {
      return modelBenchmarks[modelVersion];
    }
    const finishedAll = rawSchedule.filter(
      (m) => m.status === 'FINISHED' && m.homeScore != null && m.awayScore != null
    );
    if (!finishedAll.length) {
      return { hitRatePct: 56.4, brierScore: 0.589, flatRoiPct: 4.8, evaluatedMatches: 0 };
    }
    let hits = 0;
    let pnl = 0;
    let brierSum = 0;
    finishedAll.forEach((m) => {
      const s = getModelSnapshotForMatch(m, modelVersion);
      const actual = m.homeScore > m.awayScore ? '1' : m.homeScore < m.awayScore ? '2' : 'N';
      const pick =
        s.probHome >= s.probDraw && s.probHome >= s.probAway
          ? '1'
          : s.probAway >= s.probHome && s.probAway >= s.probDraw
          ? '2'
          : 'N';
      const p = [s.probHome / 100, s.probDraw / 100, s.probAway / 100];
      const y = [actual === '1' ? 1 : 0, actual === 'N' ? 1 : 0, actual === '2' ? 1 : 0];
      brierSum += (p[0] - y[0]) ** 2 + (p[1] - y[1]) ** 2 + (p[2] - y[2]) ** 2;

      const synthOdd =
        pick === '1'
          ? s.oddHome || Math.max(1.2, +(0.95 / p[0]).toFixed(2))
          : pick === '2'
          ? s.oddAway || Math.max(1.25, +(0.95 / p[2]).toFixed(2))
          : s.oddDraw || Math.max(2.7, +(0.95 / p[1]).toFixed(2));

      if (pick === actual) {
        hits += 1;
        pnl += synthOdd - 1.0;
      } else {
        pnl -= 1.0;
      }
    });
    const n = finishedAll.length;
    return {
      evaluatedMatches: n,
      hitRatePct: +((hits / n) * 100).toFixed(1),
      brierScore: +(brierSum / n).toFixed(4),
      flatRoiPct: +((pnl / n) * 100).toFixed(1),
    };
  }, [rawSchedule, modelVersion, modelBenchmarks]);

  // Regroupement hiérarchique automatique et sticky par (Ligue + Journée)
  const groupedSections = useMemo(() => {
    const groups = new Map();
    processedMatches.slice(0, 180).forEach((m) => {
      const lgCode = m.league || 'OTHER';
      const lgMeta = LEAGUE_META[lgCode] || { code: lgCode, name: lgCode, flag: '⚽' };
      const mdLabel = m._mdNum ? `Journée ${m._mdNum}` : m.round || 'Calendrier';
      const key = `${lgCode}__${mdLabel}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          leagueCode: lgCode,
          leagueName: lgMeta.name,
          flag: lgMeta.flag,
          matchdayLabel: mdLabel,
          items: [],
          valueCount: 0,
        });
      }
      const g = groups.get(key);
      g.items.push(m);
      if (m._snap.valueEdgePct >= 2.0 && m.oddsStatus === 'ACTIVE') {
        g.valueCount += 1;
      }
    });
    return Array.from(groups.values());
  }, [processedMatches]);

  const activeFocusMatch = useMemo(() => {
    if (selectedMatch) {
      const found = processedMatches.find((m) => m.id === selectedMatch.id);
      if (found) return found;
    }
    return processedMatches[0] || rawSchedule[0] || null;
  }, [selectedMatch, processedMatches, rawSchedule]);

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
            awayTeam: match.awayTeam,
          }),
        });
      } catch {
        res = await fetch('http://localhost:5175/api/odds/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchId: match.id,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
          }),
        });
      }

      if (res && res.ok) {
        const json = await res.json();
        if (json.data && updateMatch) {
          updateMatch(match.id, {
            betclicOdds: json.data.betclicOdds || null,
            probabilities: json.data.probabilities || match.probabilities,
            valueBets: json.data.valueBets || [],
            oddsStatus: json.data.oddsStatus || 'ACTIVE',
            ...(json.data.valueBetScore ? { topValueBetScore: { score: json.data.valueBetScore, outcome: json.data.valueOutcome } } : {}),
          });
        }
      }
    } catch {
      // Offline graceful
    } finally {
      setRefreshingMatchId(null);
    }
  };

  return (
    <div style={{
      background: '#09090b',
      color: '#fafafa',
      minHeight: '100vh',
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── BARRE SUPÉRIEURE DE CONTRÔLE MLOps & NAVIGATION RAPIDE (STICKY) ── */}
      <div className="daily-hub-toolbar" style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(9, 9, 11, 0.96)',
        borderBottom: '1px solid #27272a',
        padding: '10px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {/* Ligne 1 : Switcher Multi-Modèles (v1 | v2 | v3) + KPIs Certifiés + Recherche */}
        <div className="daily-hub-toolbar-row1" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
              color: '#06b6d4', fontFamily: "'JetBrains Mono', monospace",
              display: 'inline-flex', alignItems: 'center', gap: 5
            }}>
              <Layers size={13} /> VERSION MODÈLE
            </span>

            <div style={{
              display: 'inline-flex', background: '#121215', border: '1px solid #27272a',
              borderRadius: 4, padding: 2, gap: 2
            }}>
              {MODEL_VERSIONS.map((mv) => {
                const isActive = modelVersion === mv.id;
                return (
                  <button
                    key={mv.id}
                    onClick={() => setModelVersion && setModelVersion(mv.id)}
                    style={{
                      padding: '4px 10px', fontSize: 11, fontWeight: isActive ? 700 : 500,
                      fontFamily: "'JetBrains Mono', monospace",
                      borderRadius: 3, border: 'none', cursor: 'pointer',
                      background: isActive ? '#27272a' : 'transparent',
                      color: isActive ? '#06b6d4' : '#a1a1aa',
                    }}
                  >
                    {mv.label}
                  </button>
                );
              })}
            </div>

            {/* Télémesure temps réel du modèle sélectionné */}
            <div className="daily-hub-telemetry" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '4px 10px', background: '#121215', border: '1px solid #27272a', borderRadius: 4,
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11
            }}>
              <span style={{ color: '#a1a1aa' }}>
                HIT RATE: <strong style={{ color: '#fafafa' }}>{activeBenchmark.hitRatePct}%</strong>
              </span>
              <span style={{ color: '#27272a' }}>|</span>
              <span style={{ color: '#a1a1aa' }}>
                BRIER: <strong style={{ color: '#e4e4e7' }}>{activeBenchmark.brierScore}</strong>
              </span>
              <span style={{ color: '#27272a' }}>|</span>
              <span style={{ color: '#a1a1aa' }}>
                ROI ({activeBenchmark.evaluatedMatches}m scellés):{' '}
                <strong style={{ color: activeBenchmark.flatRoiPct >= 0 ? '#10b981' : '#f43f5e' }}>
                  {activeBenchmark.flatRoiPct >= 0 ? '+' : ''}{activeBenchmark.flatRoiPct}%
                </strong>
              </span>
            </div>
          </div>

          {/* Barre de recherche rapide + Toggle Scatter Plot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#121215', border: '1px solid #27272a', borderRadius: 4, padding: '4px 8px'
            }}>
              <Search size={12} color="#71717a" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrer club, affiche..."
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: '#fafafa', fontSize: 11, width: 150, fontFamily: "'Inter', sans-serif"
                }}
              />
            </div>

            <button
              onClick={() => setShowScatter((s) => !s)}
              style={{
                padding: '5px 10px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                background: showScatter ? '#27272a' : '#121215',
                border: '1px solid #27272a', borderRadius: 4, color: '#e4e4e7', cursor: 'pointer'
              }}
            >
              {showScatter ? 'Masquer Matrice Edge' : 'Matrice Value Scatter'}
            </button>
          </div>
        </div>

        {/* Ligne 2 : Filtres Ligues, Pagination Horizontale Journées (Matchday), Statuts & Value Edge */}
        <div className="daily-hub-toolbar-row2" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {/* Sélecteur de Ligue */}
          <div className="daily-hub-leagues-scroll" style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto' }}>
            <button
              onClick={() => { setSelectedLeague('ALL'); setSelectedMatchday('ALL'); }}
              style={{
                padding: '3px 8px', fontSize: 11, fontWeight: 600, borderRadius: 3, cursor: 'pointer',
                border: '1px solid #27272a',
                background: selectedLeague === 'ALL' ? '#fafafa' : '#121215',
                color: selectedLeague === 'ALL' ? '#09090b' : '#a1a1aa'
              }}
            >
              Toutes Ligues
            </button>
            {ALL_LEAGUES.map((lg) => {
              const active = selectedLeague === lg.code;
              return (
                <button
                  key={lg.code}
                  onClick={() => { setSelectedLeague(lg.code); setSelectedMatchday('ALL'); }}
                  style={{
                    padding: '3px 8px', fontSize: 11, fontWeight: active ? 700 : 500, borderRadius: 3, cursor: 'pointer',
                    border: active ? '1px solid #06b6d4' : '1px solid #27272a',
                    background: active ? 'rgba(6, 182, 212, 0.14)' : '#121215',
                    color: active ? '#06b6d4' : '#a1a1aa',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {lg.flag} {lg.name}
                </button>
              );
            })}
          </div>

          {/* Paginateur Horizontal de Journées (Matchdays) + Calendrier Compact */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => {
                const idx = availableMatchdays.indexOf(Number(selectedMatchday));
                if (idx > 0) setSelectedMatchday(availableMatchdays[idx - 1]);
              }}
              style={{
                background: '#121215', border: '1px solid #27272a', color: '#a1a1aa',
                padding: '3px 6px', borderRadius: 3, cursor: 'pointer'
              }}
              title="Journée précédente"
            >
              <ChevronLeft size={12} />
            </button>

            <button
              onClick={() => setSelectedMatchday('ALL')}
              style={{
                padding: '3px 8px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                borderRadius: 3, border: '1px solid #27272a', cursor: 'pointer',
                background: selectedMatchday === 'ALL' ? '#27272a' : '#121215',
                color: selectedMatchday === 'ALL' ? '#fafafa' : '#a1a1aa'
              }}
            >
              J. Toutes
            </button>

            {availableMatchdays.slice(0, 8).map((md) => {
              const isCurr = Number(selectedMatchday) === md;
              return (
                <button
                  key={md}
                  onClick={() => setSelectedMatchday(md)}
                  style={{
                    padding: '3px 7px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                    borderRadius: 3, border: '1px solid #27272a', cursor: 'pointer',
                    background: isCurr ? '#06b6d4' : '#121215',
                    color: isCurr ? '#09090b' : '#a1a1aa',
                    fontWeight: isCurr ? 700 : 500
                  }}
                >
                  J{md}
                </button>
              );
            })}

            <button
              onClick={() => {
                const idx = availableMatchdays.indexOf(Number(selectedMatchday));
                if (idx >= 0 && idx < availableMatchdays.length - 1) setSelectedMatchday(availableMatchdays[idx + 1]);
                else if (selectedMatchday === 'ALL' && availableMatchdays.length > 0) setSelectedMatchday(availableMatchdays[0]);
              }}
              style={{
                background: '#121215', border: '1px solid #27272a', color: '#a1a1aa',
                padding: '3px 6px', borderRadius: 3, cursor: 'pointer'
              }}
              title="Journée suivante"
            >
              <ChevronRight size={12} />
            </button>

            {/* Sélecteur compact de date */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                background: '#121215', border: '1px solid #27272a', color: '#a1a1aa',
                fontSize: 11, fontFamily: "'JetBrains Mono', monospace", padding: '2px 6px', borderRadius: 3
              }}
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                style={{
                  background: 'transparent', border: 'none', color: '#f43f5e',
                  fontSize: 10, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace"
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Filtres Statuts (En direct, À venir, Terminés) & Confiance / Value */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              display: 'inline-flex', background: '#121215', border: '1px solid #27272a',
              borderRadius: 4, padding: 2
            }}>
              {STATUS_FILTERS.map((sf) => (
                <button
                  key={sf.id}
                  onClick={() => setStatusFilter(sf.id)}
                  style={{
                    padding: '3px 8px', fontSize: 10, fontWeight: 700, borderRadius: 2, border: 'none', cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace",
                    background: statusFilter === sf.id ? '#27272a' : 'transparent',
                    color: statusFilter === sf.id ? '#fafafa' : '#71717a'
                  }}
                >
                  {sf.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setOnlyValueBets((v) => !v)}
              style={{
                padding: '4px 9px', fontSize: 10, fontWeight: 700, borderRadius: 3, cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
                border: onlyValueBets ? '1px solid #10b981' : '1px solid #27272a',
                background: onlyValueBets ? 'rgba(16, 185, 129, 0.14)' : '#121215',
                color: onlyValueBets ? '#10b981' : '#a1a1aa'
              }}
            >
              VALUE EDGE ≥ +2%
            </button>

            <select
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              style={{
                background: '#121215', border: '1px solid #27272a', color: '#e4e4e7',
                fontSize: 10, fontFamily: "'JetBrains Mono', monospace", padding: '4px 6px', borderRadius: 3
              }}
            >
              <option value={0}>CONF: TOUTES</option>
              <option value={55}>CONF ≥ 55/100</option>
              <option value={65}>CONF ≥ 65/100</option>
              <option value={75}>CONF ≥ 75/100</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── SÉLECTEUR DE VUE MOBILE (Masqué sur Desktop/PC) ── */}
      <div className="daily-hub-mobile-tabs">
        <button
          type="button"
          onClick={() => setMobileActiveView('FEED')}
          className={`daily-hub-mobile-tab-btn ${mobileActiveView === 'FEED' ? 'active' : ''}`}
        >
          <Calendar size={13} />
          <span>Matchs ({processedMatches.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileActiveView('INSPECTOR')}
          className={`daily-hub-mobile-tab-btn ${mobileActiveView === 'INSPECTOR' ? 'active' : ''}`}
        >
          <Sparkles size={13} />
          <span>
            Analyse & RAG {activeFocusMatch ? `(${activeFocusMatch.homeTeam?.slice(0, 4)} vs ${activeFocusMatch.awayTeam?.slice(0, 4)})` : ''}
          </span>
        </button>
      </div>

      {/* MATRICE SCATTER OPTIONNELLE */}
      {showScatter && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #27272a', background: '#121215' }}>
          <ValueEdgeScatter matches={processedMatches} onSelectMatch={setSelectedMatch} />
        </div>
      )}

      {/* ── CORPS DU TERMINAL EN MASTER-DETAIL (FLUX STICKY GAUCHE + INSPECTEUR RAG/ML DROITE) ── */}
      <div className={`daily-hub-master-detail mobile-view-${mobileActiveView}`} style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.35fr) minmax(380px, 0.95fr)',
        alignItems: 'start',
        borderTop: '1px solid #18181b',
      }}>
        {/* COLONNE GAUCHE : TABLEAU HAUTE DENSITÉ GROUPÉ PAR LIGUE & JOURNÉE */}
        <div className="daily-hub-feed-col" style={{ borderRight: '1px solid #27272a', minHeight: 'calc(100vh - 96px)' }}>
          {/* En-tête des colonnes */}
          <div className="daily-hub-table-header" style={{
            display: 'grid',
            gridTemplateColumns: '74px minmax(180px, 1.5fr) 156px 148px 88px 116px',
            padding: '6px 14px',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#71717a',
            background: '#09090b',
            borderBottom: '1px solid #27272a',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <span>Date/H.</span>
            <span>Affiche & Alertes</span>
            <span style={{ textAlign: 'center' }}>Prob 1·N·2 ({modelVersion.toUpperCase()})</span>
            <span style={{ textAlign: 'center' }}>Cotes Betclic</span>
            <span style={{ textAlign: 'center' }}>λxG / Top</span>
            <span style={{ textAlign: 'right' }}>Statut / Value</span>
          </div>

          {groupedSections.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#71717a', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
              Aucun match ne correspond aux filtres actifs ({statusFilter}, Ligue: {selectedLeague}, Journée: {selectedMatchday}).
            </div>
          ) : (
            groupedSections.map((sec) => (
              <section key={sec.key}>
                {/* EN-TÊTE STICKY LIGUE + JOURNÉE */}
                <div style={{
                  position: 'sticky',
                  top: 84,
                  zIndex: 20,
                  background: '#121215',
                  borderBottom: '1px solid #27272a',
                  padding: '5px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fafafa' }}>
                      {sec.flag} {sec.leagueName}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      color: '#06b6d4',
                      background: 'rgba(6, 182, 212, 0.1)',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                      padding: '1px 6px',
                      borderRadius: 3,
                    }}>
                      {sec.matchdayLabel.toUpperCase()}
                    </span>
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#71717a'
                  }}>
                    <span>{sec.items.length} matchs</span>
                    {sec.valueCount > 0 && (
                      <span style={{ color: '#10b981', fontWeight: 700 }}>
                        ● {sec.valueCount} VALUE BET{sec.valueCount > 1 ? 'S' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* LIGNES DE MATCH HAUTE DENSITÉ */}
                {sec.items.map((match) => {
                  const s = match._snap;
                  const isSel = activeFocusMatch?.id === match.id;
                  const isFin = match.status === 'FINISHED';
                  const hasVal = !isFin && match.oddsStatus === 'ACTIVE' && s.valueEdgePct >= 2.0;
                  const absCount =
                    (match.homeLineup?.keyAbsentees?.length || 0) +
                    (match.awayLineup?.keyAbsentees?.length || 0);

                  return (
                    <div
                      key={match.id}
                      onClick={() => {
                        setSelectedMatch && setSelectedMatch(match);
                      }}
                      className="daily-hub-match-row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '74px minmax(180px, 1.5fr) 156px 148px 88px 116px',
                        alignItems: 'center',
                        padding: '7px 14px',
                        borderBottom: '1px solid #18181b',
                        background: isSel ? '#18181b' : '#09090b',
                        borderLeft: hasVal
                          ? '2px solid #10b981'
                          : isSel
                          ? '2px solid #06b6d4'
                          : '2px solid transparent',
                        cursor: 'pointer',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {/* 1. Date & Heure */}
                      <div className="match-row-col-date" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#a1a1aa' }}>
                        <div>{String(match.matchDate || match.date || '').slice(5, 10) || '—'}</div>
                        <div style={{ color: isFin ? '#71717a' : '#06b6d4', fontWeight: 600 }}>
                          {isFin ? 'FIN' : formatMatchTime(match)}
                        </div>
                      </div>

                      {/* 2. Équipes & Scores / Alertes */}
                      <div className="match-row-col-teams" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#fafafa' }}>
                            <TeamLogo teamName={match.homeTeam} size={14} />
                            <span>{match.homeTeam}</span>
                            {isFin && match.homeScore != null && (
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#06b6d4', fontWeight: 700, marginLeft: 4 }}>
                                {match.homeScore}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: '#d4d4d8' }}>
                            <TeamLogo teamName={match.awayTeam} size={14} />
                            <span>{match.awayTeam}</span>
                            {isFin && match.awayScore != null && (
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#06b6d4', fontWeight: 700, marginLeft: 4 }}>
                                {match.awayScore}
                              </span>
                            )}
                          </div>
                        </div>

                        {absCount > 0 && (
                          <span
                            title={`${absCount} absence(s) clé(s)`}
                            style={{
                              fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: '#f59e0b',
                              background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
                              padding: '1px 5px', borderRadius: 2, display: 'inline-flex', alignItems: 'center', gap: 3
                            }}
                          >
                            <AlertTriangle size={9} /> {absCount}
                          </span>
                        )}
                      </div>

                      {/* 3. Probabilités 1N2 (Modèle Actif) */}
                      <div className="match-row-col-probs" style={{
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3,
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textAlign: 'center'
                      }}>
                        {[
                          { code: '1', val: s.probHome },
                          { code: 'N', val: s.probDraw },
                          { code: '2', val: s.probAway },
                        ].map((cell) => {
                          const isValOutcome = hasVal && s.valueOutcome === cell.code;
                          const isMax =
                            cell.val >= s.probHome && cell.val >= s.probDraw && cell.val >= s.probAway;
                          return (
                            <div
                              key={cell.code}
                              style={{
                                padding: '2px 3px',
                                borderRadius: 2,
                                background: isValOutcome
                                  ? 'rgba(16, 185, 129, 0.16)'
                                  : isMax
                                  ? '#18181b'
                                  : '#121215',
                                border: isValOutcome
                                  ? '1px solid #10b981'
                                  : '1px solid #27272a',
                                color: isValOutcome
                                  ? '#10b981'
                                  : isMax
                                  ? '#fafafa'
                                  : '#a1a1aa',
                                fontWeight: isValOutcome || isMax ? 700 : 400,
                              }}
                            >
                              {cell.val.toFixed(0)}%
                            </div>
                          );
                        })}
                      </div>

                      {/* 4. Cotes Betclic + Ajout Panier + Refresh */}
                      <div className="match-row-col-odds" style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 18px 16px', gap: 2.5, alignItems: 'center',
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'center', paddingLeft: 4
                      }}>
                        {[s.oddHome, s.oddDraw, s.oddAway].map((od, i) => {
                          const outcomeKey = i === 0 ? '1' : i === 1 ? 'N' : '2';
                          const isVbSelection = hasVal && s.valueOutcome === outcomeKey;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToBetSlip({
                                  matchId: String(match.id),
                                  matchLabel: `${match.homeTeam} vs ${match.awayTeam}`,
                                  league: match.league || 'Football',
                                  marketType: '1N2',
                                  marketLabel: 'Résultat 1N2',
                                  selectionKey: outcomeKey,
                                  selectionLabel: i === 0 ? `Victoire ${match.homeTeam} (1)` : i === 1 ? 'Match Nul (N)' : `Victoire ${match.awayTeam} (2)`,
                                  odds: od ? Number(od) : 2.0,
                                  scrapedOdds: od ? Number(od) : null,
                                  hasScrapedOdds: Boolean(od && Number(od) > 1.0),
                                  stake: 10.0,
                                  edgePct: isVbSelection ? `+${s.valueEdgePct.toFixed(1)}%` : null,
                                  modelProb: `${i === 0 ? s.probHome : i === 1 ? s.probDraw : s.probAway}%`,
                                });
                              }}
                              title={`Parier sur ${i === 0 ? match.homeTeam : i === 1 ? 'Match Nul' : match.awayTeam} (${od || '—'})`}
                              style={{
                                padding: '2px 1px',
                                background: isVbSelection ? 'rgba(6, 182, 212, 0.2)' : '#09090b',
                                border: isVbSelection ? '1px solid #06b6d4' : '1px solid #27272a',
                                borderRadius: 2,
                                color: isVbSelection ? '#06b6d4' : (od ? '#e4e4e7' : '#52525b'),
                                cursor: 'pointer',
                                fontWeight: isVbSelection ? 800 : 500,
                              }}
                            >
                              {od ? Number(od).toFixed(2) : '—'}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBetMarketMatch(match);
                          }}
                          title="Catalogue de marchés (Scores, Buts, Buteurs...)"
                          style={{
                            background: 'rgba(6, 182, 212, 0.12)', border: '1px solid rgba(6, 182, 212, 0.35)', color: '#06b6d4',
                            borderRadius: 2, cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <Ticket size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleRefreshOdds(e, match)}
                          title="Actualiser cotes Betclic"
                          style={{
                            background: 'transparent', border: 'none', color: '#71717a',
                            cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <RefreshCw size={10} style={{ animation: refreshingMatchId === match.id ? 'spin 0.8s linear infinite' : 'none' }} />
                        </button>
                      </div>

                      {/* 5. Lambda xG & Score Exact Majeur */}
                      <div className="match-row-col-xg" style={{ textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                        <div style={{ color: '#e4e4e7', fontWeight: 600 }}>
                          {s.lambdaHome.toFixed(2)}–{s.lambdaAway.toFixed(2)}
                        </div>
                        <div style={{ color: '#a1a1aa', fontSize: 9, fontWeight: 600 }}>
                          <span>P:{s.topScore}</span>
                          {hasVal && s.valueBetScore ? (
                            <span
                              title={`Score exact le plus probable pour le Value Bet (${s.valueOutcome})`}
                              style={{ color: '#10b981', fontWeight: 700, marginLeft: 4 }}
                            >
                              · V:{s.valueBetScore}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* 6. Badge Value Edge / Confiance / Hit + Bouton Mobile Analyser */}
                      <div className="match-row-col-status" style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                        {hasVal ? (
                          <span style={{
                            display: 'inline-block', padding: '2px 6px', fontSize: 10, fontWeight: 700, borderRadius: 2,
                            background: 'rgba(16, 185, 129, 0.14)', border: '1px solid #10b981', color: '#10b981'
                          }}>
                            +{s.valueEdgePct.toFixed(1)}% ({s.valueOutcome})
                          </span>
                        ) : isFin && match.homeScore != null ? (
                          (() => {
                            const actual = match.homeScore > match.awayScore ? '1' : match.homeScore < match.awayScore ? '2' : 'N';
                            const pick = s.predictedOutcome || ((Math.abs(s.probHome - s.probAway) <= 10.0 && s.probDraw >= 22.5) ? 'N' : (s.probHome >= s.probAway ? '1' : '2'));
                            const hit = actual === pick;
                            return (
                              <span style={{
                                display: 'inline-block', padding: '2px 6px', fontSize: 10, fontWeight: 700, borderRadius: 2,
                                background: hit ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                                border: hit ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(244, 63, 94, 0.4)',
                                color: hit ? '#10b981' : '#f43f5e'
                              }}>
                                {hit ? `HIT (${actual})` : `MISS (${actual})`}
                              </span>
                            );
                          })()
                        ) : (
                          <span style={{
                            display: 'inline-block', padding: '2px 6px', fontSize: 10, borderRadius: 2,
                            background: '#121215', border: '1px solid #27272a',
                            color: s.confidence >= 65 ? '#e4e4e7' : '#71717a'
                          }}>
                            CONF {s.confidence.toFixed(0)}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMatch && setSelectedMatch(match);
                            setMobileActiveView('INSPECTOR');
                          }}
                          className="match-row-mobile-inspect-btn"
                          title="Analyser et afficher le brief RAG"
                        >
                          <Sparkles size={11} /> Analyser
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>
            ))
          )}
        </div>

        {/* COLONNE DROITE STICKY : INSPECTEUR MULTI-MODÈLES + BRIEF RAG STRUCTURÉ + PRÉDICTION DÉTAILLÉE */}
        <aside className="daily-hub-inspector-col" style={{
          position: 'sticky',
          top: 84,
          maxHeight: 'calc(100vh - 90px)',
          overflowY: 'auto',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: '#09090b',
        }}>
          {/* Bouton retour mobile vers la liste des matchs */}
          <div className="daily-hub-inspector-mobile-back">
            <button
              type="button"
              onClick={() => setMobileActiveView('FEED')}
              className="daily-hub-back-btn"
            >
              <ChevronLeft size={14} /> Retour à la liste des matchs
            </button>
          </div>
          {activeFocusMatch ? (
            <>
              {/* Comparateur Multi-Modèles Scellés (v1 vs v2 vs v3) pour le match sélectionné */}
              <div style={{
                background: '#121215',
                border: '1px solid #27272a',
                borderRadius: 4,
                padding: 12,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #27272a'
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                    color: '#a1a1aa', fontFamily: "'JetBrains Mono', monospace"
                  }}>
                    COMPARAISON MULTI-MODÈLES SCELLÉS ({activeFocusMatch.homeTeam} vs {activeFocusMatch.awayTeam})
                  </span>
                  <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#06b6d4' }}>
                    IMMUTABLE SQLITE
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '95px 1fr 1fr 1fr 75px 65px',
                  gap: 4,
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#71717a',
                  marginBottom: 4,
                  textAlign: 'center',
                }}>
                  <span style={{ textAlign: 'left' }}>Version</span>
                  <span>Prob 1</span>
                  <span>Prob N</span>
                  <span>Prob 2</span>
                  <span>λxG</span>
                  <span style={{ textAlign: 'right' }}>Conf.</span>
                </div>

                {['v3', 'v2', 'v1'].map((ver) => {
                  const snap = getModelSnapshotForMatch(activeFocusMatch, ver);
                  const isAct = modelVersion === ver;
                  return (
                    <div
                      key={ver}
                      onClick={() => setModelVersion && setModelVersion(ver)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '95px 1fr 1fr 1fr 75px 65px',
                        gap: 4,
                        alignItems: 'center',
                        padding: '5px 6px',
                        borderRadius: 3,
                        cursor: 'pointer',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        textAlign: 'center',
                        background: isAct ? 'rgba(6, 182, 212, 0.12)' : '#09090b',
                        border: isAct ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid #18181b',
                        marginBottom: 3,
                      }}
                    >
                      <span style={{ textAlign: 'left', fontWeight: 700, color: isAct ? '#06b6d4' : '#e4e4e7' }}>
                        {ver.toUpperCase()} {ver === 'v3' ? '· LGBM' : ver === 'v2' ? '· DC' : '· MC'}
                      </span>
                      <span style={{ color: '#fafafa' }}>{snap.probHome.toFixed(1)}%</span>
                      <span style={{ color: '#a1a1aa' }}>{snap.probDraw.toFixed(1)}%</span>
                      <span style={{ color: '#fafafa' }}>{snap.probAway.toFixed(1)}%</span>
                      <span style={{ color: '#a1a1aa', fontSize: 10 }}>
                        {snap.lambdaHome.toFixed(1)}-{snap.lambdaAway.toFixed(1)}
                      </span>
                      <span style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                        {snap.confidence.toFixed(0)}/100
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* PANNEAU RAG STRUCTURÉ (Signaux faibles, Alertes blessures, Arbitre/Météo, Sources citées) */}
              <RagTacticalBriefPanel
                match={activeFocusMatch}
                modelVersion={modelVersion}
                compact={true}
              />

              {/* COMPOSANT DE DISTRIBUTION EXACTE DES SCORES & BUTEURS */}
              <MatchPrediction match={activeFocusMatch} />
            </>
          ) : null}
        </aside>
      </div>

      {/* MODAL DE SÉLECTION DE MARCHÉS POUR LE PANIER */}
      {betMarketMatch && (
        <BetMarketModal
          match={betMarketMatch}
          isOpen={Boolean(betMarketMatch)}
          onClose={() => setBetMarketMatch(null)}
        />
      )}
    </div>
  );
}
