/**
 * Helper utility to evaluate match prediction against actual match result.
 */

export function evaluateMatchPrediction(match) {
  if (!match) return null;

  // 1. Determine Actual Outcome from score
  let homeScore = null;
  let awayScore = null;

  if (typeof match.homeScore === 'number' && typeof match.awayScore === 'number') {
    homeScore = match.homeScore;
    awayScore = match.awayScore;
  } else if (match.score) {
    if (typeof match.score === 'object') {
      homeScore = match.score.home;
      awayScore = match.score.away;
    } else if (typeof match.score === 'string' && match.score.includes('-')) {
      const parts = match.score.split('-').map(s => parseInt(s.trim(), 10));
      if (!isNaN(parts[0]) && !isNaN(parts[1])) {
        homeScore = parts[0];
        awayScore = parts[1];
      }
    }
  }

  const isFinished = match.status === 'FINISHED' || (homeScore !== null && awayScore !== null && match.status !== 'SCHEDULED' && match.status !== 'LIVE');
  if (!isFinished || homeScore === null || awayScore === null) {
    return {
      status: 'PENDING',
      isFinished: false,
      realOutcome: null,
      predictedOutcome: null,
      isCorrect: null,
      realScore: null,
    };
  }

  let realOutcome = 'N'; // '1', 'N', '2'
  if (homeScore > awayScore) realOutcome = '1';
  else if (awayScore > homeScore) realOutcome = '2';

  const realScore = `${homeScore}-${awayScore}`;

  // 2. Determine Algo Predicted Outcome
  let predictedOutcome = null;
  let predictedLabel = '';
  let predictedProb = null;

  const probs = match.probabilities || (match.prediction && {
    home: match.prediction.homeProb || match.prediction.home,
    draw: match.prediction.drawProb || match.prediction.draw,
    away: match.prediction.awayProb || match.prediction.away
  });

  if (probs && (probs.home !== undefined || probs.draw !== undefined || probs.away !== undefined)) {
    const h = parseFloat(probs.home) || 0;
    const d = parseFloat(probs.draw) || 0;
    const a = parseFloat(probs.away) || 0;

    if (h >= d && h >= a) {
      predictedOutcome = '1';
      predictedLabel = `1 · ${match.homeTeam || 'Domicile'}`;
      predictedProb = h;
    } else if (a >= h && a >= d) {
      predictedOutcome = '2';
      predictedLabel = `2 · ${match.awayTeam || 'Extérieur'}`;
      predictedProb = a;
    } else {
      predictedOutcome = 'N';
      predictedLabel = 'N · Nul';
      predictedProb = d;
    }
  } else if (match.prediction && match.prediction.winner) {
    const w = match.prediction.winner.toLowerCase();
    const hName = (match.homeTeam || '').toLowerCase();
    const aName = (match.awayTeam || '').toLowerCase();

    if (w.includes('nul') || w === 'n') {
      predictedOutcome = 'N';
      predictedLabel = 'N · Nul';
    } else if (hName && w.includes(hName)) {
      predictedOutcome = '1';
      predictedLabel = `1 · ${match.homeTeam}`;
    } else if (aName && w.includes(aName)) {
      predictedOutcome = '2';
      predictedLabel = `2 · ${match.awayTeam}`;
    }
    predictedProb = match.prediction.confidence || match.prediction.winner_conf || 50;
  } else if (match.topExactScores && match.topExactScores.length > 0) {
    const topScore = match.topExactScores[0].score;
    const [th, ta] = topScore.split('-').map(Number);
    if (th > ta) {
      predictedOutcome = '1';
      predictedLabel = `1 · ${match.homeTeam}`;
    } else if (ta > th) {
      predictedOutcome = '2';
      predictedLabel = `2 · ${match.awayTeam}`;
    } else {
      predictedOutcome = 'N';
      predictedLabel = 'N · Nul';
    }
    predictedProb = match.topExactScores[0].prob || 35;
  } else {
    // Deterministic estimation based on xG or team names
    const hXg = parseFloat(match.homeXg) || 1.4;
    const aXg = parseFloat(match.awayXg) || 1.1;
    if (hXg > aXg + 0.25) {
      predictedOutcome = '1';
      predictedLabel = `1 · ${match.homeTeam}`;
      predictedProb = Math.min(85, Math.round(45 + (hXg - aXg) * 20));
    } else if (aXg > hXg + 0.25) {
      predictedOutcome = '2';
      predictedLabel = `2 · ${match.awayTeam}`;
      predictedProb = Math.min(85, Math.round(45 + (aXg - hXg) * 20));
    } else {
      predictedOutcome = 'N';
      predictedLabel = 'N · Nul';
      predictedProb = 34;
    }
  }

  const isCorrect = predictedOutcome === realOutcome;

  // 3. Exact score match
  const predictedScore = match.topExactScores?.[0]?.score || match.prediction?.score || null;
  const isExactScoreCorrect = predictedScore === realScore;

  // 4. Value bet performance if any
  const valueBet = (match.valueBets && match.valueBets.length > 0) ? match.valueBets[0] : null;
  let valueBetWon = null;
  let valueBetNetProfit = 0; // 1 unit stake
  if (valueBet) {
    const side = valueBet.side || valueBet.selection || '';
    const odd = parseFloat(valueBet.betclic_odd || valueBet.odd || valueBet.bookmaker_odds || 2.0);
    const isSide1 = side.includes('1') || side.toLowerCase().includes((match.homeTeam || '').toLowerCase());
    const isSide2 = side.includes('2') || side.toLowerCase().includes((match.awayTeam || '').toLowerCase());
    const isSideN = side.toLowerCase().includes('nul') || side.includes('N');

    if ((isSide1 && realOutcome === '1') || (isSide2 && realOutcome === '2') || (isSideN && realOutcome === 'N')) {
      valueBetWon = true;
      valueBetNetProfit = parseFloat((odd - 1).toFixed(2));
    } else {
      valueBetWon = false;
      valueBetNetProfit = -1.0;
    }
  }

  return {
    status: 'FINISHED',
    isFinished: true,
    realOutcome,
    realScore,
    predictedOutcome,
    predictedLabel,
    predictedProb: predictedProb ? `${Math.round(predictedProb)}%` : null,
    predictedScore,
    isCorrect,
    isExactScoreCorrect,
    valueBet,
    valueBetWon,
    valueBetNetProfit
  };
}
