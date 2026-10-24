import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { generateXgFlowTimeline } from '../utils/tacticalAnalysis';

export default function XgFlowChart({ homeTeam = 'Liverpool', awayTeam = 'Nottingham Forest', selectedMatch = null }) {
  const isFinishedOrLive = selectedMatch?.status === 'FINISHED' || selectedMatch?.status === 'LIVE';

  // Génération dynamique du flux réel ou prédictif
  const data = useMemo(() => {
    return generateXgFlowTimeline(homeTeam, awayTeam, selectedMatch);
  }, [homeTeam, awayTeam, selectedMatch]);

  return (
    <div style={{
      background: '#121215',
      border: '1px solid #27272a',
      borderRadius: 6,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="card-section-title">xG Flow & Momentum Graph</div>
          <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
            {isFinishedOrLive ? 'Cumul de création de danger xG minute par minute (0-90 min)' : 'Projection dynamique de pression & occasions par quart d\'heure (0-90 min)'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, fontWeight: 700 }}>
          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 2, background: '#10b981' }} />
            {homeTeam}
          </span>
          <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 2, background: '#ef4444' }} />
            {awayTeam}
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorHome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorAway" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis dataKey="minute" tick={{ fill: '#71717a', fontSize: 10 }} />
            <YAxis tick={{ fill: '#71717a', fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                borderRadius: 4,
                fontSize: 11,
                color: '#fafafa',
              }}
              formatter={(value, name) => [`${value} xG cumulé`, name]}
            />
            <Area
              type="monotone"
              dataKey="home"
              name={homeTeam}
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorHome)"
            />
            <Area
              type="monotone"
              dataKey="away"
              name={awayTeam}
              stroke="#ef4444"
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
