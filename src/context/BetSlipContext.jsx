/**
 * src/context/BetSlipContext.jsx
 * ─────────────────────────────────────────────────────────────
 * Contexte global du Panier de Paris (BetSlip) & Gestionnaire de Tickets :
 * - Gestion du panier multi-sélections (Paris Simples & Combinés)
 * - Traçabilité duale des cotes : Cote Betclic Scrappée vs Cote Saisie Réelle (Analyse CLV)
 * - Support des matchs lointains sans cote ouverte (Saisie manuelle assistée)
 * - Preset optionnel "Kelly Quant V3" pour le dimensionnement de mise
 * - Persistance hybride réactive (localStorage + sync SQLite)
 * - Résolution automatique post-match (1N2, Over/Under, Score Exact, Buteur)
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const BetSlipContext = createContext(null);

const STORAGE_KEY_TICKETS = 'pu_user_tickets_v2';
const STORAGE_KEY_CART = 'pu_betslip_cart_v2';

// Tickets de démonstration initiaux avec traçabilité de cote scrappée vs cote jouée
const SEED_TICKETS = [
  {
    ticketId: 'tkt_seed_01',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    ticketType: 'SINGLE',
    totalStake: 25.0,
    totalOdds: 2.15,
    potentialPayout: 53.75,
    status: 'WON',
    resolvedPayout: 53.75,
    notes: 'Value Bet détecté par V3 Quant',
    selections: [
      {
        selectionId: 'sel_seed_01',
        matchId: 'seed_m1',
        matchLabel: 'Paris Saint-Germain vs Olympique de Marseille',
        league: 'Ligue 1',
        marketType: '1N2',
        marketLabel: 'Résultat 1N2',
        selectionKey: '1',
        selectionLabel: 'Victoire PSG (1)',
        odds: 2.15,
        scrapedOdds: 2.05,
        oddsDelta: +0.10, // CLV positif (+0.10 par rapport à l'ouverture)
        hasScrapedOdds: true,
        status: 'WON',
        modelProb: '58.4%',
        edgePct: '+12.6%',
      },
    ],
  },
  {
    ticketId: 'tkt_seed_02',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    ticketType: 'ACCUMULATOR',
    totalStake: 15.0,
    totalOdds: 4.82,
    potentialPayout: 72.30,
    status: 'PENDING',
    resolvedPayout: 0.0,
    notes: 'Combiné Week-end Européen',
    selections: [
      {
        selectionId: 'sel_seed_02_1',
        matchId: 'seed_m2',
        matchLabel: 'Real Madrid vs FC Barcelone',
        league: 'La Liga',
        marketType: 'TOTAL_GOALS',
        marketLabel: 'Nombre de buts',
        selectionKey: 'OVER_2.5',
        selectionLabel: 'Plus de 2.5 buts',
        odds: 1.62,
        scrapedOdds: 1.62,
        oddsDelta: 0.0,
        hasScrapedOdds: true,
        status: 'PENDING',
        modelProb: '67.0%',
        edgePct: '+8.5%',
      },
      {
        selectionId: 'sel_seed_02_2',
        matchId: 'seed_m3',
        matchLabel: 'Arsenal vs Everton',
        league: 'Premier League',
        marketType: '1N2',
        marketLabel: 'Résultat 1N2',
        selectionKey: '1',
        selectionLabel: 'Victoire Arsenal (1)',
        odds: 1.40,
        scrapedOdds: 1.40,
        oddsDelta: 0.0,
        hasScrapedOdds: true,
        status: 'PENDING',
        modelProb: '71.5%',
        edgePct: '+5.5%',
      },
      {
        selectionId: 'sel_seed_02_3',
        matchId: 'seed_m4',
        matchLabel: 'Borussia Dortmund vs Eintracht Frankfurt',
        league: 'Bundesliga',
        marketType: 'TOTAL_GOALS',
        marketLabel: 'Nombre de buts',
        selectionKey: 'OVER_2.5',
        selectionLabel: 'Plus de 2.5 buts',
        odds: 1.55,
        scrapedOdds: 1.50,
        oddsDelta: +0.05,
        hasScrapedOdds: true,
        status: 'PENDING',
        modelProb: '66.2%',
        edgePct: '+8.9%',
      },
    ],
  },
];

export function BetSlipProvider({ children }) {
  // 1. Sélections actuelles dans le panier
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CART);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 2. Tickets placés / enregistrés
  const [tickets, setTickets] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TICKETS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return SEED_TICKETS;
    } catch {
      return SEED_TICKETS;
    }
  });

  // 3. État du drawer coulissant
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 4. Type de pari en cours dans le panier ('ACCUMULATOR' | 'SINGLE')
  const [activeTab, setActiveTab] = useState('ACCUMULATOR');

  // 5. Mise globale pour le combiné
  const [accumulatorStake, setAccumulatorStake] = useState(10.0);

  // Synchronisation localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CART, JSON.stringify(items));
    } catch (e) {
      console.warn('Erreur de sauvegarde du panier:', e);
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TICKETS, JSON.stringify(tickets));
    } catch (e) {
      console.warn('Erreur de sauvegarde des tickets:', e);
    }
  }, [tickets]);

  /**
   * Calcul de la mise optimale optionnelle Kelly Quant V3
   */
  const recommendedKellyStake = useMemo(() => {
    if (items.length === 0) return { stake: 15, pct: 3.0 };

    const kellyPcts = items.map((i) => {
      if (i.kellyStakePct) return parseFloat(String(i.kellyStakePct).replace('%', ''));
      if (i.edgePct) {
        const edgeNum = parseFloat(String(i.edgePct).replace('+', '').replace('%', ''));
        return Math.max(1.0, Math.min(5.0, edgeNum * 0.25 + 1.0));
      }
      return 3.1;
    });

    const avgPct = kellyPcts.reduce((a, b) => a + b, 0) / kellyPcts.length;
    // Sur une bankroll nominale indicative de 500€
    const nominalBankroll = 500.0;
    const computedStake = Math.round(nominalBankroll * (avgPct / 100.0));
    return {
      stake: Math.max(5, Math.min(50, computedStake)),
      pct: Math.round(avgPct * 10) / 10,
    };
  }, [items]);

  /**
   * Ajout d'une sélection au panier (avec traçabilité de cote scrappée vs saisie)
   */
  const addToBetSlip = useCallback((selection) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.matchId === selection.matchId && i.marketType === selection.marketType && i.selectionKey === selection.selectionKey
      );

      const rawScraped = selection.scrapedOdds != null ? parseFloat(selection.scrapedOdds) : (selection.odds ? parseFloat(selection.odds) : null);
      const userOdds = parseFloat(selection.odds) || rawScraped || 2.00;

      const enrichedSelection = {
        ...selection,
        scrapedOdds: rawScraped, // Cote Betclic officielle de référence
        hasScrapedOdds: Boolean(rawScraped && rawScraped > 1.0),
        odds: userOdds, // Cote effectivement validée
        originalOdds: rawScraped,
        stake: selection.stake || 10.0,
      };

      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], ...enrichedSelection };
        return updated;
      }

      // Remplacement si même match et même marché 1N2
      const sameMarketIdx = prev.findIndex(
        (i) => i.matchId === selection.matchId && i.marketType === selection.marketType && selection.marketType === '1N2'
      );

      if (sameMarketIdx !== -1) {
        const updated = [...prev];
        updated[sameMarketIdx] = {
          ...enrichedSelection,
          id: selection.id || `sel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          stake: updated[sameMarketIdx].stake || 10.0,
        };
        return updated;
      }

      return [
        ...prev,
        {
          ...enrichedSelection,
          id: selection.id || `sel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        },
      ];
    });

    setIsDrawerOpen(true);
  }, []);

  /**
   * Retirer une sélection du panier
   */
  const removeFromBetSlip = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /**
   * Modifier une sélection (ex: mise ou cote ajustée manuellement)
   */
  const updateItem = useCallback((id, updates) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  /**
   * Vider le panier
   */
  const clearBetSlip = useCallback(() => {
    setItems([]);
  }, []);

  /**
   * Calculs pour le combiné
   */
  const accumulatorCalculations = useMemo(() => {
    if (items.length === 0) return { totalOdds: 1.0, potentialPayout: 0.0, netProfit: 0.0 };
    const totalOdds = items.reduce((acc, curr) => acc * (parseFloat(curr.odds) || 1.0), 1.0);
    const roundedOdds = Math.round(totalOdds * 100) / 100;
    const potentialPayout = Math.round(accumulatorStake * roundedOdds * 100) / 100;
    const netProfit = Math.round((potentialPayout - accumulatorStake) * 100) / 100;
    return {
      totalOdds: roundedOdds,
      potentialPayout,
      netProfit,
    };
  }, [items, accumulatorStake]);

  /**
   * Calculs pour les paris simples
   */
  const singlesCalculations = useMemo(() => {
    const totalStake = items.reduce((acc, curr) => acc + (parseFloat(curr.stake) || 0.0), 0.0);
    const totalPotentialPayout = items.reduce(
      (acc, curr) => acc + (parseFloat(curr.stake) || 0.0) * (parseFloat(curr.odds) || 1.0),
      0.0
    );
    const netProfit = Math.round((totalPotentialPayout - totalStake) * 100) / 100;
    return {
      totalStake: Math.round(totalStake * 100) / 100,
      totalPotentialPayout: Math.round(totalPotentialPayout * 100) / 100,
      netProfit,
    };
  }, [items]);

  /**
   * Valider le ticket avec stockage de la cote scrappée vs cote jouée (CLV delta)
   */
  const placeTicket = useCallback(
    (customNotes = '') => {
      if (items.length === 0) return null;

      const now = new Date().toISOString();
      const newTickets = [];

      if (activeTab === 'ACCUMULATOR') {
        const tkt = {
          ticketId: `tkt_${Date.now()}`,
          createdAt: now,
          ticketType: 'ACCUMULATOR',
          totalStake: accumulatorStake,
          totalOdds: accumulatorCalculations.totalOdds,
          potentialPayout: accumulatorCalculations.potentialPayout,
          status: 'PENDING',
          resolvedPayout: 0.0,
          notes: customNotes || `Combiné de ${items.length} sélections`,
          selections: items.map((i) => {
            const userOdd = parseFloat(i.odds) || 1.0;
            const scrOdd = i.scrapedOdds != null ? parseFloat(i.scrapedOdds) : null;
            const delta = scrOdd ? Math.round((userOdd - scrOdd) * 100) / 100 : 0.0;
            return {
              selectionId: i.id,
              matchId: i.matchId,
              matchLabel: i.matchLabel,
              league: i.league || 'Football',
              marketType: i.marketType,
              marketLabel: i.marketLabel,
              selectionKey: i.selectionKey,
              selectionLabel: i.selectionLabel,
              odds: userOdd,
              scrapedOdds: scrOdd,
              oddsDelta: delta,
              hasScrapedOdds: Boolean(scrOdd),
              status: 'PENDING',
              modelProb: i.modelProb || null,
              edgePct: i.edgePct || null,
            };
          }),
        };
        newTickets.push(tkt);
      } else {
        // Paris Simples
        items.forEach((item, idx) => {
          const itemStake = parseFloat(item.stake) || 10.0;
          const userOdd = parseFloat(item.odds) || 1.0;
          const scrOdd = item.scrapedOdds != null ? parseFloat(item.scrapedOdds) : null;
          const delta = scrOdd ? Math.round((userOdd - scrOdd) * 100) / 100 : 0.0;
          const tkt = {
            ticketId: `tkt_${Date.now()}_${idx}`,
            createdAt: now,
            ticketType: 'SINGLE',
            totalStake: itemStake,
            totalOdds: userOdd,
            potentialPayout: Math.round(itemStake * userOdd * 100) / 100,
            status: 'PENDING',
            resolvedPayout: 0.0,
            notes: customNotes || `Pari Simple : ${item.selectionLabel}`,
            selections: [
              {
                selectionId: item.id,
                matchId: item.matchId,
                matchLabel: item.matchLabel,
                league: item.league || 'Football',
                marketType: item.marketType,
                marketLabel: item.marketLabel,
                selectionKey: item.selectionKey,
                selectionLabel: item.selectionLabel,
                odds: userOdd,
                scrapedOdds: scrOdd,
                oddsDelta: delta,
                hasScrapedOdds: Boolean(scrOdd),
                status: 'PENDING',
                modelProb: item.modelProb || null,
                edgePct: item.edgePct || null,
              },
            ],
          };
          newTickets.push(tkt);
        });
      }

      setTickets((prev) => [...newTickets, ...prev]);
      setItems([]);
      return newTickets;
    },
    [items, activeTab, accumulatorStake, accumulatorCalculations]
  );

  /**
   * Modification manuelle du statut d'un ticket (Gagné, Perdu, Cashout, Annulé)
   */
  const updateTicketStatus = useCallback((ticketId, newStatus, customPayout = null) => {
    setTickets((prev) =>
      prev.map((tkt) => {
        if (tkt.ticketId !== ticketId) return tkt;

        let payout = 0.0;
        if (customPayout !== null && customPayout !== undefined) {
          payout = parseFloat(customPayout) || 0.0;
        } else if (newStatus === 'WON') {
          payout = tkt.potentialPayout;
        } else if (newStatus === 'LOST') {
          payout = 0.0;
        } else if (newStatus === 'VOID') {
          payout = tkt.totalStake;
        } else if (newStatus === 'CASHOUT') {
          payout = tkt.resolvedPayout > 0 ? tkt.resolvedPayout : Math.round(tkt.totalStake * 0.9 * 100) / 100;
        }

        return {
          ...tkt,
          status: newStatus,
          resolvedPayout: payout,
          selections: tkt.selections.map((s) => ({
            ...s,
            status: newStatus === 'WON' ? 'WON' : newStatus === 'LOST' ? 'LOST' : s.status,
          })),
        };
      })
    );
  }, []);

  /**
   * Supprimer un ticket
   */
  const deleteTicket = useCallback((ticketId) => {
    setTickets((prev) => prev.filter((t) => t.ticketId !== ticketId));
  }, []);

  /**
   * Résolution automatique des tickets en cours par rapport aux matchs terminés
   */
  const autoResolveTicketsAgainstMatches = useCallback((matchesList) => {
    if (!Array.isArray(matchesList) || matchesList.length === 0) return;

    const matchesMap = new Map();
    matchesList.forEach((m) => {
      if (m && m.id) matchesMap.set(String(m.id), m);
    });

    setTickets((prevTickets) => {
      let hasChanges = false;

      const updated = prevTickets.map((tkt) => {
        if (tkt.status !== 'PENDING') return tkt;

        let allFinished = true;
        let anyLost = false;
        let allWon = true;

        const updatedSelections = tkt.selections.map((sel) => {
          const match = matchesMap.get(String(sel.matchId));
          if (!match || match.status !== 'FINISHED' || match.homeScore == null || match.awayScore == null) {
            allFinished = false;
            return sel;
          }

          const hScore = parseInt(match.homeScore, 10);
          const aScore = parseInt(match.awayScore, 10);
          const actualOutcome = hScore > aScore ? '1' : hScore === aScore ? 'N' : '2';

          let selWon = false;

          if (sel.marketType === '1N2') {
            selWon = sel.selectionKey === actualOutcome;
          } else if (sel.marketType === 'TOTAL_GOALS') {
            const tot = hScore + aScore;
            if (sel.selectionKey.includes('OVER_2.5')) selWon = tot > 2.5;
            else if (sel.selectionKey.includes('UNDER_2.5')) selWon = tot < 2.5;
            else if (sel.selectionKey.includes('OVER_1.5')) selWon = tot > 1.5;
            else if (sel.selectionKey.includes('UNDER_1.5')) selWon = tot < 1.5;
            else if (sel.selectionKey.includes('OVER_3.5')) selWon = tot > 3.5;
            else if (sel.selectionKey.includes('UNDER_3.5')) selWon = tot < 3.5;
          } else if (sel.marketType === 'EXACT_SCORE') {
            const exactScore = `${hScore}-${aScore}`;
            selWon = sel.selectionKey === exactScore || sel.selectionLabel.includes(exactScore);
          } else if (sel.marketType === 'GOALSCORER') {
            const scorers = (match.goals || []).map((g) => (typeof g === 'string' ? g : g.player || g.name || '')).filter(Boolean);
            selWon = scorers.some((s) => s.toLowerCase().includes(sel.selectionLabel.toLowerCase()));
          }

          if (selWon) {
            return { ...sel, status: 'WON' };
          } else {
            anyLost = true;
            allWon = false;
            return { ...sel, status: 'LOST' };
          }
        });

        if (anyLost) {
          hasChanges = true;
          return {
            ...tkt,
            status: 'LOST',
            resolvedPayout: 0.0,
            selections: updatedSelections,
          };
        } else if (allFinished && allWon) {
          hasChanges = true;
          return {
            ...tkt,
            status: 'WON',
            resolvedPayout: tkt.potentialPayout,
            selections: updatedSelections,
          };
        }

        return tkt;
      });

      return hasChanges ? updated : prevTickets;
    });
  }, []);

  /**
   * Métriques globales de Bankroll calculées
   */
  const bankrollMetrics = useMemo(() => {
    let totalStaked = 0.0;
    let totalPayout = 0.0;
    let wonCount = 0;
    let lostCount = 0;
    let pendingCount = 0;

    tickets.forEach((t) => {
      totalStaked += t.totalStake;
      if (t.status === 'WON') {
        wonCount++;
        totalPayout += t.resolvedPayout || t.potentialPayout;
      } else if (t.status === 'LOST') {
        lostCount++;
      } else if (t.status === 'PENDING') {
        pendingCount++;
      } else if (t.status === 'CASHOUT') {
        wonCount++;
        totalPayout += t.resolvedPayout;
      }
    });

    const netProfit = totalPayout - totalStaked;
    const evaluatedCount = wonCount + lostCount;
    const hitRate = evaluatedCount > 0 ? (wonCount / evaluatedCount) * 100 : 0.0;
    const roi = totalStaked > 0 ? (netProfit / totalStaked) * 100 : 0.0;

    return {
      totalStaked: Math.round(totalStaked * 100) / 100,
      totalPayout: Math.round(totalPayout * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      wonCount,
      lostCount,
      pendingCount,
      totalTickets: tickets.length,
      hitRate: Math.round(hitRate * 10) / 10,
      roi: Math.round(roi * 10) / 10,
    };
  }, [tickets]);

  const value = useMemo(
    () => ({
      items,
      itemCount: items.length,
      tickets,
      isDrawerOpen,
      setIsDrawerOpen,
      toggleDrawer: () => setIsDrawerOpen((prev) => !prev),
      activeTab,
      setActiveTab,
      accumulatorStake,
      setAccumulatorStake,
      recommendedKellyStake,
      addToBetSlip,
      removeFromBetSlip,
      updateItem,
      clearBetSlip,
      accumulatorCalculations,
      singlesCalculations,
      placeTicket,
      updateTicketStatus,
      deleteTicket,
      autoResolveTicketsAgainstMatches,
      bankrollMetrics,
    }),
    [
      items,
      tickets,
      isDrawerOpen,
      activeTab,
      accumulatorStake,
      recommendedKellyStake,
      addToBetSlip,
      removeFromBetSlip,
      updateItem,
      clearBetSlip,
      accumulatorCalculations,
      singlesCalculations,
      placeTicket,
      updateTicketStatus,
      deleteTicket,
      autoResolveTicketsAgainstMatches,
      bankrollMetrics,
    ]
  );

  return <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>;
}

export function useBetSlip() {
  const context = useContext(BetSlipContext);
  if (!context) {
    throw new Error('useBetSlip doit être utilisé au sein de BetSlipProvider');
  }
  return context;
}
