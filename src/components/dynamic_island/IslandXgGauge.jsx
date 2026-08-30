import React, { useMemo } from 'react';

/**
 * IslandXgGauge — Mini xG comparison bar between Home and Away
 * Bold xG numbers, balanced double gauge, high readability
 */
function IslandXgGauge({ homeXg = 0, awayXg = 0, homeTeam = 'Dom.', awayTeam = 'Ext.' }) {
  const { hVal, aVal, hRatio, aRatio, diff, leader } = useMemo(() => {
    const h = parseFloat(homeXg) || 0;
    const a = parseFloat(awayXg) || 0;
    const sum = h + a || 2.0;
    const hR = Math.max(15, Math.min(85, (h / sum) * 100));
    const aR = 100 - hR;
    const d = Math.abs(h - a).toFixed(2);
    const l = h > a ? 'home' : a > h ? 'away' : 'equal';

    return {
      hVal: h.toFixed(2),
      aVal: a.toFixed(2),
      hRatio: hR,
      aRatio: aR,
      diff: d,
      leader: l
    };
  }, [homeXg, awayXg]);

  return (
    <div
      style={{
        background: 'rgba(245, 240, 232, 0.03)',
        border: '1px solid rgba(245, 240, 232, 0.06)',
        borderRadius: '10px',
        padding: '8px 10px',
      }}
    >
      {/* Header labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '5px',
          fontSize: '11px',
        }}
      >
        <span style={{ color: 'var(--ivory, #F5F0E8)', fontWeight: 600 }}>
          <strong style={{ fontSize: '13px', color: leader === 'home' ? 'var(--positive, #4ADE80)' : 'var(--ivory)' }}>
            {hVal}
          </strong>{' '}
          <span style={{ fontSize: '10px', color: 'var(--neutral, #94A3B8)' }}>xG</span>
        </span>

        <span
          style={{
            fontSize: '9px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 700,
            color: 'var(--gold, #C9A96E)',
          }}
        >
          {diff > 0 ? `Δ ${diff} xG` : 'xG Équilibré'}
        </span>

        <span style={{ color: 'var(--ivory, #F5F0E8)', fontWeight: 600 }}>
          <span style={{ fontSize: '10px', color: 'var(--neutral, #94A3B8)' }}>xG</span>{' '}
          <strong style={{ fontSize: '13px', color: leader === 'away' ? 'var(--positive, #4ADE80)' : 'var(--ivory)' }}>
            {aVal}
          </strong>
        </span>
      </div>

      {/* Dual gauge bar */}
      <div
        style={{
          display: 'flex',
          height: '5px',
          borderRadius: '999px',
          overflow: 'hidden',
          backgroundColor: 'rgba(245, 240, 232, 0.06)',
          gap: '2px',
        }}
      >
        <div
          title={`${homeTeam} xG: ${hVal}`}
          style={{
            width: `${hRatio}%`,
            backgroundColor: leader === 'home' ? 'var(--positive, #4ADE80)' : 'var(--gold, #C9A96E)',
            transition: 'width 0.35s ease',
          }}
        />
        <div
          title={`${awayTeam} xG: ${aVal}`}
          style={{
            width: `${aRatio}%`,
            backgroundColor: leader === 'away' ? 'var(--positive, #4ADE80)' : 'rgba(245, 240, 232, 0.3)',
            transition: 'width 0.35s ease',
          }}
        />
      </div>
    </div>
  );
}

export default React.memo(IslandXgGauge);
