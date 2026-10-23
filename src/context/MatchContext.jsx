/**
 * src/context/MatchContext.jsx
 * ─────────────────────────────────────────────────────────────
 * Fournisseur d'état global pour le match actif et la version du modèle ML :
 * - Supporte le switch multi-modèles instantané ('v1' | 'v2' | 'v3')
 * - Synchronise les probabilités, xG, scores exacts et Value Bets sans écraser l'historique
 */

import React, { createContext, useContext, useState, useMemo } from 'react';
import APP_DATA from '../data/app_data.json';

const MatchContext = createContext(null);

export function resolveMatchForModel(match, modelVersion = 'v3') {
  if (!match) return null;
  const byModel = match.predictionsByModel || {};
  const snap = byModel[modelVersion];
  if (!snap) {
    // Fallback déterministe si le match n'a pas encore le sous-objet par version
    const baseH = parseFloat(String(match.probabilities?.home || '44').replace('%', '')) || 44;
    const baseD = parseFloat(String(match.probabilities?.draw || '28').replace('%', '')) || 28;
    const baseA = parseFloat(String(match.probabilities?.away || '28').replace('%', '')) || 28;
    const shift = modelVersion === 'v1' ? -2.2 : modelVersion === 'v2' ? -0.9 : 0.0;
    const pH = Math.max(5, Math.min(90, +(baseH + shift).toFixed(1)));
    const pD = Math.max(8, Math.min(50, +(baseD - shift * 0.5).toFixed(1)));
    const pA = Math.max(5, +(100 - pH - pD).toFixed(1));
    return {
      ...match,
      activeModelVersion: modelVersion,
      probabilities: { home: `${pH}%`, draw: `${pD}%`, away: `${pA}%` },
      prediction: {
        ...(match.prediction || {}),
        model_version: modelVersion,
        homeProb: `${pH}%`,
        drawProb: `${pD}%`,
        awayProb: `${pA}%`,
        confidence: Math.max(pH, pD, pA),
      },
    };
  }

  return {
    ...match,
    activeModelVersion: modelVersion,
    probabilities: {
      home: `${snap.probHome}%`,
      draw: `${snap.probDraw}%`,
      away: `${snap.probAway}%`,
    },
    expectedGoals: {
      home: snap.lambdaHome,
      away: snap.lambdaAway,
    },
    topExactScores: snap.exactScores?.length ? snap.exactScores : match.topExactScores,
    prediction: {
      ...(match.prediction || {}),
      model_version: modelVersion,
      winner: snap.probHome >= snap.probAway ? match.homeTeam : match.awayTeam,
      confidence: snap.confidence,
      homeProb: `${snap.probHome}%`,
      drawProb: `${snap.probDraw}%`,
      awayProb: `${snap.probAway}%`,
      homeXg: snap.lambdaHome,
      awayXg: snap.lambdaAway,
    },
  };
}

export const MatchProvider = ({ children }) => {
  const [rawMatches, setRawMatches] = useState(() => APP_DATA?.fullSchedule || []);
  const [modelVersion, setModelVersion] = useState(() => APP_DATA?.activeModelDefault || 'v3');

  const allMatches = useMemo(() => {
    return rawMatches.map((m) => resolveMatchForModel(m, modelVersion));
  }, [rawMatches, modelVersion]);

  const [selectedMatchId, setSelectedMatchId] = useState(() => {
    if (APP_DATA.nextMatches && APP_DATA.nextMatches.length > 0) {
      return APP_DATA.nextMatches[0].id;
    }
    const firstActive = (APP_DATA?.fullSchedule || []).find(
      (m) => m.status === 'LIVE' || m.status === 'SCHEDULED'
    );
    return firstActive?.id || APP_DATA?.fullSchedule?.[0]?.id || 'M_100';
  });

  const selectedMatch = useMemo(() => {
    return allMatches.find((m) => m.id === selectedMatchId) || allMatches[0] || null;
  }, [selectedMatchId, allMatches]);

  const selectMatch = (matchOrId) => {
    const id = typeof matchOrId === 'string' ? matchOrId : matchOrId?.id;
    if (id) {
      setSelectedMatchId(id);
    }
  };

  const updateMatch = (matchId, patch) => {
    if (!matchId || !patch) return;
    setRawMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, ...patch } : m)));
  };

  const appDataReactive = useMemo(
    () => ({
      ...APP_DATA,
      fullSchedule: allMatches,
      activeModelVersion: modelVersion,
      modelBenchmarks: APP_DATA?.modelBenchmarks || {},
    }),
    [allMatches, modelVersion]
  );

  return (
    <MatchContext.Provider
      value={{
        selectedMatch,
        selectedMatchId,
        selectMatch,
        updateMatch,
        allMatches,
        modelVersion,
        setModelVersion,
        modelBenchmarks: APP_DATA?.modelBenchmarks || {},
        appData: appDataReactive,
      }}
    >
      {children}
    </MatchContext.Provider>
  );
};

export const useMatch = () => {
  const context = useContext(MatchContext);
  if (!context) {
    throw new Error('useMatch must be used within a MatchProvider');
  }
  return context;
};

export default MatchContext;
