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
      background: 'var(--glass-primary)',
      border: '1px solid var(--ivory-border)',
      borderRadius: 18,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div className="card-section-title">Profil Tactique Comparatif (Radar 6D)</div>
          <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 2 }}>
            Métriques certifiées normalisées (0-100) basées sur la saison officielle
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, fontWeight: 700 }}>
          <span style={{ color: 'var(--positive)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--positive)' }} />
            {homeTeam}
          </span>
          <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }} />
            {awayTeam}
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
            <PolarGrid stroke="rgba(245, 240, 232, 0.08)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: 'rgba(245, 240, 232, 0.7)', fontSize: 10, fontWeight: 600 }}
            />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: 'var(--obsidian-2)',
                border: '1px solid var(--gold-border)',
                borderRadius: 10,
                fontSize: 11,
                color: 'var(--ivory)',
              }}
            />
            <Radar
              name={homeTeam}
              dataKey={homeTeam}
              stroke="var(--positive)"
              fill="var(--positive)"
              fillOpacity={0.35}
              strokeWidth={2}
            />
            <Radar
              name={awayTeam}
              dataKey={awayTeam}
              stroke="var(--danger)"
              fill="var(--danger)"
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
