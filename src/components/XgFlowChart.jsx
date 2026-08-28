import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function XgFlowChart({ homeTeam = 'PSG', awayTeam = 'Marseille', xGData }) {
  // Generate realistic 0-90 min minute-by-minute xG accumulation data if not provided
  const data = xGData || Array.from({ length: 19 }, (_, i) => {
    const minute = i * 5;
    const homeCum = +(Math.sin(i / 3) * 0.4 + (i / 18) * 1.8).toFixed(2);
    const awayCum = +(Math.cos(i / 4) * 0.2 + (i / 18) * 0.9).toFixed(2);
    return { minute: `${minute}'`, home: Math.max(0, homeCum), away: Math.max(0, awayCum) };
  });

  return (
    <div style={{
      background: 'var(--glass-primary)',
      border: '1px solid var(--ivory-border)',
      borderRadius: 18,
      padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="card-section-title">xG Flow & Momentum Graph</div>
          <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 2 }}>
            Cumul de création de danger xG minute par minute (0 - 90 min)
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, fontWeight: 700 }}>
          <span style={{ color: 'var(--positive)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 2, background: 'var(--positive)' }} />
            {homeTeam}
          </span>
          <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 2, background: 'var(--danger)' }} />
            {awayTeam}
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorHome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--positive)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--positive)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorAway" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(245,240,232,0.06)" strokeDasharray="3 3" />
            <XAxis dataKey="minute" tick={{ fill: 'rgba(245,240,232,0.5)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'rgba(245,240,232,0.5)', fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: 'var(--obsidian-2)',
                border: '1px solid var(--gold-border)',
                borderRadius: 10,
                fontSize: 11,
                color: 'var(--ivory)',
              }}
            />
            <Area
              type="monotone"
              dataKey="home"
              name={homeTeam}
              stroke="var(--positive)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorHome)"
            />
            <Area
              type="monotone"
              dataKey="away"
              name={awayTeam}
              stroke="var(--danger)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorAway)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
