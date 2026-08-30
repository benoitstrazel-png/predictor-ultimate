import React, { useMemo } from 'react';

/**
 * IslandProbChart — Mini bar chart for 1N2 probabilities
 * Fine horizontal progress bar with clear contrast & values
 */
function IslandProbChart({ probabilities, homeTeam = '1', awayTeam = '2' }) {
  const parsedProbs = useMemo(() => {
    if (!probabilities) return { home: 33.3, draw: 33.3, away: 33.4, rawHome: '33%', rawDraw: '33%', rawAway: '34%' };

    const parseVal = (v) => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') return parseFloat(v.replace('%', '')) || 0;
      return 0;
    };

    const h = parseVal(probabilities.home);
    const d = parseVal(probabilities.draw);
    const a = parseVal(probabilities.away);
    const total = h + d + a || 100;

    return {
      home: (h / total) * 100,
      draw: (d / total) * 100,
      away: (a / total) * 100,
      rawHome: probabilities.home || `${h.toFixed(1)}%`,
      rawDraw: probabilities.draw || `${d.toFixed(1)}%`,
      rawAway: probabilities.away || `${a.toFixed(1)}%`,
    };
  }, [probabilities]);

  return (
    <div style={{ width: '100%' }}>
      {/* Probability bar */}
      <div
        style={{
          display: 'flex',
          height: '6px',
          borderRadius: '999px',
          overflow: 'hidden',
          backgroundColor: 'rgba(245, 240, 232, 0.08)',
          gap: '2px',
          marginBottom: '6px',
        }}
      >
        <div
          title={`Victoire ${homeTeam}: ${parsedProbs.rawHome}`}
          style={{
            width: `${parsedProbs.home}%`,
            backgroundColor: 'var(--positive, #4ADE80)',
            transition: 'width 0.35s ease',
            borderRadius: '2px 0 0 2px',
          }}
        />
        <div
          title={`Match Nul: ${parsedProbs.rawDraw}`}
          style={{
            width: `${parsedProbs.draw}%`,
            backgroundColor: 'var(--neutral, #94A3B8)',
            transition: 'width 0.35s ease',
          }}
        />
        <div
          title={`Victoire ${awayTeam}: ${parsedProbs.rawAway}`}
          style={{
            width: `${parsedProbs.away}%`,
            backgroundColor: 'var(--danger, #EF4444)',
            transition: 'width 0.35s ease',
            borderRadius: '0 2px 2px 0',
          }}
        />
      </div>

      {/* Numerical Labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          fontWeight: 600,
          fontFamily: 'var(--font-ui, sans-serif)',
        }}
      >
        <span style={{ color: 'var(--positive, #4ADE80)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '9px', opacity: 0.8, textTransform: 'uppercase' }}>1</span>
          <strong>{parsedProbs.rawHome}</strong>
        </span>
        <span style={{ color: 'var(--neutral, #94A3B8)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '9px', opacity: 0.8, textTransform: 'uppercase' }}>N</span>
          <strong>{parsedProbs.rawDraw}</strong>
        </span>
        <span style={{ color: 'var(--danger, #EF4444)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '9px', opacity: 0.8, textTransform: 'uppercase' }}>2</span>
          <strong>{parsedProbs.rawAway}</strong>
        </span>
      </div>
    </div>
  );
}

export default React.memo(IslandProbChart);
