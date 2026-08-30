import React, { useMemo } from 'react';

/**
 * IslandSparkline — Mini SVG sparkline with smooth bezier curve & gradient
 * Visualise l'évolution de l'edge ou des cotes dans le temps.
 */
function IslandSparkline({
  data = [4.2, 5.8, 7.1, 6.4, 9.2, 11.5, 14.2],
  height = 28,
  width = 110,
  positive = true,
  currentValue = '+14.2%'
}) {
  const points = useMemo(() => {
    if (!data || data.length === 0) return [];
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 3;
    const usableH = height - padding * 2;
    const step = (width - padding * 2) / Math.max(1, data.length - 1);

    return data.map((val, idx) => {
      const x = padding + idx * step;
      const y = height - padding - ((val - min) / range) * usableH;
      return { x, y, val };
    });
  }, [data, height, width]);

  const { pathD, areaD, lastPoint } = useMemo(() => {
    if (points.length < 2) return { pathD: '', areaD: '', lastPoint: null };

    // Courbe de Bézier cubique lissée
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      d += ` C ${cpX},${p0.y} ${cpX},${p1.y} ${p1.x},${p1.y}`;
    }

    const last = points[points.length - 1];
    const first = points[0];
    const area = `${d} L ${last.x},${height} L ${first.x},${height} Z`;

    return { pathD: d, areaD: area, lastPoint: last };
  }, [points, height]);

  const strokeColor = positive ? 'var(--positive, #4ADE80)' : 'var(--gold, #C9A96E)';
  const gradId = useMemo(() => `spark-grad-${Math.random().toString(36).substr(2, 6)}`, []);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {areaD && <path d={areaD} fill={`url(#${gradId})`} />}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {lastPoint && (
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="3"
            fill={strokeColor}
            stroke="var(--obsidian, #080B14)"
            strokeWidth="1.5"
          />
        )}
      </svg>
      {currentValue && (
        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            fontFamily: 'monospace',
            color: strokeColor,
          }}
        >
          {currentValue}
        </span>
      )}
    </div>
  );
}

export default React.memo(IslandSparkline);
