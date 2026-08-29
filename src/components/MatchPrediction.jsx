import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Star, RefreshCw, Target, Flame, ShieldCheck } from 'lucide-react';
import TeamLogo from './ui/TeamLogo';

const ProbBar = ({ home, draw, away }) => {
  const h = parseFloat(home) || 0;
  const d = parseFloat(draw) || 0;
  const a = parseFloat(away) || 0;
  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', display: 'flex', height: 8, marginTop: 6, marginBottom: 4 }}>
      <div style={{ width: `${h}%`, background: 'var(--positive)', transition: 'width 0.6s ease' }} />
      <div style={{ width: `${d}%`, background: 'rgba(201,169,110,0.6)', transition: 'width 0.6s ease' }} />
      <div style={{ width: `${a}%`, background: 'var(--danger)', transition: 'width 0.6s ease' }} />
    </div>
  );
};

const ValueBadge = ({ edge }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '3px 8px',
    borderRadius: 6,
    background: 'rgba(201,169,110,0.2)',
    border: '1px solid rgba(201,169,110,0.4)',
    color: 'var(--gold)',
  }}>
    <Star size={10} fill="var(--gold)" />
    VALUE BET {edge}
  </span>
);

// Fallback exact score generator
function calculateScoresFallback(lambdaH, lambdaA, isHalfTime = false) {
  const lH = isHalfTime ? Math.max(0.10, lambdaH * 0.43) : lambdaH;
  const lA = isHalfTime ? Math.max(0.08, lambdaA * 0.43) : lambdaA;
  const maxGoals = isHalfTime ? 3 : 5;

  const poisson = (k, l) => {
    let p = Math.exp(-l);
    for (let i = 1; i <= k; i++) p *= l / i;
    return p;
  };

  const list = [];
  let sum = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = poisson(h, lH) * poisson(a, lA);
      list.push({ score: `${h}-${a}`, rawP: p });
      sum += p;
    }
  }
  return list
    .map(s => ({ score: s.score, prob: parseFloat(((s.rawP / (sum || 1)) * 100).toFixed(1)) }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, isHalfTime ? 5 : 6);
}

const MatchPrediction = ({ match }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(match?.lastOddsRefresh ? new Date(match.lastOddsRefresh).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null);
  const [scoreViewMode, setScoreViewMode] = useState('FT'); // 'FT' (Full Time 90') | 'HT' (Half Time 45')
  const [playerViewMode, setPlayerViewMode] = useState('SCORERS'); // 'SCORERS' | 'ASSISTS'

  const handleManualRefresh = async () => {
    if (!match?.id) return;
    setIsRefreshing(true);
    try {
      const res = await fetch('http://localhost:5175/api/odds/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, homeTeam: match.homeTeam, awayTeam: match.awayTeam })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.betclicOdds) {
          match.betclicOdds = json.data.betclicOdds;
          match.probabilities = json.data.probabilities;
          match.valueBets = json.data.valueBets;
          match.oddsStatus = json.data.oddsStatus;
          match.oddsMarginPct = json.data.oddsMarginPct;
        }
      }
    } catch (e) {
      console.warn('Refresh odds offline:', e.message);
    } finally {
      setRefreshedAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setIsRefreshing(false);
    }
  };

  const prediction = match?.prediction || {};
  const odds = match?.betclicOdds || match?.odds || {};
  const probs = match?.probabilities || {};
  const valueBets = match?.valueBets || [];
  const xG = match?.expectedGoals || {};

  const homeProb = parseFloat(probs.home) || parseFloat(prediction.homeProb) || 33;
  const drawProb = parseFloat(probs.draw) || parseFloat(prediction.drawProb) || 33;
  const awayProb = parseFloat(probs.away) || parseFloat(prediction.awayProb) || 33;

  const lambdaH = parseFloat(xG.home || prediction.homeXg || (homeProb / 30).toFixed(2));
  const lambdaA = parseFloat(xG.away || prediction.awayXg || (awayProb / 30).toFixed(2));

  const ftScores = (match?.topExactScores && match.topExactScores.length > 0)
    ? match.topExactScores
    : calculateScoresFallback(lambdaH, lambdaA, false);

  const htScores = (match?.topHalfTimeScores && match.topHalfTimeScores.length > 0)
    ? match.topHalfTimeScores
    : calculateScoresFallback(lambdaH, lambdaA, true);

  const displayedScores = scoreViewMode === 'FT' ? ftScores : htScores;

  // Potential Scorers & Assists
  const potentialScorers = match?.potentialScorers || {};
  const potentialAssists = match?.potentialAssists || {};

  const homeScorersList = potentialScorers.home || [
    { name: `Attaquant (${match?.homeTeam || 'Home'})`, position: 'FW', goalProb: '42.5%', oddScorer: 2.35, xGMatch: 0.48 },
    { name: `Ailier (${match?.homeTeam || 'Home'})`, position: 'FW', goalProb: '31.2%', oddScorer: 3.10, xGMatch: 0.32 },
  ];
  const awayScorersList = potentialScorers.away || [
    { name: `Attaquant (${match?.awayTeam || 'Away'})`, position: 'FW', goalProb: '38.0%', oddScorer: 2.55, xGMatch: 0.42 },
    { name: `Ailier (${match?.awayTeam || 'Away'})`, position: 'FW', goalProb: '28.5%', oddScorer: 3.40, xGMatch: 0.28 },
  ];

  const homeAssistsList = potentialAssists.home || [
    { name: `Meneur de Jeu (${match?.homeTeam || 'Home'})`, position: 'MF', assistProb: '34.0%', oddAssist: 2.85, xAMatch: 0.38 },
    { name: `Ailier (${match?.homeTeam || 'Home'})`, position: 'FW', assistProb: '26.5%', oddAssist: 3.65, xAMatch: 0.26 },
  ];
  const awayAssistsList = potentialAssists.away || [
    { name: `Meneur de Jeu (${match?.awayTeam || 'Away'})`, position: 'MF', assistProb: '31.0%', oddAssist: 3.15, xAMatch: 0.34 },
    { name: `Ailier (${match?.awayTeam || 'Away'})`, position: 'FW', assistProb: '24.0%', oddAssist: 4.05, xAMatch: 0.22 },
  ];

  const confidence = prediction.confidence || prediction.winner_conf || Math.max(homeProb, drawProb, awayProb);

  const winner = prediction.winner ||
    (homeProb > awayProb && homeProb > drawProb ? match?.homeTeam :
     awayProb > homeProb && awayProb > drawProb ? match?.awayTeam :
     'Match Nul');

  const advice = prediction.advice ||
    (confidence > 70 ? `Victoire ${winner}` :
     confidence > 55 ? `Tendance ${winner}` : 'Match très serré');

  const bestValueBet = valueBets.find(v => v.is_value);

  // Determine explicit Value Bet Label
  let valueBetExplicitText = '';
  if (bestValueBet) {
    if (bestValueBet.selection_label) {
      valueBetExplicitText = bestValueBet.selection_label;
    } else if (bestValueBet.side && bestValueBet.side.length > 2) {
      valueBetExplicitText = bestValueBet.side;
    } else {
      const sel = bestValueBet.selection || '1';
      if (sel === '1') valueBetExplicitText = `Victoire ${match?.homeTeam || 'Domicile'} (1)`;
      else if (sel === '2') valueBetExplicitText = `Victoire ${match?.awayTeam || 'Extérieur'} (2)`;
      else valueBetExplicitText = `Match Nul (N)`;
    }
  }

  // Color helpers
  const confColor = confidence >= 65 ? 'var(--positive)' : confidence >= 50 ? 'var(--warning)' : 'var(--danger)';
  const confIcon = confidence >= 65 ? TrendingUp : confidence >= 50 ? Minus : TrendingDown;
  const ConfIcon = confIcon;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Probabilités 1N2 ── */}
      <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 16, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)' }}>
            Probabilités 1N2 · Dixon-Coles & Quant ML
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {refreshedAt && (
              <span style={{ fontSize: 9, color: 'var(--positive)', fontWeight: 600 }}>
                Cote T @ {refreshedAt}
              </span>
            )}
            <button
              onClick={handleManualRefresh}
              title="Rafraîchir la cote en temps réel"
              style={{
                background: 'rgba(201,169,110,0.15)',
                border: '1px solid var(--gold-border)',
                borderRadius: 6,
                padding: '4px 10px',
                color: 'var(--gold)',
                fontSize: 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={10} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
              {isRefreshing ? 'Calcul...' : 'Actualiser Cote'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          {[
            { label: `1 · ${match?.homeTeam || 'Domicile'}`, value: homeProb, color: 'var(--positive)' },
            { label: 'N · Match Nul', value: drawProb, color: 'var(--gold)' },
            { label: `2 · ${match?.awayTeam || 'Extérieur'}`, value: awayProb, color: 'var(--danger)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontFamily: 'var(--font-serif)', fontWeight: 700, color, lineHeight: 1.1 }}>
                {value.toFixed(1)}%
              </div>
              <div style={{ fontSize: 9, color: 'var(--neutral)', marginTop: 3, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        <ProbBar home={homeProb} draw={drawProb} away={awayProb} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--neutral)', marginTop: 4 }}>
          <span style={{ color: 'var(--positive)', fontWeight: 700 }}>{homeProb.toFixed(1)}%</span>
          <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{drawProb.toFixed(1)}%</span>
          <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{awayProb.toFixed(1)}%</span>
        </div>
      </div>

      {/* ── Expected Goals (xG) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: `xG ${match?.homeTeam || 'Domicile'}`, value: lambdaH, color: 'var(--positive)' },
          { label: `xG ${match?.awayTeam || 'Extérieur'}`, value: lambdaA, color: 'var(--danger)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--glass-primary)',
            border: '1px solid var(--ivory-border)',
            borderRadius: 14,
            padding: '12px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, fontFamily: 'var(--font-serif)', color, fontWeight: 700 }}>
              {(+value || 0).toFixed(2)}
            </div>
            <div style={{ fontSize: 9, color: 'var(--neutral)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Cotes Betclic (1N2) ── */}
      {odds.home || odds.draw || odds.away ? (
        <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 16, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)' }}>
              🎲 Cotes Officielles Betclic (1N2)
            </div>
            {match?.oddsMarginPct && (
              <span style={{ fontSize: 10, color: 'var(--neutral)' }}>Marge : {match.oddsMarginPct}%</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: `1 (${match?.homeTeam || 'Dom'})`, value: odds.home, color: 'var(--positive)' },
              { label: 'N (Nul)', value: odds.draw, color: 'var(--gold)' },
              { label: `2 (${match?.awayTeam || 'Ext'})`, value: odds.away, color: 'var(--danger)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: 'var(--obsidian-3)',
                border: '1px solid var(--ivory-border)',
                borderRadius: 10,
                padding: '10px 8px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 9, color: 'var(--neutral)', fontWeight: 700, letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color, marginTop: 3, fontFamily: 'var(--font-ui)' }}>
                  {value ? (+value).toFixed(2) : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--glass-primary)', border: '1px dashed rgba(255, 215, 0, 0.3)', borderRadius: 14, padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>
            ⏳ Cotes en attente d'ouverture
          </div>
          <div style={{ fontSize: 11, color: 'var(--neutral)', marginBottom: 8 }}>
            Marché Betclic non encore publié
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            style={{
              background: 'rgba(206, 240, 2, 0.12)',
              border: '1px solid #CEF002',
              color: '#CEF002',
              borderRadius: 6,
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 700,
              cursor: isRefreshing ? 'not-allowed' : 'pointer'
            }}
          >
            {isRefreshing ? 'Recherche en direct...' : '⚡ Actualiser la cote'}
          </button>
        </div>
      )}

      {/* ── SECTION VALUE BET (Clarifiée & Précise) ── */}
      {bestValueBet ? (
        <div style={{
          background: 'linear-gradient(135deg, rgba(201, 169, 110, 0.15) 0%, rgba(139, 106, 60, 0.1) 100%)',
          border: '1px solid var(--gold-border)',
          borderRadius: 16,
          padding: '16px 18px',
          boxShadow: '0 4px 20px rgba(201, 169, 110, 0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <ValueBadge edge={bestValueBet.edge_percentage || bestValueBet.edge} />
            <span style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 800 }}>
              Mise conseillée : {bestValueBet.stake_recommendation || '2.0%'}
            </span>
          </div>

          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ivory)', marginTop: 4, fontFamily: 'var(--font-serif)' }}>
            🎯 Opportunité : <strong style={{ color: 'var(--gold)' }}>{valueBetExplicitText}</strong>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--neutral)' }}>
            <span>Cote Betclic : <strong style={{ color: 'var(--ivory)' }}>{bestValueBet.betclic_odd || bestValueBet.odd || bestValueBet.bookmaker_odds}</strong></span>
            <span>Probabilité Modèle : <strong style={{ color: 'var(--positive)' }}>{bestValueBet.model_probability || bestValueBet.model_prob}</strong></span>
            <span>Edge Net : <strong style={{ color: 'var(--gold)' }}>{bestValueBet.edge_percentage || bestValueBet.edge}</strong></span>
          </div>
        </div>
      ) : (
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 14,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          color: 'var(--neutral)',
        }}>
          <ShieldCheck size={14} color="var(--neutral)" />
          <span>Aucun Value Bet détecté sur ce match (Cotes bookmakers alignées avec le modèle).</span>
        </div>
      )}

      {/* ── SCORES EXACTS PROBABLES (Mi-temps & Fin de Match) ── */}
      <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 16, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)' }}>
            Scores les plus probables
          </div>

          {/* Toggle FT / HT */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--obsidian-3)', padding: 3, borderRadius: 8, border: '1px solid var(--ivory-border)' }}>
            <button
              onClick={() => setScoreViewMode('FT')}
              style={{
                background: scoreViewMode === 'FT' ? 'var(--gold-muted)' : 'transparent',
                color: scoreViewMode === 'FT' ? 'var(--gold)' : 'var(--neutral)',
                border: 'none',
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Fin de match (90')
            </button>
            <button
              onClick={() => setScoreViewMode('HT')}
              style={{
                background: scoreViewMode === 'HT' ? 'var(--gold-muted)' : 'transparent',
                color: scoreViewMode === 'HT' ? 'var(--gold)' : 'var(--neutral)',
                border: 'none',
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Mi-temps (45')
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {displayedScores.map(({ score, prob }, idx) => (
            <div key={score} style={{
              background: idx === 0 ? 'var(--gold-muted)' : 'var(--obsidian-3)',
              border: `1px solid ${idx === 0 ? 'var(--gold-border)' : 'var(--ivory-border)'}`,
              borderRadius: 10,
              padding: '8px 14px',
              textAlign: 'center',
              flex: '1',
              minWidth: 56,
            }}>
              <div style={{
                fontSize: 16,
                fontWeight: 900,
                color: idx === 0 ? 'var(--gold)' : 'var(--ivory)',
                fontFamily: 'var(--font-ui)',
              }}>
                {score}
              </div>
              <div style={{ fontSize: 9, color: idx === 0 ? 'var(--gold)' : 'var(--neutral)', marginTop: 2, fontWeight: 700 }}>
                {prob.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BUTEURS & PASSEURS POTENTIELS ── */}
      <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 16, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)' }}>
            {playerViewMode === 'SCORERS' ? <Flame size={13} color="var(--gold)" /> : <Target size={13} color="var(--gold)" />}
            {playerViewMode === 'SCORERS' ? 'Probables Buteurs (Anytime)' : 'Probables Passeurs Décisifs'}
          </div>

          <div style={{ display: 'flex', gap: 4, background: 'var(--obsidian-3)', padding: 3, borderRadius: 8, border: '1px solid var(--ivory-border)' }}>
            <button
              onClick={() => setPlayerViewMode('SCORERS')}
              style={{
                background: playerViewMode === 'SCORERS' ? 'var(--gold-muted)' : 'transparent',
                color: playerViewMode === 'SCORERS' ? 'var(--gold)' : 'var(--neutral)',
                border: 'none',
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ⚽ Buteurs
            </button>
            <button
              onClick={() => setPlayerViewMode('ASSISTS')}
              style={{
                background: playerViewMode === 'ASSISTS' ? 'var(--gold-muted)' : 'transparent',
                color: playerViewMode === 'ASSISTS' ? 'var(--gold)' : 'var(--neutral)',
                border: 'none',
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              👟 Passeurs
            </button>
          </div>
        </div>

        {/* Dual Column Home vs Away */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Home Column */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <TeamLogo teamName={match?.homeTeam} size="xs" />
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ivory)' }}>{match?.homeTeam}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(playerViewMode === 'SCORERS' ? homeScorersList : homeAssistsList).map((p, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--obsidian-3)',
                  border: '1px solid var(--ivory-border)',
                  borderRadius: 8,
                  padding: '6px 10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <span style={{
                      fontSize: 8,
                      fontWeight: 800,
                      padding: '1px 4px',
                      borderRadius: 4,
                      background: p.position === 'FW' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                      color: p.position === 'FW' ? '#f87171' : '#60a5fa',
                    }}>
                      {p.position || 'FW'}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ivory)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold)' }}>
                      {playerViewMode === 'SCORERS' ? (p.goalProb || `${p.goalProbVal}%`) : (p.assistProb || `${p.assistProbVal}%`)}
                    </div>
                    <div style={{ fontSize: 8, color: 'var(--neutral)' }}>
                      {playerViewMode === 'SCORERS' ? `@ ${p.oddScorer || '2.20'}` : `@ ${p.oddAssist || '2.80'}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Away Column */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <TeamLogo teamName={match?.awayTeam} size="xs" />
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ivory)' }}>{match?.awayTeam}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(playerViewMode === 'SCORERS' ? awayScorersList : awayAssistsList).map((p, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--obsidian-3)',
                  border: '1px solid var(--ivory-border)',
                  borderRadius: 8,
                  padding: '6px 10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <span style={{
                      fontSize: 8,
                      fontWeight: 800,
                      padding: '1px 4px',
                      borderRadius: 4,
                      background: p.position === 'FW' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                      color: p.position === 'FW' ? '#f87171' : '#60a5fa',
                    }}>
                      {p.position || 'FW'}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ivory)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold)' }}>
                      {playerViewMode === 'SCORERS' ? (p.goalProb || `${p.goalProbVal}%`) : (p.assistProb || `${p.assistProbVal}%`)}
                    </div>
                    <div style={{ fontSize: 8, color: 'var(--neutral)' }}>
                      {playerViewMode === 'SCORERS' ? `@ ${p.oddScorer || '2.20'}` : `@ ${p.oddAssist || '2.80'}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Conseil IA ── */}
      <div style={{
        background: 'var(--gold-muted)',
        border: '1px solid var(--gold-border)',
        borderRadius: 16,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 3 }}>
            Conseil AI · Confiance {confidence.toFixed(0)}%
          </div>
          <div style={{ fontSize: 14, fontFamily: 'var(--font-serif)', color: 'var(--ivory)', fontWeight: 500 }}>
            {advice}
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          color: confColor,
          fontWeight: 800,
          fontSize: 14,
          whiteSpace: 'nowrap',
        }}>
          <ConfIcon size={18} />
          {confidence.toFixed(0)}%
        </div>
      </div>

    </div>
  );
};

export default MatchPrediction;
