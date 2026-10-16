/**
 * src/context/MatchContext.jsx
 * ─────────────────────────────────────────────────────────────
 * Fournisseur d'état global pour le match actif :
 * - Synchronisation atomique entre le carrousel, le drawer et toutes les vues
 * - Invalidation réactive lors du changement de sélection
 */

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import APP_DATA from '../data/app_data.json';

const MatchContext = createContext(null);

export const MatchProvider = ({ children }) => {
  const [allMatches, setAllMatches] = useState(() => APP_DATA?.fullSchedule || []);

  const [selectedMatchId, setSelectedMatchId] = useState(() => {
    if (APP_DATA.nextMatches && APP_DATA.nextMatches.length > 0) {
      return APP_DATA.nextMatches[0].id;
    }
    const firstActive = (APP_DATA?.fullSchedule || []).find(m => m.status === 'LIVE' || m.status === 'SCHEDULED');
    return firstActive?.id || APP_DATA?.fullSchedule?.[0]?.id || 'M_100';
  });

  const selectedMatch = useMemo(() => {
    return allMatches.find(m => m.id === selectedMatchId) || allMatches[0] || null;
  }, [selectedMatchId, allMatches]);

  const selectMatch = (matchOrId) => {
    const id = typeof matchOrId === 'string' ? matchOrId : matchOrId?.id;
    if (id) {
      setSelectedMatchId(id);
    }
  };

  const updateMatch = (matchId, patch) => {
    if (!matchId || !patch) return;
    setAllMatches(prev => prev.map(m => (m.id === matchId ? { ...m, ...patch } : m)));
  };

  const appDataReactive = useMemo(() => ({
    ...APP_DATA,
    fullSchedule: allMatches
  }), [allMatches]);

  return (
    <MatchContext.Provider
      value={{
        selectedMatch,
        selectedMatchId,
        selectMatch,
        updateMatch,
        allMatches,
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
