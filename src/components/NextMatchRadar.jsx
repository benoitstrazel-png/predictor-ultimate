import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { calculateTeamRadarMetrics } from '../utils/tacticalAnalysis';

const NextMatchRadar = ({ homeTeam = 'Liverpool', awayTeam = 'Nottingham Forest' }) => {
  const homeMetrics = useMemo(() => calculateTeamRadarMetrics(homeTeam), [homeTeam]);
  const awayMetrics = useMemo(() => calculateTeamRadarMetrics(awayTeam), [awayTeam]);

  const data = [
    { subject: 'Volume Attaque', [homeTeam]: homeMetrics.attack, [awayTeam]: awayMetrics.attack, fullMark: 100 },
    { subject: 'Solidité Défense', [homeTeam]: homeMetrics.defense, [awayTeam]: awayMetrics.defense, fullMark: 100 },
    { subject: 'Contrôle & Possession', [homeTeam]: homeMetrics.possession, [awayTeam]: awayMetrics.possession, fullMark: 100 },
    { subject: 'Forme Récente', [homeTeam]: homeMetrics.form, [awayTeam]: awayMetrics.form, fullMark: 100 },
    { subject: 'Finition & Danger', [homeTeam]: homeMetrics.danger, [awayTeam]: awayMetrics.danger, fullMark: 100 },
    { subject: 'Intensité / Duels', [homeTeam]: homeMetrics.intensity, [awayTeam]: awayMetrics.intensity, fullMark: 100 },
  ];

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div className="card-section-title">Profil Tactique Comparatif (Radar 6D)</div>
          <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
            Métriques certifiées normalisées (0-100) basées sur la saison officielle
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, fontWeight: 700 }}>
          <span style={{ color: '#06b6d4', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#06b6d4' }} />
            {homeTeam}
          </span>
          <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
            {awayTeam}
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
            <PolarGrid stroke="#27272a" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 600 }}
            />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                borderRadius: 4,
                fontSize: 11,
                color: '#fafafa',
              }}
            />
            <Radar
              name={homeTeam}
              dataKey={homeTeam}
              stroke="#06b6d4"
              fill="#06b6d4"
              fillOpacity={0.35}
              strokeWidth={2}
            />
            <Radar
              name={awayTeam}
              dataKey={awayTeam}
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.35}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default NextMatchRadar;
