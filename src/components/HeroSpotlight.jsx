import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Flame, CloudRain, Wind, Sparkles } from 'lucide-react';
import TeamLogo from './ui/TeamLogo';
import APP_DATA from '../data/app_data.json';

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=80&w=2000',
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=2000',
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=2000',
  'https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&q=80&w=2000',
];

export default function HeroSpotlight({ selectedMatch: propMatch, onOpenAiModal, onNextMatch, onPrevMatch }) {
  const [imgIdx, setImgIdx] = useState(0);

  // Resolve match: prefer prop, fallback to first upcoming
  const match = propMatch || (APP_DATA.nextMatches?.[0]) || {
    homeTeam: 'Manchester City',
    awayTeam: 'Arsenal',
    league: 'Premier League',
    homeLogo: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
    awayLogo: 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
    expectedGoals: { home: 1.63, away: 1.26 },
    probabilities: { home: '52%', draw: '26%', away: '22%' },
    weather: { condition: 'Ensoleillé', temp_avg_c: 21, precipitation_mm: 0, wind_speed_kmh: 12 },
    betclicOdds: { home: 1.85, draw: 3.70, away: 4.50 },
    valueBets: [],
  };

  const hasValueBet = match.valueBets && match.valueBets.length > 0;
  const valueEdge = hasValueBet ? match.valueBets[0].edge_percentage : null;

  const cycleImg = (dir) => {
    setImgIdx(i => (i + dir + HERO_IMAGES.length) % HERO_IMAGES.length);
  };

  const homeProb = parseFloat(match.probabilities?.home) || 50;
  const drawProb = parseFloat(match.probabilities?.draw) || 25;
  const awayProb = parseFloat(match.probabilities?.away) || 25;

  return (
    <div className="hero-cinematic">
      {/* Background */}
      <div
        className="hero-bg"
        style={{ backgroundImage: `url(${HERO_IMAGES[imgIdx]})` }}
      />
      <div className="hero-vignette" />

      {/* Navigation arrows (subtle) */}
      <button
        onClick={() => { cycleImg(-1); onPrevMatch?.(); }}
        style={{
          position: 'absolute',
          top: '50%',
          left: 20,
          transform: 'translateY(-50%)',
          zIndex: 20,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'rgba(8,11,20,0.7)',
          border: '1px solid var(--ivory-border)',
          color: 'var(--ivory)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          opacity: 0.6,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={() => { cycleImg(1); onNextMatch?.(); }}
        style={{
          position: 'absolute',
          top: '50%',
          right: 20,
          transform: 'translateY(-50%)',
          zIndex: 20,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'rgba(8,11,20,0.7)',
          border: '1px solid var(--ivory-border)',
          color: 'var(--ivory)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          opacity: 0.6,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
      >
        <ChevronRight size={16} />
      </button>

      {/* Hero Content */}
      <div className="hero-content">
        {/* League tag */}
        <div className="hero-league-tag">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block' }} />
          {match.league || 'European Football'}
          {match.matchDate && (
            <span style={{ color: 'var(--neutral)', fontWeight: 400, letterSpacing: '0.05em' }}>
              · {match.matchDate}
            </span>
          )}
        </div>

        {/* Team logos + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <TeamLogo teamName={match.homeTeam} size="lg" />
          <h1 className="hero-match-title" style={{ margin: 0 }}>
            {match.homeTeam} <em style={{ fontStyle: 'italic', color: 'var(--ivory)', opacity: 0.3, fontSize: '70%' }}>×</em>{' '}
            <em>{match.awayTeam}</em>
          </h1>
          <TeamLogo teamName={match.awayTeam} size="lg" />
        </div>

        {/* Info badges */}
        <div className="hero-badges">
          {match.expectedGoals && (
            <div className="hero-badge">
              <Flame size={12} color="var(--gold)" />
              <span>xG projeté :</span>
              <strong>{match.expectedGoals.home?.toFixed(2)} — {match.expectedGoals.away?.toFixed(2)}</strong>
            </div>
          )}
          {match.weather && (
            <div className="hero-badge">
              <CloudRain size={12} color="#93c5fd" />
              <span>{match.weather.condition}</span>
              <strong>{match.weather.temp_avg_c}°C</strong>
              <Wind size={11} color="var(--neutral)" />
              <span>{match.weather.wind_speed_kmh} km/h</span>
            </div>
          )}
          {match.betclicOdds && (
            <div className="hero-badge">
              <span>Cotes Betclic :</span>
              <strong style={{ color: 'var(--positive)' }}>{match.betclicOdds.home}</strong>
              <span>·</span>
              <strong>{match.betclicOdds.draw}</strong>
              <span>·</span>
              <strong style={{ color: 'var(--danger)' }}>{match.betclicOdds.away}</strong>
            </div>
          )}
          {hasValueBet && (
            <div className="hero-badge" style={{ borderColor: 'var(--positive-border)', background: 'var(--positive-muted)' }}>
              <span style={{ color: 'var(--positive)', fontWeight: 700 }}>✓ Value Bet · Edge {valueEdge}</span>
            </div>
          )}
        </div>
      </div>

      {/* Floating KPI Card — bottom right */}
      <div className="hero-kpi-float">
        <div className="hero-kpi-label">Probabilité de victoire</div>
        <div className="hero-kpi-value">
          {match.probabilities?.home || '—'}
          {hasValueBet && (
            <span className="kpi-unit">+{valueEdge} edge</span>
          )}
        </div>
        <div className="hero-kpi-sub" style={{ marginBottom: 14 }}>
          {match.homeTeam} à domicile · Modèle Dixon-Coles
        </div>

        {/* Mini probability bar */}
        <div style={{ marginBottom: 14 }}>
          <div className="prob-bar-container" style={{ height: 4, marginBottom: 4 }}>
            <div className="prob-segment-home" style={{ width: `${homeProb}%` }} />
            <div className="prob-segment-draw" style={{ width: `${drawProb}%` }} />
            <div className="prob-segment-away" style={{ width: `${awayProb}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--neutral)', letterSpacing: '0.05em' }}>
            <span style={{ color: 'var(--positive)' }}>D1 {homeProb}%</span>
            <span>N {drawProb}%</span>
            <span style={{ color: 'var(--danger)' }}>D2 {awayProb}%</span>
          </div>
        </div>

        {/* AI button */}
        <button
          onClick={onOpenAiModal}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, var(--gold), #8B6A3C)',
            color: 'var(--obsidian)',
            fontFamily: 'var(--font-ui)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            boxShadow: 'var(--shadow-gold)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(201,169,110,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--shadow-gold)'; }}
        >
          <Sparkles size={13} />
          Analyse IA On-Demand
        </button>
      </div>

      {/* Image dots */}
      <div style={{
        position: 'absolute',
        bottom: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 5,
        zIndex: 20,
      }}>
        {HERO_IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => setImgIdx(i)}
            style={{
              width: imgIdx === i ? 16 : 5,
              height: 5,
              borderRadius: 3,
              background: imgIdx === i ? 'var(--gold)' : 'rgba(245,240,232,0.3)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s',
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
