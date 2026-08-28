import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export default function ValueEdgeScatter({ matches = [] }) {
  // Format matches into scatter points: x = Betclic Odd, y = Model Prob %, z = Edge %
  const points = [];

  matches.forEach(m => {
    if (!m.betclicOdds || !m.probabilities) return;
    const homeProb = parseFloat(m.probabilities.home) || 0;
    const awayProb = parseFloat(m.probabilities.away) || 0;
    const drawProb = parseFloat(m.probabilities.draw) || 0;

    if (m.betclicOdds.home) {
      const edge = homeProb - (1 / m.betclicOdds.home) * 100;
      points.push({
        match: `${m.homeTeam} vs ${m.awayTeam}`,
        side: `1 (${m.homeTeam})`,
        odd: m.betclicOdds.home,
        prob: homeProb,
        edge: +edge.toFixed(1),
        isValue: edge >= 2.5,
      });
    }
    if (m.betclicOdds.draw) {
      const edge = drawProb - (1 / m.betclicOdds.draw) * 100;
      points.push({
        match: `${m.homeTeam} vs ${m.awayTeam}`,
        side: `N (Nul)`,
        odd: m.betclicOdds.draw,
        prob: drawProb,
        edge: +edge.toFixed(1),
        isValue: edge >= 2.5,
      });
    }
    if (m.betclicOdds.away) {
      const edge = awayProb - (1 / m.betclicOdds.away) * 100;
      points.push({
        match: `${m.homeTeam} vs ${m.awayTeam}`,
        side: `2 (${m.awayTeam})`,
        odd: m.betclicOdds.away,
        prob: awayProb,
        edge: +edge.toFixed(1),
        isValue: edge >= 2.5,
      });
    }
  });

  const valuePoints = points.filter(p => p.isValue);
  const normalPoints = points.filter(p => !p.isValue);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          background: 'var(--obsidian-2)',
          border: '1px solid var(--gold-border)',
          borderRadius: 12,
          padding: '10px 14px',
          boxShadow: 'var(--shadow-float)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 2 }}>
            {data.match}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ivory)', fontWeight: 600 }}>
            {data.side}
          </div>
          <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 4 }}>
            Cote Betclic : <strong style={{ color: 'var(--ivory)' }}>{data.odd}</strong> | Modèle : <strong style={{ color: 'var(--ivory)' }}>{data.prob}%</strong>
          </div>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            marginTop: 4,
            color: data.edge > 0 ? 'var(--positive)' : 'var(--danger)',
          }}>
            Edge : {data.edge > 0 ? `+${data.edge}%` : `${data.edge}%`}
            {data.isValue && ' ★ Value Bet'}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{
      background: 'var(--glass-primary)',
      border: '1px solid var(--ivory-border)',
      borderRadius: 18,
      padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="card-section-title">Scatter Plot "Value Edge"</div>
          <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 2 }}>
            Cote Bookmaker Betclic vs Probabilité Modèle Dixon-Coles
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, fontWeight: 700 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--gold)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)' }} />
            Value Bet (Edge ≥ +2.5%)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--neutral)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(245,240,232,0.3)' }} />
            Marché Standard
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid stroke="rgba(245,240,232,0.06)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="odd"
              name="Cote Betclic"
              domain={[1, 7]}
              unit=""
              tick={{ fill: 'rgba(245,240,232,0.5)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(245,240,232,0.1)' }}
            />
            <YAxis
              type="number"
              dataKey="prob"
              name="Probabilité Modèle"
              unit="%"
              domain={[0, 80]}
              tick={{ fill: 'rgba(245,240,232,0.5)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(245,240,232,0.1)' }}
            />
            <ZAxis type="number" dataKey="edge" range={[40, 160]} />
            <Tooltip content={<CustomTooltip />} />
            {/* Standard market points */}
            <Scatter name="Marché" data={normalPoints} fill="rgba(245,240,232,0.25)" />
            {/* Value Bet points */}
            <Scatter name="Value Bets" data={valuePoints} fill="var(--gold)" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
