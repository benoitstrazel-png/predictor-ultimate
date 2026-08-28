import React from 'react';
import { TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

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
    gap: 3,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '2px 7px',
    borderRadius: 6,
    background: 'rgba(201,169,110,0.15)',
    border: '1px solid rgba(201,169,110,0.3)',
    color: 'var(--gold)',
  }}>
    <Star size={8} />
    VALUE {edge}
  </span>
);

const MatchPrediction = ({ match }) => {
  // Support both legacy (prediction/odds) and new schema (probabilities/betclicOdds)
  const prediction = match?.prediction || {};
  const odds = match?.betclicOdds || match?.odds || {};
  const probs = match?.probabilities || {};
  const valueBets = match?.valueBets || [];
  const xG = match?.expectedGoals || {};
  const scores = match?.topExactScores || [];

  const homeProb = parseFloat(probs.home) || parseFloat(prediction.homeProb) || 33;
  const drawProb = parseFloat(probs.draw) || parseFloat(prediction.drawProb) || 33;
  const awayProb = parseFloat(probs.away) || parseFloat(prediction.awayProb) || 33;

  const confidence = prediction.confidence || prediction.winner_conf || Math.max(homeProb, drawProb, awayProb);

  const winner = prediction.winner ||
    (homeProb > awayProb && homeProb > drawProb ? match?.homeTeam :
     awayProb > homeProb && awayProb > drawProb ? match?.awayTeam :
     'Match Nul');

  const advice = prediction.advice ||
    (confidence > 70 ? `Victoire ${winner}` :
     confidence > 55 ? `Tendance ${winner}` : 'Match très serré');

  const bestValueBet = valueBets.find(v => v.is_value);

  // Color helpers
  const confColor = confidence >= 65 ? 'var(--positive)' : confidence >= 50 ? 'var(--warning)' : 'var(--danger)';
  const confIcon = confidence >= 65 ? TrendingUp : confidence >= 50 ? Minus : TrendingDown;
  const ConfIcon = confIcon;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Probabilités 1N2 ── */}
      <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10 }}>
          Probabilités 1N2 · Dixon-Coles
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          {[
            { label: '1 Domicile', value: homeProb, color: 'var(--positive)' },
            { label: 'Nul', value: drawProb, color: 'var(--gold)' },
            { label: '2 Extérieur', value: awayProb, color: 'var(--danger)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontFamily: 'var(--font-serif)', fontWeight: 700, color, lineHeight: 1.1 }}>
                {value.toFixed(1)}%
              </div>
              <div style={{ fontSize: 9, color: 'var(--neutral)', marginTop: 2, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        <ProbBar home={homeProb} draw={drawProb} away={awayProb} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--neutral)', marginTop: 4 }}>
          <span style={{ color: 'var(--positive)' }}>{homeProb.toFixed(1)}%</span>
          <span style={{ color: 'var(--gold)' }}>{drawProb.toFixed(1)}%</span>
          <span style={{ color: 'var(--danger)' }}>{awayProb.toFixed(1)}%</span>
        </div>
      </div>

      {/* ── Expected Goals ── */}
      {(xG.home || xG.away) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'xG Domicile', value: xG.home, color: 'var(--positive)' },
            { label: 'xG Extérieur', value: xG.away, color: 'var(--danger)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: 'var(--glass-primary)',
              border: '1px solid var(--ivory-border)',
              borderRadius: 12,
              padding: '10px 14px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 18, fontFamily: 'var(--font-serif)', color, fontWeight: 700 }}>
                {(+value || 0).toFixed(2)}
              </div>
              <div style={{ fontSize: 9, color: 'var(--neutral)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Cotes Betclic ── */}
      {(odds.home || odds.draw || odds.away) && (
        <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 14, padding: '12px 16px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
            Cotes Betclic
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {[
              { label: '1', value: odds.home },
              { label: 'N', value: odds.draw },
              { label: '2', value: odds.away },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: 'var(--obsidian-3)',
                border: '1px solid var(--ivory-border)',
                borderRadius: 8,
                padding: '8px 6px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 9, color: 'var(--neutral)', fontWeight: 600, letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ivory)', marginTop: 2, fontFamily: 'var(--font-ui)' }}>
                  {value ? (+value).toFixed(2) : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Score le plus probable ── */}
      {scores.length > 0 && (
        <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 14, padding: '12px 16px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
            Scores les plus probables
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {scores.slice(0, 5).map(({ score, prob }) => (
              <div key={score} style={{
                background: score === scores[0].score ? 'var(--gold-muted)' : 'var(--obsidian-3)',
                border: `1px solid ${score === scores[0].score ? 'var(--gold-border)' : 'var(--ivory-border)'}`,
                borderRadius: 8,
                padding: '6px 12px',
                textAlign: 'center',
                flex: '1',
                minWidth: 52,
              }}>
                <div style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: score === scores[0].score ? 'var(--gold)' : 'var(--ivory)',
                  fontFamily: 'var(--font-ui)',
                }}>
                  {score}
                </div>
                <div style={{ fontSize: 9, color: 'var(--neutral)', marginTop: 1 }}>
                  {prob.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Conseil IA ── */}
      <div style={{
        background: 'var(--gold-muted)',
        border: '1px solid var(--gold-border)',
        borderRadius: 14,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 3 }}>
            Conseil AI · Confiance {confidence.toFixed(0)}%
          </div>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-serif)', color: 'var(--ivory)', fontWeight: 400 }}>
            {advice}
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          color: confColor,
          fontWeight: 700,
          fontSize: 13,
          whiteSpace: 'nowrap',
        }}>
          <ConfIcon size={16} />
          {confidence.toFixed(0)}%
        </div>
      </div>

      {/* ── Value Bet ── */}
      {bestValueBet && (
        <div style={{
          background: 'rgba(201,169,110,0.08)',
          border: '1px solid rgba(201,169,110,0.25)',
          borderRadius: 12,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <ValueBadge edge={bestValueBet.edge_percentage} />
            <div style={{ fontSize: 11, color: 'var(--ivory-dim)', marginTop: 4 }}>
              {bestValueBet.side} @ {bestValueBet.betclic_odd} · Modèle {bestValueBet.model_prob}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MatchPrediction;
