/**
 * src/components/MyBetsHub.jsx
 * ─────────────────────────────────────────────────────────────
 * Cockpit complet 'Mes Paris & Tickets' :
 * - Sous-onglet A : Gestionnaire de Tickets (Suivi Bankroll, filtres, forçage manuel)
 * - Sous-onglet B : Étude Empirique & Répartition des Value Bets de la base SQLite
 */

import React, { useState, useMemo } from 'react';
import {
  Ticket,
  TrendingUp,
  Award,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Coins,
  ShieldCheck,
  Sparkles,
  BarChart3,
  Calendar,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  PlusCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  ComposedChart,
  Legend,
  Cell,
} from 'recharts';
import { useBetSlip } from '../context/BetSlipContext';
import { useMatch } from '../context/MatchContext';
import TeamLogo from './ui/TeamLogo';
import EMPIRICAL_STUDY from '../data/value_bets_empirical_study.json';

export default function MyBetsHub() {
  const {
    tickets,
    bankrollMetrics,
    updateTicketStatus,
    deleteTicket,
    autoResolveTicketsAgainstMatches,
    setIsDrawerOpen,
  } = useBetSlip();

  const { allMatches } = useMatch();

  // Navigation interne : 'TICKETS' ou 'EMPIRICAL_STUDY'
  const [activeTab, setActiveTab] = useState('TICKETS');

  // Filtre d'état des tickets
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Recherche dans les tickets
  const [searchQuery, setSearchQuery] = useState('');

  // Déclencher la résolution automatique avec les matchs en mémoire
  const handleAutoResolve = () => {
    if (allMatches && allMatches.length > 0) {
      autoResolveTicketsAgainstMatches(allMatches);
    }
  };

  // Filtrage des tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((tkt) => {
      if (statusFilter !== 'ALL' && tkt.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesQuery = tkt.selections.some(
          (s) =>
            s.matchLabel.toLowerCase().includes(query) ||
            s.selectionLabel.toLowerCase().includes(query) ||
            s.marketLabel.toLowerCase().includes(query)
        );
        const notesQuery = (tkt.notes || '').toLowerCase().includes(query);
        return matchesQuery || notesQuery;
      }
      return true;
    });
  }, [tickets, statusFilter, searchQuery]);

  // Données de l'étude empirique
  const { oddsBrackets, edgeBrackets, competitions, insights, modelsSummary } = EMPIRICAL_STUDY;

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* ── HEADER DE LA VUE COCKPIT ── */}
      <div
        className="p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl"
        style={{
          background: 'linear-gradient(135deg, rgba(24, 24, 32, 0.95) 0%, rgba(15, 15, 20, 0.98) 100%)',
          borderColor: 'rgba(245, 240, 232, 0.1)',
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(14, 165, 233, 0.3))',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              color: '#06b6d4',
            }}
          >
            <Ticket size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-cyan-400">
                Predictor Ultimate Cockpit
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Quant Bets & CLV Tracker
              </span>
            </div>
            <h1 className="text-2xl font-black text-zinc-100 mt-0.5">Mes Paris & Suivi de Tickets</h1>
            <p className="text-xs text-zinc-400">
              Gestion de bankroll, arbitrage des cotes Betclic et étude statistique des 337 Value Bets scellés.
            </p>
          </div>
        </div>

        {/* BOUTONS D'ACTION HAUT */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleAutoResolve}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-300 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 transition-all flex items-center gap-2"
            title="Vérifier les résultats officiels des matchs terminés"
          >
            <RefreshCw size={14} />
            Actualiser les Résultats
          </button>
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-black text-black flex items-center gap-2 shadow-lg transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)',
              boxShadow: '0 4px 20px -2px rgba(6, 182, 212, 0.4)',
            }}
          >
            <PlusCircle size={15} />
            Ouvrir mon Panier
          </button>
        </div>
      </div>

      {/* ── COMMUTATEUR PRINCIPAL DES DEUX SOUS-ONGLETS ── */}
      <div className="flex border-b gap-4" style={{ borderColor: 'rgba(245, 240, 232, 0.08)' }}>
        <button
          onClick={() => setActiveTab('TICKETS')}
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'TICKETS'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Ticket size={16} />
          Mes Tickets & Suivi Bankroll ({tickets.length})
        </button>
        <button
          onClick={() => setActiveTab('EMPIRICAL_STUDY')}
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'EMPIRICAL_STUDY'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <BarChart3 size={16} />
          Étude Empirique des Value Bets (Données Base SQLite)
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── SOUS-ONGLET 1 : GESTIONNAIRE DE TICKETS & SUIVI BANKROLL ── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'TICKETS' && (
        <div className="space-y-6">
          {/* KPI CARDS : SUIVI FINANCIER RÉEL */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5">
            {/* Total Misé */}
            <div
              className="p-4 rounded-xl border flex flex-col justify-between"
              style={{ background: 'rgba(28, 28, 35, 0.7)', borderColor: 'rgba(245, 240, 232, 0.08)' }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Misé</span>
              <div className="mt-2">
                <span className="text-xl font-black text-zinc-100">{bankrollMetrics.totalStaked.toFixed(2)} €</span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">{bankrollMetrics.totalTickets} ticket(s)</span>
              </div>
            </div>

            {/* Total Retours */}
            <div
              className="p-4 rounded-xl border flex flex-col justify-between"
              style={{ background: 'rgba(28, 28, 35, 0.7)', borderColor: 'rgba(245, 240, 232, 0.08)' }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Retours Bruts</span>
              <div className="mt-2">
                <span className="text-xl font-black text-emerald-400">
                  {bankrollMetrics.totalPayout.toFixed(2)} €
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Gains & Cashouts</span>
              </div>
            </div>

            {/* P&L Net */}
            <div
              className="p-4 rounded-xl border flex flex-col justify-between"
              style={{
                background:
                  bankrollMetrics.netProfit >= 0
                    ? 'rgba(16, 185, 129, 0.08)'
                    : 'rgba(239, 68, 68, 0.08)',
                borderColor:
                  bankrollMetrics.netProfit >= 0
                    ? 'rgba(16, 185, 129, 0.25)'
                    : 'rgba(239, 68, 68, 0.25)',
              }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">P&L Net Réel</span>
              <div className="mt-2">
                <span
                  className={`text-xl font-black ${
                    bankrollMetrics.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {bankrollMetrics.netProfit >= 0 ? '+' : ''}
                  {bankrollMetrics.netProfit.toFixed(2)} €
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Profit net comptabilisé</span>
              </div>
            </div>

            {/* ROI */}
            <div
              className="p-4 rounded-xl border flex flex-col justify-between"
              style={{ background: 'rgba(28, 28, 35, 0.7)', borderColor: 'rgba(245, 240, 232, 0.08)' }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">R.O.I. Global</span>
              <div className="mt-2">
                <span
                  className={`text-xl font-black ${
                    bankrollMetrics.roi >= 0 ? 'text-cyan-400' : 'text-amber-400'
                  }`}
                >
                  {bankrollMetrics.roi >= 0 ? '+' : ''}
                  {bankrollMetrics.roi.toFixed(1)}%
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Rendement sur mises</span>
              </div>
            </div>

            {/* Hit Rate */}
            <div
              className="p-4 rounded-xl border flex flex-col justify-between"
              style={{ background: 'rgba(28, 28, 35, 0.7)', borderColor: 'rgba(245, 240, 232, 0.08)' }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Taux de Réussite</span>
              <div className="mt-2">
                <span className="text-xl font-black text-zinc-100">{bankrollMetrics.hitRate.toFixed(1)}%</span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">
                  {bankrollMetrics.wonCount} G / {bankrollMetrics.lostCount} P
                </span>
              </div>
            </div>

            {/* En cours */}
            <div
              className="p-4 rounded-xl border flex flex-col justify-between"
              style={{ background: 'rgba(28, 28, 35, 0.7)', borderColor: 'rgba(245, 240, 232, 0.08)' }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">En Attente</span>
              <div className="mt-2">
                <span className="text-xl font-black text-amber-400">{bankrollMetrics.pendingCount}</span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Matchs non terminés</span>
              </div>
            </div>
          </div>

          {/* BARRE D'OUTILS ET FILTRES DES TICKETS */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            {/* Filtres de statut */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold w-full sm:w-auto overflow-x-auto">
              {[
                { id: 'ALL', label: `Tous (${tickets.length})` },
                { id: 'PENDING', label: `En cours (${bankrollMetrics.pendingCount})` },
                { id: 'WON', label: `Gagnés (${bankrollMetrics.wonCount})` },
                { id: 'LOST', label: `Perdus (${bankrollMetrics.lostCount})` },
                { id: 'CASHOUT', label: 'Cashout' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`py-1.5 px-3 rounded-lg transition-all whitespace-nowrap ${
                    statusFilter === f.id
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Barre de recherche */}
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-3 text-zinc-500" />
              <input
                type="text"
                placeholder="Filtrer par match, équipe, note..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* LISTE DES TICKETS ENREGISTRÉS */}
          <div className="space-y-4">
            {filteredTickets.length === 0 ? (
              <div
                className="p-12 text-center rounded-2xl border flex flex-col items-center justify-center text-zinc-500"
                style={{ background: 'rgba(28, 28, 35, 0.4)', borderColor: 'rgba(245, 240, 232, 0.08)' }}
              >
                <Ticket size={36} className="text-zinc-600 mb-3" />
                <h3 className="text-sm font-bold text-zinc-300">Aucun ticket trouvé</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                  Ajoutez des sélections depuis le Daily Betting Hub ou ajustez vos critères de filtrage.
                </p>
              </div>
            ) : (
              filteredTickets.map((tkt) => {
                const isWon = tkt.status === 'WON';
                const isLost = tkt.status === 'LOST';
                const isPending = tkt.status === 'PENDING';
                const isCashout = tkt.status === 'CASHOUT';

                return (
                  <div
                    key={tkt.ticketId}
                    className="p-5 rounded-2xl border transition-all duration-200 hover:border-zinc-700 space-y-4"
                    style={{
                      background: 'rgba(24, 24, 30, 0.85)',
                      borderColor: isWon
                        ? 'rgba(16, 185, 129, 0.3)'
                        : isLost
                        ? 'rgba(239, 68, 68, 0.25)'
                        : 'rgba(245, 240, 232, 0.08)',
                    }}
                  >
                    {/* Header du Ticket */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider"
                          style={{
                            background:
                              tkt.ticketType === 'ACCUMULATOR'
                                ? 'rgba(6, 182, 212, 0.15)'
                                : 'rgba(245, 240, 232, 0.08)',
                            color: tkt.ticketType === 'ACCUMULATOR' ? '#06b6d4' : '#e4e4e7',
                          }}
                        >
                          {tkt.ticketType === 'ACCUMULATOR'
                            ? `Combiné (${tkt.selections.length})`
                            : 'Pari Simple'}
                        </span>

                        {/* Statut Badge */}
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1.5 ${
                            isWon
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : isLost
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : isCashout
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {isWon && <CheckCircle2 size={13} />}
                          {isLost && <XCircle size={13} />}
                          {isPending && <Clock size={13} />}
                          {isCashout && <Coins size={13} />}
                          {isWon
                            ? 'GAGNÉ'
                            : isLost
                            ? 'PERDU'
                            : isCashout
                            ? 'CASHOUT'
                            : 'EN COURS'}
                        </span>

                        <span className="text-xs text-zinc-500">
                          {new Date(tkt.createdAt).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Contrôles manuels du ticket */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                          onClick={() => updateTicketStatus(tkt.ticketId, 'WON')}
                          className="px-2 py-1 rounded text-xs font-bold text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          title="Forcer comme Gagné"
                        >
                          Gagné
                        </button>
                        <button
                          onClick={() => updateTicketStatus(tkt.ticketId, 'LOST')}
                          className="px-2 py-1 rounded text-xs font-bold text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Forcer comme Perdu"
                        >
                          Perdu
                        </button>
                        <button
                          onClick={() => {
                            const cashoutAmt = prompt(
                              'Montant du Cashout obtenu (€) :',
                              String(Math.round(tkt.totalStake * 0.9 * 100) / 100)
                            );
                            if (cashoutAmt !== null) {
                              updateTicketStatus(tkt.ticketId, 'CASHOUT', parseFloat(cashoutAmt) || 0);
                            }
                          }}
                          className="px-2 py-1 rounded text-xs font-bold text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="Déclarer un Cashout"
                        >
                          Cashout
                        </button>
                        <button
                          onClick={() => deleteTicket(tkt.ticketId)}
                          className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Supprimer ce ticket"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Sélections contenues dans le ticket */}
                    <div className="space-y-2">
                      {tkt.selections.map((sel, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                              {sel.league} · {sel.matchLabel}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-bold text-zinc-200">{sel.selectionLabel}</span>
                              <span className="text-[10px] text-zinc-500 font-medium">({sel.marketLabel})</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {sel.edgePct && (
                              <span className="text-[10px] font-black text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded font-mono">
                                Edge {sel.edgePct}
                              </span>
                            )}
                            {sel.scrapedOdds && (
                              <span className="text-[10px] text-zinc-500 font-mono hidden md:inline">
                                Réf: @{Number(sel.scrapedOdds).toFixed(2)}
                              </span>
                            )}
                            {sel.oddsDelta != null && sel.oddsDelta !== 0 && (
                              <span
                                className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                                  sel.oddsDelta > 0
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}
                                title="Écart CLV par rapport à la cote scrapée Betclic"
                              >
                                Δ {sel.oddsDelta > 0 ? `+${sel.oddsDelta.toFixed(2)}` : sel.oddsDelta.toFixed(2)}
                              </span>
                            )}
                            <span className="text-sm font-black text-cyan-300 font-mono">
                              @{sel.odds ? sel.odds.toFixed(2) : '1.00'}
                            </span>
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                sel.status === 'WON'
                                  ? 'bg-emerald-400'
                                  : sel.status === 'LOST'
                                  ? 'bg-red-400'
                                  : 'bg-amber-400'
                              }`}
                              title={sel.status}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer du Ticket avec Mises & Résultats */}
                    <div
                      className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      style={{
                        background: 'rgba(20, 20, 25, 0.95)',
                        borderColor: 'rgba(245, 240, 232, 0.08)',
                      }}
                    >
                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className="text-[10px] text-zinc-500 block uppercase font-bold">Mise Réelle</span>
                          <span className="text-sm font-black text-zinc-200">{tkt.totalStake.toFixed(2)} €</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 block uppercase font-bold">Cote Totale</span>
                          <span className="text-sm font-black text-cyan-400">{tkt.totalOdds.toFixed(2)}</span>
                        </div>
                        {tkt.notes && (
                          <div className="hidden md:block">
                            <span className="text-[10px] text-zinc-500 block uppercase font-bold">Note</span>
                            <span className="text-xs text-zinc-400 italic">« {tkt.notes} »</span>
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-zinc-500 block uppercase font-bold">
                          {isWon ? 'Gains Réalisés' : isCashout ? 'Montant Cashout' : 'Gain Potentiel Brut'}
                        </span>
                        <span
                          className={`text-base font-black ${
                            isWon
                              ? 'text-emerald-400'
                              : isLost
                              ? 'text-zinc-500 line-through'
                              : 'text-cyan-400'
                          }`}
                        >
                          {isWon
                            ? `${(tkt.resolvedPayout || tkt.potentialPayout).toFixed(2)} €`
                            : isCashout
                            ? `${tkt.resolvedPayout.toFixed(2)} €`
                            : `${tkt.potentialPayout.toFixed(2)} €`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── SOUS-ONGLET 2 : ÉTUDE & RÉPARTITION DES VALUE BETS (SQLITE) ── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'EMPIRICAL_STUDY' && (
        <div className="space-y-6">
          {/* BANNIÈRE MÉTHODOLOGIQUE */}
          <div
            className="p-5 rounded-2xl border"
            style={{
              background: 'rgba(6, 182, 212, 0.05)',
              borderColor: 'rgba(6, 182, 212, 0.25)',
            }}
          >
            <div className="flex items-start gap-3">
              <ShieldCheck size={22} className="text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs text-zinc-300 leading-relaxed">
                <h3 className="text-sm font-black text-cyan-300">
                  Rapport Officiel de Rétro-Ingénierie & Distribution des Value Bets
                </h3>
                <p>
                  Audit réalisé sur l'intégralité des <strong>{EMPIRICAL_STUDY.totalMatchesEvaluated} rencontres</strong> scellées
                  dans la table <code>fact_model_predictions</code> de la base <code>predictor_v2.db</code>. Le modèle
                  Quant V3 utilise la <strong>dé-margination de Shin (1993)</strong> pour corriger le biais favori-longshot
                  et filtre les opportunités avec un seuil strict $EV \ge 2.0\%$ ou $Edge_{Shin} \ge 2.5\%$.
                </p>
              </div>
            </div>
          </div>

          {/* 4 KPIS MAJEURS DE L'ÉTUDE */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              className="p-4 rounded-xl border text-center"
              style={{ background: 'rgba(28, 28, 35, 0.7)', borderColor: 'rgba(245, 240, 232, 0.08)' }}
            >
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Total Value Bets Détectés
              </span>
              <span className="text-2xl font-black text-cyan-400 mt-1 block">{insights.totalVbsV3}</span>
              <span className="text-[10px] text-zinc-500">15.7% des matchs scellés</span>
            </div>

            <div
              className="p-4 rounded-xl border text-center"
              style={{ background: 'rgba(28, 28, 35, 0.7)', borderColor: 'rgba(245, 240, 232, 0.08)' }}
            >
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Hit Rate Global Réel
              </span>
              <span className="text-2xl font-black text-emerald-400 mt-1 block">{insights.overallHitRate}%</span>
              <span className="text-[10px] text-zinc-500">72 victoires certifiées</span>
            </div>

            <div
              className="p-4 rounded-xl border text-center"
              style={{ background: 'rgba(28, 28, 35, 0.7)', borderColor: 'rgba(245, 240, 232, 0.08)' }}
            >
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Edge Théorique Moyen
              </span>
              <span className="text-2xl font-black text-cyan-300 mt-1 block">
                +{modelsSummary[2]?.avgEdgePct || 74.7}%
              </span>
              <span className="text-[10px] text-zinc-500">Face aux cotes Betclic</span>
            </div>

            <div
              className="p-4 rounded-xl border text-center"
              style={{ background: 'rgba(28, 28, 35, 0.7)', borderColor: 'rgba(245, 240, 232, 0.08)' }}
            >
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Mise Kelly Suggérée
              </span>
              <span className="text-2xl font-black text-zinc-100 mt-1 block">
                {modelsSummary[2]?.avgKellyStakePct || 3.11}%
              </span>
              <span className="text-[10px] text-zinc-500">Quarter-Kelly fractionnaire</span>
            </div>
          </div>

          {/* ── GRAPHIQUE 1 : RÉPARTITION PAR TRANCHES DE COTES (VOLUME & HIT RATE) ── */}
          <div
            className="p-5 rounded-2xl border space-y-4"
            style={{ background: 'rgba(24, 24, 30, 0.85)', borderColor: 'rgba(245, 240, 232, 0.08)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-zinc-100 flex items-center gap-2">
                  <BarChart3 size={16} className="text-cyan-400" />
                  Répartition des Value Bets par Tranches de Cotes (Volume & Hit Rate)
                </h3>
                <p className="text-xs text-zinc-400">
                  Mise en évidence de la concentration des paris et du décrochage du Hit Rate sur les cotes &gt; 5.00
                </p>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={oddsBrackets} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid stroke="rgba(245, 240, 232, 0.06)" strokeDasharray="3 3" />
                  <XAxis dataKey="bracket" stroke="#71717a" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#71717a" fontSize={11} tickLine={false} label={{ value: 'Nombre de Paris', angle: -90, position: 'insideLeft', fill: '#71717a', fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#06b6d4" fontSize={11} tickLine={false} unit="%" label={{ value: 'Hit Rate %', angle: 90, position: 'insideRight', fill: '#06b6d4', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(18, 18, 24, 0.95)',
                      border: '1px solid rgba(245, 240, 232, 0.15)',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar yAxisId="left" dataKey="count" name="Nombre de Value Bets" fill="#3f3f46" radius={[6, 6, 0, 0]}>
                    {oddsBrackets.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index < 3 ? '#06b6d4' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="hitRatePct" name="Taux de Réussite Réel (%)" stroke="#10b981" strokeWidth={3} dot={{ r: 5, fill: '#10b981' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── GRAPHIQUE 2 : DISTRIBUTION PAR TRANCHES D'EDGE (%) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Edge Brackets */}
            <div
              className="p-5 rounded-2xl border space-y-3"
              style={{ background: 'rgba(24, 24, 30, 0.85)', borderColor: 'rgba(245, 240, 232, 0.08)' }}
            >
              <h3 className="text-sm font-black text-zinc-100 flex items-center gap-2">
                <Percent size={16} className="text-cyan-400" />
                Distribution par Tranches d'Edge Théorique
              </h3>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={edgeBrackets} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid stroke="rgba(245, 240, 232, 0.06)" strokeDasharray="3 3" />
                    <XAxis dataKey="bracket" stroke="#71717a" fontSize={10} tickLine={false} />
                    <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(18, 18, 24, 0.95)',
                        border: '1px solid rgba(245, 240, 232, 0.15)',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" name="Nombre de paris" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance par Compétition */}
            <div
              className="p-5 rounded-2xl border space-y-3"
              style={{ background: 'rgba(24, 24, 30, 0.85)', borderColor: 'rgba(245, 240, 232, 0.08)' }}
            >
              <h3 className="text-sm font-black text-zinc-100 flex items-center gap-2">
                <Trophy size={16} className="text-amber-400" />
                Performance des Value Bets par Compétition
              </h3>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {competitions.map((comp, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-zinc-200 block">{comp.competition}</span>
                      <span className="text-[10px] text-zinc-500">
                        {comp.count} VBs · {comp.hits} Hits ({comp.hitRatePct}%)
                      </span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-black ${
                          comp.roiPct >= 0 ? 'text-emerald-400' : comp.roiPct >= -10 ? 'text-amber-400' : 'text-red-400'
                        }`}
                      >
                        {comp.roiPct >= 0 ? '+' : ''}{comp.roiPct}% ROI
                      </span>
                      <span className="text-[10px] text-zinc-500 block">Cote moy. {comp.avgOdd}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── ENSEIGNEMENTS STRATÉGIQUES & RECOMMANDATIONS QUANTITATIVES ── */}
          <div
            className="p-6 rounded-2xl border space-y-3"
            style={{
              background: 'linear-gradient(135deg, rgba(28, 28, 35, 0.9) 0%, rgba(20, 20, 26, 0.95) 100%)',
              borderColor: 'rgba(245, 240, 232, 0.1)',
            }}
          >
            <h3 className="text-sm font-black text-cyan-300 flex items-center gap-2">
              <Sparkles size={16} />
              Diagnostic Quantitatif & Ajustements Conseillés
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-300 pt-2">
              <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-1.5">
                <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                  1. Zone d'Efficacité [2.00 - 5.00]
                </span>
                <p className="text-zinc-400 leading-relaxed">
                  Les cotes comprises entre 2.00 et 5.00 regroupent <strong>64.1% des Value Bets</strong> avec un Hit Rate
                  très honorable de 22% à 32%. C'est le cœur liquide du marché où la dé-margination de Shin apporte une vraie valeur prédictive.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-1.5">
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  2. Dérive sur les Outsiders Extrêmes (&gt; 5.00)
                </span>
                <p className="text-zinc-400 leading-relaxed">
                  Sur les cotes &gt; 5.00, le modèle génère des Edges théoriques astronomiques (&gt; 100%) mais le Hit Rate
                  chute sous les 9%. La variance y détruit le ROI.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-1.5">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  3. Résistance Exceptionnelle en Coupes d'Europe
                </span>
                <p className="text-zinc-400 leading-relaxed">
                  La Ligue Europa (<strong>+0.4% de ROI</strong>) et la Ligue des Champions (<strong>-5.3%</strong>) battent
                  nettement les championnats domestiques, confirmant la pertinence de l'analyse contextuelle et du moteur RAG.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-1.5">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  4. Règle Recommandée pour vos Tickets
                </span>
                <p className="text-zinc-400 leading-relaxed">
                  Pour maximiser la rentabilité réelle de vos paris, appliquez un <strong>filtre de cote maximale à 5.00</strong> dans
                  votre panier pour éliminer la queue de distribution à forte variance.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
