import React, { useState, useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import {
  Activity,
  Award,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Trophy,
  Target,
  BarChart3,
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp,
  Percent,
  Zap,
  Database,
  Sparkles,
  HelpCircle,
  FileText,
  Check
} from 'lucide-react';
import TeamLogo from './ui/TeamLogo';
import { evaluateMatchPrediction } from '../utils/matchPredictionEvaluator';
import { fetchHistoryMatches } from '../services/historyService';

// Rapport officiel certifié de l'entraînement et backtest ML (models/training_evaluation_report.json)
const DEFAULT_BACKTEST_REPORT = {
  timestamp: "2026-08-29 10:21:56",
  dataset_matches_count: 4615,
  train_matches: 2769,
  test_matches: 1846,
  features_count: 54,
  metrics_1n2: {
    dixon_coles_log_loss: 1.0138,
    hybrid_v3_log_loss: 1.0223,
    dixon_coles_brier_score: 0.6064,
    hybrid_v3_brier_score: 0.6101,
    dixon_coles_rps: 0.2127,
    hybrid_v3_rps: 0.2131
  },
  metrics_goals: {
    rmse_home_goals: 1.228,
    rmse_away_goals: 1.107,
    mae_total_goals: 1.323,
    over25_roc_auc: 0.5671,
    over25_log_loss: 0.6968
  },
  value_betting_simulation: {
    total_bets: 1858,
    win_rate_pct: 41.4,
    starting_bankroll: 1000.0,
    final_bankroll: 7665.28,
    roi_percentage: "+3.96%"
  },
  top_predictive_features: [
    { rank: 1, feature: "feat_dc_prob_home", mean_shap_importance: 0.1376 },
    { rank: 2, feature: "feat_dc_prob_away", mean_shap_importance: 0.1360 },
    { rank: 3, feature: "feat_dc_home_xg", mean_shap_importance: 0.0643 },
    { rank: 4, feature: "feat_rolling_def_solid_h", mean_shap_importance: 0.0573 },
    { rank: 5, feature: "feat_dc_away_xg", mean_shap_importance: 0.0461 },
    { rank: 6, feature: "feat_rolling_off_eff_h", mean_shap_importance: 0.0449 },
    { rank: 7, feature: "feat_rolling_pts_delta", mean_shap_importance: 0.0416 },
    { rank: 8, feature: "feat_a_rolling_xg_against", mean_shap_importance: 0.0413 },
    { rank: 9, feature: "feat_dc_prob_draw", mean_shap_importance: 0.0404 },
    { rank: 10, feature: "feat_ref_severity_index", mean_shap_importance: 0.0383 }
  ]
};

const SHAP_FEATURE_LABELS = {
  feat_dc_prob_home: 'Probabilité Dixon-Coles Domicile',
  feat_dc_prob_away: 'Probabilité Dixon-Coles Extérieur',
  feat_dc_home_xg: 'xG Projeté Domicile (Dixon-Coles)',
  feat_rolling_def_solid_h: 'Solidité Défensive Roulante Domicile',
  feat_dc_away_xg: 'xG Projeté Extérieur (Dixon-Coles)',
  feat_rolling_off_eff_h: 'Efficacité Offensive Roulante Domicile',
  feat_rolling_pts_delta: 'Différentiel Points / Dynamique',
  feat_a_rolling_xg_against: 'xG Concédés Roulants Extérieur',
  feat_dc_prob_draw: 'Probabilité Dixon-Coles Nul',
  feat_ref_severity_index: 'Sévérité Arbitre (Cartons/Fautes)'
};

// Définition ordonnée des compétitions supportées
const SUPPORTED_COMPETITIONS = [
  { code: 'ALL', name: 'Toutes les compétitions', flag: '🌍' },
  { code: 'FRA-L1', name: 'Ligue 1', flag: '🇫🇷', maxJournees: 34 },
  { code: 'ENG-PL', name: 'Premier League', flag: '🇬🇧', maxJournees: 38 },
  { code: 'ESP-LL', name: 'La Liga', flag: '🇪🇸', maxJournees: 38 },
  { code: 'ITA-SA', name: 'Serie A', flag: '🇮🇹', maxJournees: 38 },
  { code: 'GER-BL', name: 'Bundesliga', flag: '🇩🇪', maxJournees: 34 },
  { code: 'EUR-CL', name: 'Champions League', flag: '🏆', maxJournees: 8 },
  { code: 'EUR-EL', name: 'Europa League', flag: '🥈', maxJournees: 8 },
  { code: 'EUR-ECL', name: 'Conference League', flag: '🥉', maxJournees: 6 },
];

const parseRoundNumber = (val) => {
  if (!val || val === 'ALL') return null;
  if (typeof val === 'number') return val;
  const match = String(val).match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
};


// Composant d'affichage de la validation scientifique et du benchmark officiel (2024-2026)
function BacktestBenchmarkView({ report, selectedSeason, onSwitchToLive }) {
  const r = report || DEFAULT_BACKTEST_REPORT;
  const metrics1n2 = r.metrics_1n2 || {};
  const metricsGoals = r.metrics_goals || {};
  const vb = r.value_betting_simulation || {};
  const topFeatures = r.top_predictive_features || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Explication d'Intégrité Scientifique & Anti-Contradiction */}
      <div style={{
        background: 'rgba(212,175,55,0.06)',
        border: '1px solid var(--gold-border)',
        borderRadius: 16,
        padding: '18px 22px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
      }}>
        <ShieldCheck size={26} color="var(--gold)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Validation Scientifique & Benchmark Out-of-Sample {selectedSeason !== '2026-2027' ? `(Archives Saison ${selectedSeason})` : '(2024-2026)'}
          </div>
          <p style={{ fontSize: 12, color: 'var(--ivory)', lineHeight: 1.6, margin: '8px 0 0 0' }}>
            Conformément aux principes de rigueur quantitative de <strong>Predictor Ultimate</strong>, les archives historiques (2024-2026) ne contenaient pas de cotes pré-match officielles enregistrées en direct. Pour proscrire toute contradiction statistique ou hallucination post-hoc, <strong>aucun résultat match par match rétroactif n'est simulé sur les archives</strong>. Le modèle quantitatif (LightGBM 54 features + Dixon-Coles calibré) a été évalué selon un protocole strict de test hors-échantillon certifié sur <strong>{r.test_matches || 1846} rencontres indépendantes</strong>.
          </p>
          {onSwitchToLive && (
            <button
              onClick={onSwitchToLive}
              style={{
                marginTop: 12,
                background: 'var(--gold)',
                color: '#000',
                border: 'none',
                borderRadius: 8,
                padding: '7px 16px',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Activity size={14} />
              Consulter l'audit live des 215 matchs réels (Saison 2026-2027)
            </button>
          )}
        </div>
      </div>

      {/* 4 Hero KPI Cards du Benchmark */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {/* Card 1: Brier Score */}
        <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 16, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--neutral)' }}>
              Précision Probabiliste (Brier Score)
            </span>
            <Award size={18} color="var(--gold)" />
          </div>
          <div style={{ fontSize: 26, fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--gold)', lineHeight: 1.2 }}>
            {metrics1n2.dixon_coles_brier_score || '0.6064'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 4 }}>
            Log Loss: {metrics1n2.dixon_coles_log_loss || '1.0138'} · RPS: {metrics1n2.dixon_coles_rps || '0.2127'}
          </div>
          <div style={{ marginTop: 12, fontSize: 9, fontWeight: 700, color: 'var(--ivory-dim)', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--ivory-border)', alignSelf: 'flex-start', display: 'inline-block' }}>
            Calibration Dixon-Coles
          </div>
        </div>

        {/* Card 2: Test Dataset */}
        <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 16, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--neutral)' }}>
              Volume Test Hors-Échantillon
            </span>
            <Database size={18} color="#38bdf8" />
          </div>
          <div style={{ fontSize: 26, fontFamily: 'var(--font-serif)', fontWeight: 700, color: '#38bdf8', lineHeight: 1.2 }}>
            {r.test_matches || 1846} Matchs
          </div>
          <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 4 }}>
            sur {r.dataset_matches_count || 4615} matchs · {r.features_count || 54} variables
          </div>
          <div style={{ marginTop: 12, fontSize: 9, fontWeight: 700, color: 'var(--ivory-dim)', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--ivory-border)', alignSelf: 'flex-start', display: 'inline-block' }}>
            Split Temporel Out-of-Sample
          </div>
        </div>

        {/* Card 3: Value Betting ROI */}
        <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 16, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--neutral)' }}>
              Simulation Value Bet (ROI Net)
            </span>
            <TrendingUp size={18} color="#4ade80" />
          </div>
          <div style={{ fontSize: 26, fontFamily: 'var(--font-serif)', fontWeight: 700, color: '#4ade80', lineHeight: 1.2 }}>
            {vb.roi_percentage || '+3.96%'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 4 }}>
            {vb.total_bets || 1858} paris simulés · {vb.win_rate_pct || 41.4}% de réussite
          </div>
          <div style={{ marginTop: 12, fontSize: 9, fontWeight: 700, color: 'var(--ivory-dim)', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--ivory-border)', alignSelf: 'flex-start', display: 'inline-block' }}>
            Seuil Edge ≥ +2.5%
          </div>
        </div>

        {/* Card 4: Bankroll Growth */}
        <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 16, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--neutral)' }}>
              Trajectoire Capital (Kelly Fraction)
            </span>
            <Trophy size={18} color="var(--gold)" />
          </div>
          <div style={{ fontSize: 26, fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--gold)', lineHeight: 1.2 }}>
            {vb.final_bankroll || '7 665.28'} €
          </div>
          <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 4 }}>
            Départ {vb.starting_bankroll || 1000} € ➔ Profit Net +666.5%
          </div>
          <div style={{ marginTop: 12, fontSize: 9, fontWeight: 700, color: 'var(--ivory-dim)', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--ivory-border)', alignSelf: 'flex-start', display: 'inline-block' }}>
            Gestion du Risque Certifiée
          </div>
        </div>
      </div>

      {/* Grid: Buts Metrics & Top SHAP Features */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        {/* Left: Précision des Buts */}
        <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 18, padding: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gold)', marginBottom: 4 }}>
            Calibration des Buts & Marchés Totaux
          </div>
          <div style={{ fontSize: 11, color: 'var(--neutral)', marginBottom: 18 }}>
            Métriques d'erreur quadratique et calibration probabiliste Poisson bivarié
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'RMSE Buts Domicile (Erreur quadratique)', value: metricsGoals.rmse_home_goals || 1.228, target: '< 1.30' },
              { label: 'RMSE Buts Extérieur', value: metricsGoals.rmse_away_goals || 1.107, target: '< 1.25' },
              { label: 'MAE Total Buts (Erreur absolue)', value: metricsGoals.mae_total_goals || 1.323, target: '< 1.40' },
              { label: 'ROC-AUC Over / Under 2.5 Buts', value: metricsGoals.over25_roc_auc || 0.5671, target: 'Discriminant' },
              { label: 'Log Loss Over / Under 2.5 Buts', value: metricsGoals.over25_log_loss || 0.6968, target: 'Calibré' },
            ].map((row, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 11, color: 'var(--ivory)' }}>{row.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--gold)', fontFamily: 'monospace' }}>{row.value}</span>
                  <span style={{ fontSize: 9, color: 'var(--neutral)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>{row.target}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Top SHAP Variables */}
        <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 18, padding: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gold)', marginBottom: 4 }}>
            Top 10 Variables Prédictives Majeures (SHAP)
          </div>
          <div style={{ fontSize: 11, color: 'var(--neutral)', marginBottom: 18 }}>
            Poids d'impact direct dans l'arborescence LightGBM (Mean |SHAP Value|)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topFeatures.map((f, idx) => {
              const label = SHAP_FEATURE_LABELS[f.feature] || f.feature;
              const val = parseFloat(f.mean_shap_importance) || 0;
              const pctWidth = Math.min(100, Math.round((val / 0.14) * 100));

              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--ivory)' }}>
                      <strong style={{ color: 'var(--gold)', marginRight: 6 }}>#{f.rank || idx + 1}</strong>
                      {label}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--gold)' }}>
                      {(val * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${pctWidth}%`, height: '100%', background: 'linear-gradient(90deg, #d4af37, #4ade80)', borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BankrollTracking({ APP_DATA }) {
  const [selectedSeason, setSelectedSeason] = useState('2026-2027');
  const [activeViewMode, setActiveViewMode] = useState('LIVE'); // 'LIVE' | 'BACKTEST'
  const [backtestReport, setBacktestReport] = useState(DEFAULT_BACKTEST_REPORT);
  const [showValueBetsQueue, setShowValueBetsQueue] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState('ALL');
  const [selectedRound, setSelectedRound] = useState('ALL');
  const [selectedClub, setSelectedClub] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'CORRECT' | 'INCORRECT' | 'EXACT_SCORE'
  const [searchTerm, setSearchTerm] = useState('');
  const [activeChartTab, setActiveChartTab] = useState('MATCHDAY'); // 'MATCHDAY' | 'LEAGUE' | 'CLUB'
  const [historyMatches, setHistoryMatches] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Charger dynamiquement le rapport d'entraînement ML certifié
  useEffect(() => {
    let isMounted = true;
    fetch('/data/model_backtest_report.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) setBacktestReport(data);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSeasonChange = (newSeason) => {
    setSelectedSeason(newSeason);
    if (newSeason === '2026-2027') {
      setActiveViewMode('LIVE');
    } else {
      setActiveViewMode('BACKTEST');
    }
  };

  // Liste des Value Bets actifs détectés dans le calendrier pour surveillance financière
  const activeValueBets = useMemo(() => {
    const list = [];
    (APP_DATA?.fullSchedule || []).forEach((m) => {
      if (m.valueBets && m.valueBets.length > 0) {
        m.valueBets.forEach((vb) => {
          list.push({
            ...vb,
            matchId: m.id,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            league: m.league,
            round: m.round,
            date: m.date || m.matchDate,
            status: m.status || 'SCHEDULED'
          });
        });
      }
    });
    return list;
  }, [APP_DATA]);

  // Charger dynamiquement les données historiques de la compétition et saison sélectionnées
  useEffect(() => {
    let isMounted = true;
    setIsLoadingHistory(true);
    fetchHistoryMatches(selectedSeason, selectedLeague)
      .then((data) => {
        if (isMounted) {
          setHistoryMatches(data || []);
          setIsLoadingHistory(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setHistoryMatches([]);
          setIsLoadingHistory(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSeason, selectedLeague]);

  // Fusionner et évaluer les matchs terminés (fullSchedule + historyMatches)
  const evaluatedMatches = useMemo(() => {
    const list = [];
    const map = new Map();

    const getMatchKey = (m) => {
      const season = m.season || selectedSeason || '2026-2027';
      const league = m.league || 'FRA-L1';
      const roundNum = parseRoundNumber(m.round || m.week) || 1;
      const home = (m.homeTeam || m.home || '').trim().toLowerCase();
      const away = (m.awayTeam || m.away || '').trim().toLowerCase();
      return `${season}_${league}_${roundNum}_${home}_${away}`;
    };

    // 1. Matchs d'archives chargés dynamiquement (données de résultat certifiées)
    (historyMatches || []).forEach((m) => {
      if (!m) return;
      const key = m.id || getMatchKey(m);
      map.set(key, {
        ...m,
        season: m.season || selectedSeason,
        round: m.round || (typeof m.week === 'number' ? `Journée ${m.week}` : 'Journée 1'),
        status: m.status || 'FINISHED',
      });
    });

    // 2. Calendrier en direct APP_DATA (contient les probabilités et prédictions IA pré-match)
    (APP_DATA?.fullSchedule || []).forEach((m) => {
      if (!m) return;
      const key = m.id || getMatchKey(m);
      const existing = map.get(key);

      if (existing) {
        const isFin = m.status === 'FINISHED' || existing.status === 'FINISHED';
        const isLive = !isFin && (m.status === 'LIVE' || existing.status === 'LIVE');
        const resolvedStatus = isFin ? 'FINISHED' : (isLive ? 'LIVE' : 'SCHEDULED');

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
          score: resolvedScore,
          homeScore: (m.homeScore !== undefined && m.homeScore !== null) ? m.homeScore : existing.homeScore,
          awayScore: (m.awayScore !== undefined && m.awayScore !== null) ? m.awayScore : existing.awayScore,
          status: resolvedStatus,
          // Conserver impérativement les prédictions et probabilités pré-match authentiques
          probabilities: m.probabilities || existing.probabilities,
          prediction: m.prediction || existing.prediction,
          topExactScores: (m.topExactScores && m.topExactScores.length > 0) ? m.topExactScores : existing.topExactScores,
          betclicOdds: m.betclicOdds || existing.betclicOdds,
          valueBets: (m.valueBets && m.valueBets.length > 0) ? m.valueBets : (existing.valueBets || []),
          // Conserver les détails historiques d'événements
          goals: (existing.goals && existing.goals.length > 0) ? existing.goals : (m.goals || []),
          cards: (existing.cards && existing.cards.length > 0) ? existing.cards : (m.cards || []),
          referee: existing.referee || m.referee,
        });
      } else if (!m.season || m.season === selectedSeason) {
        map.set(key, {
          ...m,
          season: m.season || selectedSeason,
        });
      }
    });

    map.forEach((m) => {
      const evaluation = evaluateMatchPrediction(m);
      if (evaluation && evaluation.isFinished && evaluation.isCorrect !== null) {
        const roundNum = parseRoundNumber(m.round || m.week) || 1;
        list.push({
          match: {
            ...m,
            season: m.season || selectedSeason,
            league: m.league || 'FRA-L1',
            roundDisplay: m.round || (typeof m.week === 'number' ? `Journée ${m.week}` : `Journée ${roundNum}`),
            roundNumber: roundNum,
          },
          evaluation,
        });
      }
    });

    return list;
  }, [historyMatches, APP_DATA, selectedSeason]);

  // Liste des journées disponibles issues des matchs réels de la ligue sélectionnée
  const availableRounds = useMemo(() => {
    const roundsSet = new Set();
    evaluatedMatches.forEach(({ match }) => {
      if (selectedLeague === 'ALL' || match.league === selectedLeague) {
        if (match.roundDisplay) {
          roundsSet.add(match.roundDisplay);
        }
      }
    });

    const arr = Array.from(roundsSet);
    // Tri naturel : Journée 1, Journée 2 ...
    return arr.sort((a, b) => {
      const numA = parseRoundNumber(a) || 999;
      const numB = parseRoundNumber(b) || 999;
      return numA - numB;
    });
  }, [evaluatedMatches, selectedLeague]);

  // Liste des clubs disponibles pour le filtre club
  const availableClubs = useMemo(() => {
    const clubsSet = new Set();
    evaluatedMatches.forEach(({ match }) => {
      if (selectedLeague === 'ALL' || match.league === selectedLeague) {
        if (match.homeTeam) clubsSet.add(match.homeTeam);
        if (match.awayTeam) clubsSet.add(match.awayTeam);
      }
    });
    return Array.from(clubsSet).sort((a, b) => a.localeCompare(b));
  }, [evaluatedMatches, selectedLeague]);

  // Réinitialiser la journée ou le club si inexistant dans la nouvelle sélection
  useEffect(() => {
    if (selectedRound !== 'ALL' && !availableRounds.includes(selectedRound)) {
      setSelectedRound('ALL');
    }
  }, [availableRounds, selectedRound]);

  useEffect(() => {
    if (selectedClub !== 'ALL' && !availableClubs.includes(selectedClub)) {
      setSelectedClub('ALL');
    }
  }, [availableClubs, selectedClub]);

  // Filtrage fin des matchs
  const filteredMatches = useMemo(() => {
    return evaluatedMatches.filter(({ match, evaluation }) => {
      // Championnat
      if (selectedLeague !== 'ALL' && match.league !== selectedLeague) return false;

      // Journée
      if (selectedRound !== 'ALL' && match.roundDisplay !== selectedRound) return false;

      // Club
      if (selectedClub !== 'ALL' && match.homeTeam !== selectedClub && match.awayTeam !== selectedClub) return false;

      // Statut de prédiction
      if (filterType === 'CORRECT' && !evaluation.isCorrect) return false;
      if (filterType === 'INCORRECT' && evaluation.isCorrect) return false;
      if (filterType === 'EXACT_SCORE' && !evaluation.isExactScoreCorrect) return false;

      // Recherche textuelle
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const homeMatch = (match.homeTeam || '').toLowerCase().includes(q);
        const awayMatch = (match.awayTeam || '').toLowerCase().includes(q);
        const leagueMatch = (match.league || '').toLowerCase().includes(q);
        const roundMatch = (match.roundDisplay || '').toLowerCase().includes(q);
        if (!homeMatch && !awayMatch && !leagueMatch && !roundMatch) return false;
      }

      return true;
    });
  }, [evaluatedMatches, selectedLeague, selectedRound, selectedClub, filterType, searchTerm]);

  // Métriques KPI globales de viabilité
  const metrics = useMemo(() => {
    const total = filteredMatches.length;
    if (total === 0) {
      return {
        total: 0,
        correct: 0,
        hitRatePct: '0.0%',
        hitRateNum: 0,
        exactScoreHits: 0,
        exactScorePct: '0.0%',
        homeWinCorrect: 0,
        drawCorrect: 0,
        awayWinCorrect: 0,
        highConfHits: 0,
        highConfTotal: 0,
        highConfHitRate: '0.0%',
      };
    }

    let correct = 0;
    let exactScoreHits = 0;
    let homeWinCorrect = 0;
    let drawCorrect = 0;
    let awayWinCorrect = 0;
    let highConfHits = 0;
    let highConfTotal = 0;

    filteredMatches.forEach(({ evaluation }) => {
      if (evaluation.isCorrect) {
        correct++;
        if (evaluation.predictedOutcome === '1') homeWinCorrect++;
        if (evaluation.predictedOutcome === 'N') drawCorrect++;
        if (evaluation.predictedOutcome === '2') awayWinCorrect++;
      }
      if (evaluation.isExactScoreCorrect) exactScoreHits++;

      const probNum = parseInt(evaluation.predictedProb, 10);
      if (probNum >= 55) {
        highConfTotal++;
        if (evaluation.isCorrect) highConfHits++;
      }
    });

    const hitRateNum = ((correct / total) * 100);
    const hitRatePct = hitRateNum.toFixed(1) + '%';
    const exactScorePct = ((exactScoreHits / total) * 100).toFixed(1) + '%';
    const highConfHitRate = highConfTotal > 0 ? ((highConfHits / highConfTotal) * 100).toFixed(1) + '%' : '0.0%';

    return {
      total,
      correct,
      hitRatePct,
      hitRateNum,
      exactScoreHits,
      exactScorePct,
      homeWinCorrect,
      drawCorrect,
      awayWinCorrect,
      highConfHits,
      highConfTotal,
      highConfHitRate,
    };
  }, [filteredMatches]);

  // 1. Données Graphique : Taux de réussite (%) par Journée
  const matchdayChartData = useMemo(() => {
    const roundsMap = new Map();

    // On calcule sur l'ensemble des matchs de la compétition (sans le filtre journée restrictive)
    const baseMatches = evaluatedMatches.filter(({ match }) => {
      if (selectedLeague !== 'ALL' && match.league !== selectedLeague) return false;
      if (selectedClub !== 'ALL' && match.homeTeam !== selectedClub && match.awayTeam !== selectedClub) return false;
      return true;
    });

    baseMatches.forEach(({ match, evaluation }) => {
      const rd = match.roundDisplay || `J${match.roundNumber}`;
      if (!roundsMap.has(rd)) {
        roundsMap.set(rd, { round: rd, roundNumber: match.roundNumber, total: 0, correct: 0, exact: 0 });
      }
      const entry = roundsMap.get(rd);
      entry.total++;
      if (evaluation.isCorrect) entry.correct++;
      if (evaluation.isExactScoreCorrect) entry.exact++;
    });

    const list = Array.from(roundsMap.values()).map((item) => {
      const pct = item.total > 0 ? parseFloat(((item.correct / item.total) * 100).toFixed(1)) : 0;
      const exactPct = item.total > 0 ? parseFloat(((item.exact / item.total) * 100).toFixed(1)) : 0;
      return {
        ...item,
        accuracy: pct,
        exactAccuracy: exactPct,
        shortLabel: item.round.replace('Journée ', 'J'),
      };
    });

    return list.sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0));
  }, [evaluatedMatches, selectedLeague, selectedClub]);

  // 2. Données Graphique : Taux de réussite (%) par Championnat
  const leagueChartData = useMemo(() => {
    const leaguesMap = {
      'FRA-L1': { league: 'Ligue 1', flag: '🇫🇷', total: 0, correct: 0, exact: 0 },
      'ENG-PL': { league: 'Premier League', flag: '🇬🇧', total: 0, correct: 0, exact: 0 },
      'ESP-LL': { league: 'La Liga', flag: '🇪🇸', total: 0, correct: 0, exact: 0 },
      'ITA-SA': { league: 'Serie A', flag: '🇮🇹', total: 0, correct: 0, exact: 0 },
      'GER-BL': { league: 'Bundesliga', flag: '🇩🇪', total: 0, correct: 0, exact: 0 },
      'EUR-CL': { league: 'Champions League', flag: '🏆', total: 0, correct: 0, exact: 0 },
      'EUR-EL': { league: 'Europa League', flag: '🥈', total: 0, correct: 0, exact: 0 },
      'EUR-ECL': { league: 'Conference League', flag: '🥉', total: 0, correct: 0, exact: 0 },
    };

    evaluatedMatches.forEach(({ match, evaluation }) => {
      if (leaguesMap[match.league]) {
        leaguesMap[match.league].total++;
        if (evaluation.isCorrect) leaguesMap[match.league].correct++;
        if (evaluation.isExactScoreCorrect) leaguesMap[match.league].exact++;
      }
    });

    return Object.entries(leaguesMap)
      .map(([code, data]) => {
        const accuracy = data.total > 0 ? parseFloat(((data.correct / data.total) * 100).toFixed(1)) : 0;
        return {
          code,
          name: `${data.flag} ${data.league}`,
          accuracy,
          total: data.total,
          correct: data.correct,
        };
      })
      .filter((d) => d.total > 0);
  }, [evaluatedMatches]);

  // 3. Données Graphique : Taux de réussite (%) par Club
  const clubChartData = useMemo(() => {
    const clubsMap = new Map();

    const baseMatches = evaluatedMatches.filter(({ match }) => {
      if (selectedLeague !== 'ALL' && match.league !== selectedLeague) return false;
      if (selectedRound !== 'ALL' && match.roundDisplay !== selectedRound) return false;
      return true;
    });

    baseMatches.forEach(({ match, evaluation }) => {
      [match.homeTeam, match.awayTeam].forEach((club) => {
        if (!club) return;
        if (!clubsMap.has(club)) {
          clubsMap.set(club, { club, total: 0, correct: 0 });
        }
        const entry = clubsMap.get(club);
        entry.total++;
        if (evaluation.isCorrect) entry.correct++;
      });
    });

    const list = Array.from(clubsMap.values())
      .filter((c) => c.total >= 3) // Minimum 3 matchs audités pour pertinence statistique
      .map((c) => ({
        ...c,
        accuracy: parseFloat(((c.correct / c.total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.accuracy - a.accuracy);

    // Si un club précis est sélectionné, on le met en valeur
    if (selectedClub !== 'ALL') {
      return list.filter((c) => c.club === selectedClub);
    }

    // Top 15 clubs audités
    return list.slice(0, 15);
  }, [evaluatedMatches, selectedLeague, selectedRound, selectedClub]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 60 }}>

      {/* ── HEADER TITLE & CONTEXT ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              background: 'rgba(212,175,55,0.15)',
              border: '1px solid var(--gold-border)',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 800,
              color: 'var(--gold)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              Module IA & Validation
            </span>
            {isLoadingHistory && (
              <span style={{ fontSize: 11, color: 'var(--neutral)', fontStyle: 'italic' }}>
                Chargement des archives...
              </span>
            )}
          </div>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '2.2rem',
            color: 'var(--ivory)',
            fontWeight: 400,
            margin: '8px 0 0 0',
            letterSpacing: '-0.02em',
          }}>
            Model Tracking & Viabilité des Prédictions
          </h1>
          <p style={{ fontSize: 13, color: 'var(--neutral)', marginTop: 6, maxWidth: 840 }}>
            Évaluation scientifique des prédictions de l'algorithme face aux scores réels. Analyse de la viabilité par championnat, par journée (J1 à J38 / Coupes d'Europe) et par club.
          </p>
        </div>

        {/* Sélecteur de Saison */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', padding: '6px 14px', borderRadius: 12 }}>
          <Calendar size={15} color="var(--gold)" />
          <span style={{ fontSize: 11, color: 'var(--neutral)', fontWeight: 600 }}>Saison :</span>
          <select
            value={selectedSeason}
            onChange={(e) => handleSeasonChange(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ivory)',
              fontSize: 12,
              fontWeight: 700,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="2026-2027" style={{ background: '#121212' }}>2026-2027 (En cours)</option>
            <option value="2025-2026" style={{ background: '#121212' }}>2025-2026</option>
            <option value="2024-2025" style={{ background: '#121212' }}>2024-2025</option>
          </select>
        </div>
      </div>

      
      {/* ── SÉLECTEUR DE MODE D'AUDIT : LIVE 2026-2027 vs BENCHMARK BACKTEST ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        background: 'var(--glass-primary)',
        border: '1px solid var(--ivory-border)',
        borderRadius: 14,
        padding: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setActiveViewMode('LIVE');
              setSelectedSeason('2026-2027');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: activeViewMode === 'LIVE' ? 'rgba(212,175,55,0.18)' : 'transparent',
              border: activeViewMode === 'LIVE' ? '1px solid var(--gold-border)' : '1px solid transparent',
              color: activeViewMode === 'LIVE' ? 'var(--gold)' : 'var(--neutral)',
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Zap size={15} color={activeViewMode === 'LIVE' ? 'var(--gold)' : 'var(--neutral)'} />
            <span>Suivi En Direct (2026-2027)</span>
            <span style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 99,
              background: activeViewMode === 'LIVE' ? 'var(--gold)' : 'rgba(255,255,255,0.06)',
              color: activeViewMode === 'LIVE' ? '#000' : 'var(--neutral)',
              fontWeight: 800,
            }}>
              {metrics.total} matchs audités
            </span>
          </button>

          <button
            onClick={() => setActiveViewMode('BACKTEST')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: activeViewMode === 'BACKTEST' ? 'rgba(56,189,248,0.18)' : 'transparent',
              border: activeViewMode === 'BACKTEST' ? '1px solid rgba(56,189,248,0.4)' : '1px solid transparent',
              color: activeViewMode === 'BACKTEST' ? '#38bdf8' : 'var(--neutral)',
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Database size={15} color={activeViewMode === 'BACKTEST' ? '#38bdf8' : 'var(--neutral)'} />
            <span>Benchmark Backtest & Validation (2024-2026)</span>
            <span style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 99,
              background: activeViewMode === 'BACKTEST' ? '#38bdf8' : 'rgba(255,255,255,0.06)',
              color: activeViewMode === 'BACKTEST' ? '#000' : 'var(--neutral)',
              fontWeight: 800,
            }}>
              1 846 tests · ROI +3.96%
            </span>
          </button>
        </div>

        {activeViewMode === 'LIVE' && activeValueBets.length > 0 && (
          <button
            onClick={() => setShowValueBetsQueue(!showValueBetsQueue)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: showValueBetsQueue ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${showValueBetsQueue ? 'rgba(74,222,128,0.4)' : 'var(--ivory-border)'}`,
              color: showValueBetsQueue ? '#4ade80' : 'var(--ivory)',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Sparkles size={13} color={showValueBetsQueue ? '#4ade80' : 'var(--gold)'} />
            <span>Surveillance Value Bets ({activeValueBets.length} signaux)</span>
          </button>
        )}
      </div>

      {/* ── AFFICHAGE SELON LE MODE SÉLECTIONNÉ ── */}
      {activeViewMode === 'BACKTEST' ? (
        <BacktestBenchmarkView
          report={backtestReport}
          selectedSeason={selectedSeason}
          onSwitchToLive={() => {
            setActiveViewMode('LIVE');
            setSelectedSeason('2026-2027');
          }}
        />
      ) : (
        <>
          {/* Section Dépliée : Surveillance des Value Bets Actifs */}
          {showValueBetsQueue && (
            <div style={{
              background: 'rgba(34,197,94,0.04)',
              border: '1px solid rgba(74,222,128,0.3)',
              borderRadius: 16,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🎯 Queue de Surveillance des Value Bets (Saison 2026-2027)
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 2 }}>
                    Opportunités mathématiques où la probabilité IA dépasse la cote implicite Betclic (Edge ≥ +2.5%)
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 700 }}>
                  {activeValueBets.length} opportunités détectées
                </div>
              </div>

              <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--ivory-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: 'var(--obsidian-3)', borderBottom: '1px solid var(--ivory-border)', color: 'var(--neutral)', fontSize: 10, textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 12px' }}>Compétition</th>
                      <th style={{ padding: '10px 12px' }}>Rencontre</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Sélection</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Cote Betclic</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Proba Modèle</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Edge Algo</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Mise Recommandée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeValueBets.slice(0, 10).map((vb, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--gold)', fontWeight: 700 }}>{vb.league}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--ivory)' }}>
                          {vb.homeTeam} vs {vb.awayTeam}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#4ade80', fontWeight: 700 }}>
                          {vb.selection_label || vb.side}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>
                          {vb.betclic_odd || vb.bookmaker_odds}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--gold)', fontWeight: 700 }}>
                          {vb.model_probability || vb.model_prob}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#4ade80', fontWeight: 800 }}>
                          {vb.edge_percentage || vb.edge}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--neutral)' }}>
                          {vb.stake_recommendation || 'Kelly'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

      {/* ── KPI METRICS CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {[
          {
            label: 'Taux Réussite 1N2 (Hit Rate)',
            value: metrics.hitRatePct,
            sub: `${metrics.correct} validés sur ${metrics.total} matchs`,
            icon: Award,
            color: metrics.hitRateNum >= 55 ? '#4ade80' : 'var(--gold)',
            badge: `${metrics.total} matchs audités`,
          },
          {
            label: 'Scores Exacts Prédits',
            value: metrics.exactScorePct,
            sub: `${metrics.exactScoreHits} scores exacts parfaits`,
            icon: Target,
            color: 'var(--gold)',
            badge: 'Précision chirurgicale',
          },
          {
            label: 'Prédictions Forte Confiance (>55%)',
            value: metrics.highConfHitRate,
            sub: `${metrics.highConfHits} / ${metrics.highConfTotal} validées`,
            icon: ShieldCheck,
            color: '#38bdf8',
            badge: 'Signaux prioritaires',
          },
          {
            label: 'Distribution Succès 1 / N / 2',
            value: `${metrics.homeWinCorrect} · ${metrics.drawCorrect} · ${metrics.awayWinCorrect}`,
            sub: 'Dom. / Nuls / Ext. réussis',
            icon: Layers,
            color: 'var(--ivory)',
            badge: 'Calibration issue',
          },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              style={{
                background: 'var(--glass-primary)',
                border: '1px solid var(--ivory-border)',
                borderRadius: 16,
                padding: 18,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--neutral)' }}>
                    {kpi.label}
                  </span>
                  <Icon size={18} color={kpi.color} />
                </div>
                <div style={{ fontSize: 26, fontFamily: 'var(--font-serif)', fontWeight: 700, color: kpi.color, lineHeight: 1.2 }}>
                  {kpi.value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 4 }}>
                  {kpi.sub}
                </div>
              </div>
              <div style={{
                alignSelf: 'flex-start',
                marginTop: 12,
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--ivory-dim)',
                background: 'rgba(255,255,255,0.04)',
                padding: '2px 8px',
                borderRadius: 99,
                border: '1px solid var(--ivory-border)',
              }}>
                {kpi.badge}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── BARRE DE FILTRES MULTI-CRITÈRES ── */}
      <div style={{
        background: 'var(--glass-primary)',
        border: '1px solid var(--ivory-border)',
        borderRadius: 18,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} color="var(--gold)" />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ivory)' }}>
              Filtres de Viabilité & Découpage
            </span>
          </div>

          {(selectedLeague !== 'ALL' || selectedRound !== 'ALL' || selectedClub !== 'ALL' || filterType !== 'ALL' || searchTerm.trim()) && (
            <button
              onClick={() => {
                setSelectedLeague('ALL');
                setSelectedRound('ALL');
                setSelectedClub('ALL');
                setFilterType('ALL');
                setSearchTerm('');
              }}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--ivory-border)',
                borderRadius: 6,
                color: 'var(--gold)',
                padding: '4px 10px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Réinitialiser tous les filtres
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {/* 1. Championnat / Compétition */}
          <div>
            <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: 'var(--neutral)', marginBottom: 4 }}>
              Championnat
            </label>
            <select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--obsidian-2)',
                border: '1px solid var(--ivory-border)',
                borderRadius: 8,
                color: 'var(--ivory)',
                padding: '7px 10px',
                fontSize: 11,
                outline: 'none',
              }}
            >
              {SUPPORTED_COMPETITIONS.map((c) => (
                <option key={c.code} value={c.code} style={{ background: '#121212' }}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Journée (dynamique selon le championnat réel) */}
          <div>
            <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: 'var(--neutral)', marginBottom: 4 }}>
              Journée / Tour
            </label>
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--obsidian-2)',
                border: '1px solid var(--ivory-border)',
                borderRadius: 8,
                color: 'var(--ivory)',
                padding: '7px 10px',
                fontSize: 11,
                outline: 'none',
              }}
            >
              <option value="ALL" style={{ background: '#121212' }}>Toutes les journées ({availableRounds.length})</option>
              {availableRounds.map((rd) => (
                <option key={rd} value={rd} style={{ background: '#121212' }}>
                  {rd}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Club spécifique */}
          <div>
            <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: 'var(--neutral)', marginBottom: 4 }}>
              Club Spécifique
            </label>
            <select
              value={selectedClub}
              onChange={(e) => setSelectedClub(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--obsidian-2)',
                border: '1px solid var(--ivory-border)',
                borderRadius: 8,
                color: 'var(--ivory)',
                padding: '7px 10px',
                fontSize: 11,
                outline: 'none',
              }}
            >
              <option value="ALL" style={{ background: '#121212' }}>Tous les clubs ({availableClubs.length})</option>
              {availableClubs.map((club) => (
                <option key={club} value={club} style={{ background: '#121212' }}>
                  {club}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Statut validation prédiction */}
          <div>
            <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: 'var(--neutral)', marginBottom: 4 }}>
              Statut Prédiction
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--obsidian-2)',
                border: '1px solid var(--ivory-border)',
                borderRadius: 8,
                color: 'var(--ivory)',
                padding: '7px 10px',
                fontSize: 11,
                outline: 'none',
              }}
            >
              <option value="ALL" style={{ background: '#121212' }}>Tous statuts</option>
              <option value="CORRECT" style={{ background: '#121212' }}>🟢 Prédictions Réussies (Hits)</option>
              <option value="INCORRECT" style={{ background: '#121212' }}>🔴 Prédictions Échouées (Misses)</option>
              <option value="EXACT_SCORE" style={{ background: '#121212' }}>🎯 Scores Exacts Validés</option>
            </select>
          </div>

          {/* 5. Recherche par nom d'équipe */}
          <div>
            <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: 'var(--neutral)', marginBottom: 4 }}>
              Recherche
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={13} color="var(--neutral)" style={{ position: 'absolute', left: 10, top: 10 }} />
              <input
                type="text"
                placeholder="Ex: Paris, Real, Arsenal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--obsidian-2)',
                  border: '1px solid var(--ivory-border)',
                  borderRadius: 8,
                  color: 'var(--ivory)',
                  padding: '7px 10px 7px 28px',
                  fontSize: 11,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION GRAPHIQUES DE VIABILITÉ INTERACTIFS ── */}
      <div style={{
        background: 'var(--glass-primary)',
        border: '1px solid var(--ivory-border)',
        borderRadius: 18,
        padding: 22,
      }}>
        {/* Onglets Graphiques */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
          <div>
            <div className="card-section-title" style={{ fontSize: '1.15rem' }}>
              Visualisation Graphique du Taux de Réussite
            </div>
            <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 2 }}>
              Analyse comparative de l'efficacité prédictive de l'algorithme selon le filtre actif
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--obsidian-2)', padding: 4, borderRadius: 10, border: '1px solid var(--ivory-border)' }}>
            {[
              { id: 'MATCHDAY', label: '1. Par Journée (J1...)' },
              { id: 'LEAGUE', label: '2. Par Championnat' },
              { id: 'CLUB', label: '3. Par Club' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveChartTab(tab.id)}
                style={{
                  background: activeChartTab === tab.id ? 'var(--gold-muted)' : 'transparent',
                  color: activeChartTab === tab.id ? 'var(--gold)' : 'var(--neutral)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── GRAPHIQUE 1 : PAR JOURNÉE ── */}
        {activeChartTab === 'MATCHDAY' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--ivory)' }}>
                Évolution temporelle du taux de réussite (% 1N2 & Scores Exacts) pour :{' '}
                <strong style={{ color: 'var(--gold)' }}>
                  {SUPPORTED_COMPETITIONS.find((c) => c.code === selectedLeague)?.name || 'Toutes compétitions'}
                </strong>
              </div>
              <div style={{ fontSize: 10, color: 'var(--neutral)' }}>
                {matchdayChartData.length} journées observées
              </div>
            </div>

            {matchdayChartData.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--neutral)', fontSize: 12 }}>
                Aucune donnée de journée disponible pour la sélection courante.
              </div>
            ) : (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={matchdayChartData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                    <CartesianGrid stroke="rgba(245,240,232,0.06)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="shortLabel"
                      tick={{ fill: 'rgba(245,240,232,0.6)', fontSize: 10 }}
                      interval={matchdayChartData.length > 20 ? 1 : 0}
                    />
                    <YAxis
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fill: 'rgba(245,240,232,0.6)', fontSize: 10 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div style={{
                              background: 'var(--obsidian-2)',
                              border: '1px solid var(--gold-border)',
                              borderRadius: 8,
                              padding: '8px 12px',
                              fontSize: 11,
                              color: 'var(--ivory)',
                            }}>
                              <div style={{ fontWeight: 800, color: 'var(--gold)', marginBottom: 4 }}>
                                {data.round}
                              </div>
                              <div>Taux 1N2 validé : <strong>{data.accuracy}%</strong> ({data.correct}/{data.total})</div>
                              <div>Scores exacts : <strong>{data.exactAccuracy}%</strong> ({data.exact}/{data.total})</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Line
                      type="monotone"
                      dataKey="accuracy"
                      name="% Prédictions 1N2 Validées"
                      stroke="#4ade80"
                      strokeWidth={2.5}
                      dot={{ fill: '#4ade80', r: 3 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="exactAccuracy"
                      name="% Scores Exacts Validés"
                      stroke="var(--gold)"
                      strokeWidth={1.8}
                      strokeDasharray="4 4"
                      dot={{ fill: 'var(--gold)', r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ── GRAPHIQUE 2 : PAR CHAMPIONNAT ── */}
        {activeChartTab === 'LEAGUE' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--ivory)' }}>
                Comparatif de viabilité de l'algorithme à travers les 5 grands championnats et Coupes d'Europe
              </div>
              <div style={{ fontSize: 10, color: 'var(--neutral)' }}>
                Objectif de viabilité cible : 55%+
              </div>
            </div>

            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leagueChartData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                  <CartesianGrid stroke="rgba(245,240,232,0.06)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'rgba(245,240,232,0.7)', fontSize: 11 }}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fill: 'rgba(245,240,232,0.6)', fontSize: 10 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={{
                            background: 'var(--obsidian-2)',
                            border: '1px solid var(--gold-border)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            fontSize: 11,
                            color: 'var(--ivory)',
                          }}>
                            <div style={{ fontWeight: 800, color: 'var(--gold)', marginBottom: 4 }}>
                              {data.name}
                            </div>
                            <div>Taux Réussite : <strong>{data.accuracy}%</strong></div>
                            <div style={{ color: 'var(--neutral)', fontSize: 10 }}>
                              {data.correct} réussis sur {data.total} matchs
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="accuracy" name="% Réussite 1N2" radius={[6, 6, 0, 0]}>
                    {leagueChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.accuracy >= 60 ? '#4ade80' : (entry.accuracy >= 52 ? 'var(--gold)' : '#f87171')}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── GRAPHIQUE 3 : PAR CLUB ── */}
        {activeChartTab === 'CLUB' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--ivory)' }}>
                Fiabilité prédictive par Club (Minimum 3 matchs joués analysés)
              </div>
              <div style={{ fontSize: 10, color: 'var(--neutral)' }}>
                {selectedClub !== 'ALL' ? `Focus sur ${selectedClub}` : 'Top 15 clubs par volume & précision'}
              </div>
            </div>

            {clubChartData.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--neutral)', fontSize: 12 }}>
                Pas assez de matchs terminés pour ce club ou cette sélection.
              </div>
            ) : (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clubChartData} margin={{ top: 10, right: 20, left: -10, bottom: 30 }}>
                    <CartesianGrid stroke="rgba(245,240,232,0.06)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="club"
                      tick={{ fill: 'rgba(245,240,232,0.7)', fontSize: 10 }}
                      angle={-25}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fill: 'rgba(245,240,232,0.6)', fontSize: 10 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div style={{
                              background: 'var(--obsidian-2)',
                              border: '1px solid var(--gold-border)',
                              borderRadius: 8,
                              padding: '8px 12px',
                              fontSize: 11,
                              color: 'var(--ivory)',
                            }}>
                              <div style={{ fontWeight: 800, color: 'var(--gold)', marginBottom: 4 }}>
                                {data.club}
                              </div>
                              <div>Taux de prédiction validée : <strong>{data.accuracy}%</strong></div>
                              <div style={{ color: 'var(--neutral)', fontSize: 10 }}>
                                {data.correct} réussis sur {data.total} matchs
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="accuracy" name="% Réussite Club" radius={[6, 6, 0, 0]}>
                      {clubChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.accuracy >= 65 ? '#4ade80' : (entry.accuracy >= 50 ? 'var(--gold)' : '#f87171')}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SECTION AUDIT DÉTAILLÉ MATCH PAR MATCH ── */}
      <div style={{
        background: 'var(--glass-primary)',
        border: '1px solid var(--ivory-border)',
        borderRadius: 18,
        padding: 22,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="card-section-title">Audit Trail des Prédictions Match par Match</div>
            <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 2 }}>
              Vérification unitaire des choix 1N2 et scores exacts face au score réel officiel
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--neutral)' }}>
            <strong>{filteredMatches.length}</strong> matchs filtrés correspondants
          </div>
        </div>

        {/* Tableau Responsive */}
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--ivory-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--obsidian-3)', borderBottom: '1px solid var(--ivory-border)', color: 'var(--neutral)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '12px 14px' }}>Compétition & Tour</th>
                <th style={{ padding: '12px 14px' }}>Rencontre</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Score Réel</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Prédiction IA (1N2)</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Statut Validation</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Score Exact Prédit</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Confiance Algo</th>
              </tr>
            </thead>
            <tbody>
              {filteredMatches.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--neutral)' }}>
                    Aucun match ne correspond aux filtres sélectionnés.
                  </td>
                </tr>
              ) : (
                filteredMatches.slice(0, 100).map(({ match, evaluation }, idx) => {
                  const isCorrect = evaluation.isCorrect;
                  return (
                    <tr
                      key={idx}
                      style={{
                        background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      {/* Compétition & Tour */}
                      <td style={{ padding: '12px 14px', color: 'var(--neutral)', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontSize: 9,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'var(--gold-muted)',
                          color: 'var(--gold)',
                          fontWeight: 700,
                          marginRight: 6,
                        }}>
                          {match.league || 'L1'}
                        </span>
                        <span style={{ fontSize: 11 }}>{match.roundDisplay || match.date}</span>
                      </td>

                      {/* Équipes */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <TeamLogo teamName={match.homeTeam} size="xs" />
                          <span style={{ fontWeight: 700, color: 'var(--ivory)' }}>{match.homeTeam}</span>
                          <span style={{ color: 'var(--neutral)', fontSize: 10 }}>vs</span>
                          <span style={{ fontWeight: 700, color: 'var(--ivory)' }}>{match.awayTeam}</span>
                          <TeamLogo teamName={match.awayTeam} size="xs" />
                        </div>
                      </td>

                      {/* Score Réel */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: 800,
                          fontSize: 13,
                          color: 'var(--ivory)',
                          background: 'var(--obsidian-2)',
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--ivory-border)',
                        }}>
                          {evaluation.realScore}
                        </span>
                      </td>

                      {/* Prédiction IA (1N2) */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--ivory-dim)',
                          background: 'rgba(255,255,255,0.05)',
                          padding: '3px 8px',
                          borderRadius: 6,
                        }}>
                          {evaluation.predictedLabel}
                        </span>
                      </td>

                      {/* Statut Validation 1N2 */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {isCorrect ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#4ade80',
                            background: 'rgba(34,197,94,0.15)',
                            border: '1px solid rgba(34,197,94,0.35)',
                            padding: '3px 8px',
                            borderRadius: 6,
                          }}>
                            <CheckCircle2 size={12} color="#4ade80" />
                            RÉUSSI
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#f87171',
                            background: 'rgba(239,68,68,0.15)',
                            border: '1px solid rgba(239,68,68,0.35)',
                            padding: '3px 8px',
                            borderRadius: 6,
                          }}>
                            <XCircle size={12} color="#f87171" />
                            INCORRECT
                          </span>
                        )}
                      </td>

                      {/* Score Exact Prédit */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {evaluation.predictedScore ? (
                          <span style={{
                            fontSize: 11,
                            fontFamily: 'monospace',
                            color: evaluation.isExactScoreCorrect ? 'var(--gold)' : 'var(--neutral)',
                            fontWeight: evaluation.isExactScoreCorrect ? 800 : 400,
                          }}>
                            {evaluation.predictedScore} {evaluation.isExactScoreCorrect ? '🎯' : ''}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--neutral)', fontSize: 11 }}>—</span>
                        )}
                      </td>

                      {/* Confiance Algo */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: parseInt(evaluation.predictedProb, 10) >= 55 ? 'var(--gold)' : 'var(--neutral)',
                        }}>
                          {evaluation.predictedProb || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredMatches.length > 100 && (
          <div style={{ fontSize: 11, color: 'var(--neutral)', textAlign: 'center', marginTop: 4 }}>
            Affichage des 100 premiers matchs sur <strong>{filteredMatches.length}</strong> disponibles pour cette sélection.
          </div>
        )}
      </div>
        </>
      )}

    </div>
  );
}

