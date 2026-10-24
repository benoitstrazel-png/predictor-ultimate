/**
 * api/odds/refresh.js
 * ─────────────────────────────────────────────────────────────
 * Route Serverless Vercel sécurisée pour le rafraîchissement des cotes Betclic
 * et le calcul déterministe des Value Bets & scores exacts.
 * 
 * SÉCURITÉ RENFORCÉE (Protection contre vulnérabilités de type PHP/SSRF/Injection) :
 * - Restriction stricte à la méthode POST
 * - Validation stricte par liste blanche sur matchId (regex ^[A-Za-z0-9_-]{3,64}$)
 * - Assainissement des chaînes d'équipes (longueur max 60, pas de caractères d'injection)
 * - Validation des nombres pour les cotes (nombres finis entre 1.01 et 100.0)
 * - Zéro évaluation dynamique (ni eval, ni Function, ni spawn/exec)
 * - Zéro accès arbitraire au système de fichiers (chemins figés et audités)
 * - Protection anti-pollution de prototype (__proto__, constructor, prototype)
 */

import fs from 'node:fs';
import path from 'node:path';

// Cache mémoire des données pour la durée de vie du conteneur Lambda
let cachedAppData = null;
let cachedMarkets = null;

function loadAppData() {
  if (cachedAppData) return cachedAppData;
  try {
    const fullPath = path.join(process.cwd(), 'src', 'data', 'app_data.json');
    if (fs.existsSync(fullPath)) {
      const raw = fs.readFileSync(fullPath, 'utf8');
      cachedAppData = JSON.parse(raw);
    }
  } catch (err) {
    console.error('[API ODDS] Erreur chargement app_data.json:', err.message);
  }
  return cachedAppData || { fullSchedule: [] };
}

function loadMarketsCache() {
  if (cachedMarkets) return cachedMarkets;
  try {
    const fullPath = path.join(process.cwd(), 'src', 'data', 'betclic_markets_cache.json');
    if (fs.existsSync(fullPath)) {
      const raw = fs.readFileSync(fullPath, 'utf8');
      cachedMarkets = JSON.parse(raw);
    }
  } catch (err) {
    console.error('[API ODDS] Erreur chargement betclic_markets_cache.json:', err.message);
  }
  return cachedMarkets || {};
}

// Calcul mathématique Poisson déterministe pour le score le plus probable selon l'issue
export function calculatePoissonScore(lambdaH, lambdaA, targetOutcome = null) {
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

export function resolveScoreForOutcome(exactScores, lambdaH, lambdaA, targetOutcome) {
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

export async function handleRefreshOddsServerless(req, res) {
  // En-têtes CORS sécurisés
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      error: 'Méthode non autorisée. Seul POST est accepté.',
    });
  }

  // 1. Validation de sécurité du corps de requête
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ success: false, error: 'JSON malformé.' });
    }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ success: false, error: 'Corps de requête JSON attendu.' });
  }

  // Protection contre pollution de prototype
  for (const dangerousKey of ['__proto__', 'constructor', 'prototype']) {
    if (Object.prototype.hasOwnProperty.call(body, dangerousKey)) {
      return res.status(400).json({ success: false, error: 'Charge utile rejetée (clé interdite).' });
    }
  }

  // Validation stricte du matchId
  const rawMatchId = body.matchId;
  if (!rawMatchId || typeof rawMatchId !== 'string' || !/^[A-Za-z0-9_-]{3,64}$/.test(rawMatchId)) {
    return res.status(400).json({ success: false, error: 'matchId invalide ou suspect.' });
  }
  const matchId = rawMatchId.trim();

  // Assainissement des chaînes d'équipes
  const sanitizeTeam = (name) => {
    if (!name || typeof name !== 'string') return '';
    return name.slice(0, 60).replace(/[^\w\s\.\-áàâäéèêëíìîïóòôöúùûüñçÁÀÂÄÉÈÊËÍÌÎÏÓÒÔÖÚÙÛÜÑÇ]/g, '').trim();
  };
  const homeTeam = sanitizeTeam(body.homeTeam);
  const awayTeam = sanitizeTeam(body.awayTeam);

  // 2. Recherche du match dans les sources sécurisées
  const appData = loadAppData();
  const schedule = appData.fullSchedule || [];
  let targetMatch = schedule.find((m) => m.id === matchId);

  if (!targetMatch && homeTeam && awayTeam) {
    const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const ch = clean(homeTeam);
    const ca = clean(awayTeam);
    targetMatch = schedule.find((m) => {
      const mh = clean(m.homeTeam);
      const ma = clean(m.awayTeam);
      return (mh === ch && ma === ca) || (mh.includes(ch) && ma.includes(ca));
    });
  }

  if (!targetMatch) {
    return res.status(404).json({
      success: false,
      status: 'NOT_FOUND',
      error: 'Match introuvable dans le calendrier officiel.',
    });
  }

  // 3. Récupération des cotes réelles
  const marketsCache = loadMarketsCache();
  const matchMarkets = marketsCache[matchId] || marketsCache[targetMatch.id];

  let oddH = null;
  let oddD = null;
  let oddA = null;

  // Validation d'éventuelles cotes manuelles passées (ex: test sécurisé)
  if (body.oddHome && body.oddDraw && body.oddAway) {
    const parseOdd = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) && n >= 1.01 && n <= 100.0 ? n : null;
    };
    oddH = parseOdd(body.oddHome);
    oddD = parseOdd(body.oddDraw);
    oddA = parseOdd(body.oddAway);
  }

  // Si pas de cotes manuelles, extraire depuis le cache Betclic
  if (!oddH || !oddD || !oddA) {
    if (matchMarkets?.sections?.RESULTS?.markets) {
      const r1n2 = matchMarkets.sections.RESULTS.markets.find((mk) => mk.marketId?.includes('1N2') || mk.marketName?.includes('Résultat'));
      if (r1n2?.selections) {
        const s1 = r1n2.selections.find((s) => s.key === '1');
        const sn = r1n2.selections.find((s) => s.key === 'N');
        const s2 = r1n2.selections.find((s) => s.key === '2');
        if (s1?.odds && sn?.odds && s2?.odds) {
          oddH = Number(s1.odds);
          oddD = Number(sn.odds);
          oddA = Number(s2.odds);
        }
      }
    }
  }

  // Fallback sur targetMatch.betclicOdds existant
  if (!oddH || !oddD || !oddA) {
    const existing = targetMatch.betclicOdds || targetMatch.odds;
    if (existing) {
      oddH = Number(existing.home ?? existing['1'] ?? null);
      oddD = Number(existing.draw ?? existing['N'] ?? null);
      oddA = Number(existing.away ?? existing['2'] ?? null);
    }
  }

  const nowUtc = new Date().toISOString();

  // Si aucune cote disponible
  if (!oddH || !oddD || !oddA) {
    return res.status(200).json({
      success: true,
      data: {
        matchId: targetMatch.id,
        homeTeam: targetMatch.homeTeam,
        awayTeam: targetMatch.awayTeam,
        betclicOdds: null,
        oddsStatus: 'NOT_OPEN',
        valueBets: [],
        message: 'Cotes non encore ouvertes par Betclic pour cette rencontre.',
        lastOddsRefresh: nowUtc,
      },
    });
  }

  // 4. Calcul mathématique de la marge bookmaker et TRJ
  const rawSum = 1 / oddH + 1 / oddD + 1 / oddA;
  const marginPct = Number(((rawSum - 1) * 100).toFixed(2));
  const trjPct = Number(((1 / rawSum) * 100).toFixed(2));

  // Probabilités implicites du bookmaker (dé-margées)
  const fairProbH = Number(((1 / oddH / rawSum) * 100).toFixed(1));
  const fairProbD = Number(((1 / oddD / rawSum) * 100).toFixed(1));
  const fairProbA = Number((100 - fairProbH - fairProbD).toFixed(1));

  // Extraction ou calcul des lambdas xG du modèle
  const v3Snap = targetMatch.predictionsByModel?.v3 || {};
  const lambdaH = Number(v3Snap.lambdaHome ?? targetMatch.expectedGoals?.home ?? 1.35);
  const lambdaA = Number(v3Snap.lambdaAway ?? targetMatch.expectedGoals?.away ?? 1.10);

  // Probabilités du modèle actif (v3 prioritaire ou probas existantes)
  const modelProbH = Number(v3Snap.probHome ?? parseFloat(String(targetMatch.probabilities?.home || fairProbH)));
  const modelProbD = Number(v3Snap.probDraw ?? parseFloat(String(targetMatch.probabilities?.draw || fairProbD)));
  const modelProbA = Number(v3Snap.probAway ?? parseFloat(String(targetMatch.probabilities?.away || fairProbA)));

  // 5. Détection rigoureuse des Value Bets
  const valueBets = [];
  const testOdds = [
    { selection: '1', team: targetMatch.homeTeam, odd: oddH, prob: modelProbH },
    { selection: 'N', team: 'Nul', odd: oddD, prob: modelProbD },
    { selection: '2', team: targetMatch.awayTeam, odd: oddA, prob: modelProbA },
  ];

  let bestValue = null;
  let maxEdge = 0;

  for (const item of testOdds) {
    const pFrac = item.prob / 100;
    const edge = Number(((pFrac * item.odd - 1) * 100).toFixed(1));
    if (edge >= 2.0) {
      // Formule du Critère de Kelly fractionnaire (quart Kelly) borné à 5%
      const b = item.odd - 1;
      const fullKelly = b > 0 ? (b * pFrac - (1 - pFrac)) / b : 0;
      const kellyStake = Number(Math.max(0.5, Math.min(5.0, fullKelly * 0.25 * 100)).toFixed(1));

      const vbRecord = {
        market: 'Résultat 1N2',
        selection: item.selection,
        selection_label: item.selection === '1' ? targetMatch.homeTeam : item.selection === '2' ? targetMatch.awayTeam : 'Match Nul',
        team: item.team,
        bookmaker_odds: item.odd,
        odd: item.odd,
        betclic_odd: item.odd,
        model_probability: `${item.prob}%`,
        edge_percentage: `+${edge}%`,
        edge: `+${edge}%`,
        stake_recommendation: `${kellyStake}%`,
        is_value: true,
      };
      valueBets.push(vbRecord);

      if (edge > maxEdge) {
        maxEdge = edge;
        bestValue = { selection: item.selection, edge, kellyStake };
      }
    }
  }

  // 6. Calcul des scores exacts : P: (prédiction) et V: (value bet)
  const predOutcome = modelProbH >= modelProbD && modelProbH >= modelProbA
    ? '1'
    : modelProbA >= modelProbH && modelProbA >= modelProbD
    ? '2'
    : 'N';

  const exactScores = v3Snap.exactScores || targetMatch.topExactScores || [];
  const topScore = resolveScoreForOutcome(exactScores, lambdaH, lambdaA, predOutcome);
  const valueBetScore = bestValue
    ? resolveScoreForOutcome(exactScores, lambdaH, lambdaA, bestValue.selection)
    : null;

  return res.status(200).json({
    success: true,
    data: {
      matchId: targetMatch.id,
      homeTeam: targetMatch.homeTeam,
      awayTeam: targetMatch.awayTeam,
      betclicOdds: {
        home: oddH,
        draw: oddD,
        away: oddA,
      },
      oddsStatus: 'ACTIVE',
      oddsMarginPct: marginPct,
      oddsTrjPct: trjPct,
      probabilities: {
        home: `${modelProbH}%`,
        draw: `${modelProbD}%`,
        away: `${modelProbA}%`,
      },
      valueBets,
      topScore,
      valueBetScore,
      valueOutcome: bestValue?.selection || null,
      valueEdgePct: maxEdge,
      lastOddsRefresh: nowUtc,
    },
  });
}

export default async function handler(req, res) {
  try {
    await handleRefreshOddsServerless(req, res);
  } catch (error) {
    console.error('[API ODDS REFRESH FATAL]', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne lors du traitement de la requête.',
    });
  }
}
