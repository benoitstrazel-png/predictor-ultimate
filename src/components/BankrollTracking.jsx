import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, ShieldCheck, Activity, Award } from 'lucide-react';

export default function BankrollTracking({ APP_DATA }) {
  // Simulated Bankroll cumulative ROI evolution curve
  const roiData = [
    { matchday: 'J1', bankroll: 1000, roi: 0 },
    { matchday: 'J2', bankroll: 1045, roi: 4.5 },
    { matchday: 'J3', bankroll: 1080, roi: 8.0 },
    { matchday: 'J4', bankroll: 1125, roi: 12.5 },
    { matchday: 'J5', bankroll: 1195, roi: 19.5 },
    { matchday: 'J6', bankroll: 1170, roi: 17.0 },
    { matchday: 'J7', bankroll: 1240, roi: 24.0 },
  ];

  // Performance metrics
  const totalValueBets = APP_DATA?.seasonStats?.totalValueBets || 54;
  const hitRate = '64.8%';
  const currentRoi = '+24.0%';
  const dataDriftScore = '0.04 (Stable)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Header */}
      <div>
        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '2.2rem',
          color: 'var(--ivory)',
          fontWeight: 400,
          margin: 0,
        }}>
          Bankroll & Model Performance
        </h1>
        <p style={{ fontSize: 12, color: 'var(--neutral)', marginTop: 4 }}>
          Suivi du ROI Global · Taux de Réussite Value Bets · Évaluation de la Dérive du Modèle (Data Drift)
        </p>
      </div>

      {/* KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'ROI Global Cumulé', value: currentRoi, icon: TrendingUp, color: 'var(--positive)' },
          { label: 'Taux de Réussite (Hit Rate)', value: hitRate, icon: Award, color: 'var(--gold)' },
          { label: 'Value Bets Exécutés', value: totalValueBets, icon: ShieldCheck, color: 'var(--ivory)' },
          { label: 'Indice Data Drift', value: dataDriftScore, icon: Activity, color: 'var(--positive)' },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} style={{
              background: 'var(--glass-primary)',
              border: '1px solid var(--ivory-border)',
              borderRadius: 16,
              padding: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--neutral)' }}>
                  {kpi.label}
                </span>
                <Icon size={18} color={kpi.color} />
              </div>
              <div style={{ fontSize: 24, fontFamily: 'var(--font-serif)', fontWeight: 700, color: kpi.color }}>
                {kpi.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* ROI GRAPH */}
      <div style={{
        background: 'var(--glass-primary)',
        border: '1px solid var(--ivory-border)',
        borderRadius: 18,
        padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="card-section-title">Évolution de la Bankroll & ROI (%)</div>
            <div style={{ fontSize: 11, color: 'var(--neutral)', marginTop: 2 }}>
              Progression cumulée de la stratégie Value Bets (Mise fixe 1 unit)
            </div>
          </div>
        </div>

        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={roiData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(245,240,232,0.06)" strokeDasharray="3 3" />
              <XAxis dataKey="matchday" tick={{ fill: 'rgba(245,240,232,0.5)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'rgba(245,240,232,0.5)', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--obsidian-2)',
                  border: '1px solid var(--gold-border)',
                  borderRadius: 10,
                  fontSize: 11,
                  color: 'var(--ivory)',
                }}
              />
              <Line
                type="monotone"
                dataKey="roi"
                name="ROI (%)"
                stroke="var(--gold)"
                strokeWidth={3}
                dot={{ fill: 'var(--gold)', r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
