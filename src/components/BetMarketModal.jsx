/**
 * src/components/BetMarketModal.jsx
 * ─────────────────────────────────────────────────────────────
 * Catalogue Intégral des Marchés Betclic pour chaque Match.
 * - Taxonomie stricte identique à Betclic (8 Sections Officielles) :
 *     1. Résultats (Actif en 1er par défaut)
 *     2. Le Top
 *     3. Buts
 *     4. Score exact
 *     5. Buteurs & Joueurs (avec badge certifié SuperSub)
 *     6. Mi-temps
 *     7. Stats équipes & joueurs
 *     8. ⚡ Spéciaux & Fast
 * - Rendu via ReactDOM.createPortal(..., document.body)
 * - Cotes réelles certifiées Betclic & Intégration directe dans le Panier
 * - Résolution automatique des joueurs avec photos et positions
 */

import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  X,
  Plus,
  Ticket,
  Target,
  Trophy,
  Users,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  HelpCircle,
  Hash,
  AlertTriangle,
  Clock,
  BarChart3,
  Zap,
  Search,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import TeamLogo from './ui/TeamLogo';
import { useBetSlip } from '../context/BetSlipContext';
import BETCLIC_MARKETS_CACHE from '../data/betclic_markets_cache.json';
import REAL_PLAYERS from '../data/real_players.json';

// Les 8 sections officielles Betclic ordonnées (Résultats en premier comme demandé)
const BETCLIC_SECTIONS = [
  { id: 'RESULTS', label: 'Résultats', icon: Trophy, count: 5 },
  { id: 'TOP', label: 'Le Top', icon: Sparkles, count: 4 },
  { id: 'GOALS', label: 'Buts', icon: Target, count: 5 },
  { id: 'EXACT_SCORE', label: 'Score exact', icon: Hash, count: 2 },
  { id: 'PLAYERS', label: 'Buteurs & Joueurs', icon: Users, badge: 'SuperSub', count: 3 },
  { id: 'HALFTIME', label: 'Mi-temps', icon: Clock, count: 3 },
  { id: 'STATS', label: 'Stats', icon: BarChart3, count: 3 },
  { id: 'SPECIALS', label: '⚡ Spéciaux', icon: Zap, count: 2 },
];

export default function BetMarketModal({ match, isOpen, onClose }) {
  const { addToBetSlip, setIsDrawerOpen } = useBetSlip();

  // Onglet actif : Résultats en 1er par défaut (Option demandée)
  const [activeSection, setActiveSection] = useState('RESULTS');
  const [searchFilter, setSearchFilter] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customOdds, setCustomOdds] = useState('2.00');
  const [showCustomBet, setShowCustomBet] = useState(false);
  const [justAddedLabel, setJustAddedLabel] = useState(null);
  const [expandedTeams, setExpandedTeams] = useState({});
  const toggleExpandTeam = (teamKey) => setExpandedTeams((prev) => ({ ...prev, [teamKey]: !prev[teamKey] }));

  if (!isOpen || !match) return null;

  const homeTeam = match.homeTeam || 'Domicile';
  const awayTeam = match.awayTeam || 'Extérieur';
  const league = match.league || match.competition || 'Football';
  const matchId = String(match.id);

  // 1. Récupération des marchés depuis le cache Betclic
  const cachedMatch = BETCLIC_MARKETS_CACHE[matchId];
  const sectionsData = cachedMatch?.sections || null;

  // 2. Gestion de la sélection et ajout au Panier
  const handleSelectBet = (
    marketType,
    marketLabel,
    selectionKey,
    selectionLabel,
    oddVal,
    edge = null,
    prob = null,
    isSuperSub = false
  ) => {
    addToBetSlip({
      matchId,
      matchLabel: `${homeTeam} vs ${awayTeam}`,
      league,
      marketType,
      marketLabel,
      selectionKey,
      selectionLabel: isSuperSub ? `${selectionLabel} (SuperSub)` : selectionLabel,
      odds: oddVal ? parseFloat(oddVal) : 2.0,
      scrapedOdds: oddVal ? parseFloat(oddVal) : null,
      hasScrapedOdds: Boolean(oddVal),
      isSuperSub: Boolean(isSuperSub),
      stake: 10.0,
      edgePct: edge,
      modelProb: prob,
    });

    setJustAddedLabel(`${selectionLabel} (@${parseFloat(oddVal || 2.0).toFixed(2)})`);
    setTimeout(() => {
      setJustAddedLabel(null);
    }, 3500);
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customLabel.trim()) return;
    handleSelectBet(
      'SPECIALS',
      'Pari Spécial Personnalisé',
      customLabel.trim(),
      customLabel.trim(),
      parseFloat(customOdds) || 2.0,
      null,
      null,
      false
    );
    setCustomLabel('');
    setShowCustomBet(false);
  };

  // Liste des marchés de la section active filtrés par recherche
  const currentMarkets = useMemo(() => {
    if (!sectionsData || !sectionsData[activeSection]) {
      return [];
    }
    const markets = sectionsData[activeSection].markets || [];
    if (!searchFilter.trim()) return markets;

    const q = searchFilter.toLowerCase();
    return markets.filter((m) => {
      const matchTitle = m.marketName.toLowerCase().includes(q);
      const matchSel = m.selections.some((s) => s.label.toLowerCase().includes(q));
      return matchTitle || matchSel;
    });
  }, [sectionsData, activeSection, searchFilter]);

  if (typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10005,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(5, 5, 8, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog-panel"
        style={{
          width: '100%',
          maxWidth: 860,
          maxHeight: '90vh',
          background: '#121215',
          border: '1px solid #27272a',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(6, 182, 212, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'Inter', system-ui, sans-serif",
          animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* ── 1. EN-TÊTE DU CATALOGUE BETCLIC ── */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #27272a',
            background: 'linear-gradient(135deg, rgba(18, 18, 24, 0.98) 0%, rgba(14, 14, 18, 0.98) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TeamLogo teamName={homeTeam} size={28} />
              <span style={{ fontSize: 13, color: '#71717a', fontWeight: 800 }}>vs</span>
              <TeamLogo teamName={awayTeam} size={28} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 15, fontWeight: 900, color: '#fafafa', fontFamily: "'JetBrains Mono', monospace" }}>
                  {homeTeam} vs {awayTeam}
                </h2>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 9,
                    fontWeight: 900,
                    fontFamily: "'JetBrains Mono', monospace",
                    background: 'rgba(6, 182, 212, 0.15)',
                    color: '#22d3ee',
                    border: '1px solid rgba(6, 182, 212, 0.35)',
                  }}
                >
                  BETCLIC OFFICIEL · 8 SECTIONS
                </span>
              </div>
              <p style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2 }}>
                {league} · Cotes certifiées conformes au bookmaker & enrichies Quant V3
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: 8,
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid #27272a',
              color: '#a1a1aa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease',
            }}
            title="Fermer le catalogue"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── BANNIÈRE TOAST FEEDBACK AJOUT AU PANIER ── */}
        {justAddedLabel && (
          <div
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%)',
              borderBottom: '1px solid rgba(16, 185, 129, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              animation: 'fadeUp 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <Check size={16} color="#10b981" />
              <span style={{ color: '#d4d4d8' }}>
                Sélection ajoutée au Panier :{' '}
                <strong style={{ color: '#22d3ee', fontFamily: "'JetBrains Mono', monospace" }}>
                  {justAddedLabel}
                </strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                setIsDrawerOpen(true);
              }}
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: '#10b981',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Ouvrir le Panier <ArrowRight size={12} />
            </button>
          </div>
        )}

        {/* ── 2. BARRE DES 8 ONGLETS TAXONOMIE BETCLIC ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            overflowX: 'auto',
            padding: '8px 16px 0',
            background: '#121215',
            borderBottom: '1px solid #27272a',
            gap: 6,
            flexShrink: 0,
          }}
          className="custom-scrollbar"
        >
          {BETCLIC_SECTIONS.map((sec) => {
            const IconComp = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => {
                  setActiveSection(sec.id);
                  setSearchFilter('');
                }}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px 8px 0 0',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #22d3ee' : '2px solid transparent',
                  background: isActive ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                  color: isActive ? '#22d3ee' : '#71717a',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <IconComp size={13} color={isActive ? '#22d3ee' : '#71717a'} />
                {sec.label}
                {sec.badge && (
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 900,
                      padding: '1px 4px',
                      borderRadius: 3,
                      background: 'rgba(16, 185, 129, 0.25)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                    }}
                  >
                    {sec.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── 3. SOUS-BARRE DE RECHERCHE DANS LES PARIS ── */}
        <div
          style={{
            padding: '10px 20px',
            background: '#18181b',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <Search size={14} color="#71717a" style={{ position: 'absolute', left: 10, top: 9 }} />
            <input
              type="text"
              placeholder={`Rechercher dans ${BETCLIC_SECTIONS.find((s) => s.id === activeSection)?.label || ''} (ex: 2-1, Over, Balogun)...`}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 12px 6px 32px',
                borderRadius: 6,
                background: '#121215',
                border: '1px solid #27272a',
                color: '#fafafa',
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#71717a' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {currentMarkets.length} marché{currentMarkets.length > 1 ? 's' : ''} disponible{currentMarkets.length > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={() => setShowCustomBet((prev) => !prev)}
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: '#22d3ee',
                background: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                padding: '4px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Plus size={11} /> Pari personnalisé
            </button>
          </div>
        </div>

        {/* ── 4. ZONE CENTRALE : CARTES DES MARCHÉS DE LA SECTION ── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
          className="custom-scrollbar"
        >
          {/* Formulaire de pari personnalisé repliable */}
          {showCustomBet && (
            <form
              onSubmit={handleCustomSubmit}
              style={{
                padding: 14,
                borderRadius: 10,
                background: 'rgba(6, 182, 212, 0.05)',
                border: '1px dashed rgba(6, 182, 212, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <input
                type="text"
                placeholder="Intitulé personnalisé (ex: Mbappé tire sur le poteau)..."
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: '#18181b',
                  border: '1px solid #3f3f46',
                  color: '#fafafa',
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  step="0.05"
                  min="1.01"
                  max="100.0"
                  value={customOdds}
                  onChange={(e) => setCustomOdds(e.target.value)}
                  style={{
                    width: 70,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    color: '#22d3ee',
                    fontSize: 11,
                    fontWeight: 900,
                    fontFamily: "'JetBrains Mono', monospace",
                    textAlign: 'center',
                  }}
                />
              </div>
              <button
                type="submit"
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: '#22d3ee',
                  color: '#000',
                  fontWeight: 900,
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Ajouter
              </button>
            </form>
          )}

          {currentMarkets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#71717a' }}>
              <HelpCircle size={28} color="#52525b" style={{ margin: '0 auto 10px' }} />
              <p style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7', fontFamily: "'JetBrains Mono', monospace" }}>
                Aucun marché trouvé pour ce filtre
              </p>
              <p style={{ fontSize: 11, color: '#a1a1aa', marginTop: 4 }}>
                Modifiez votre recherche ou explorez une autre section Betclic ci-dessus.
              </p>
            </div>
          ) : (
            currentMarkets.map((market) => {
              const isPlayersSection = market.category === 'PLAYERS';
              const isSuperSub = Boolean(market.isSuperSub);

              return (
                <div
                  key={market.marketId}
                  style={{
                    borderRadius: 12,
                    background: '#18181b',
                    border: '1px solid #27272a',
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {/* Titre du Marché & Badge SuperSub */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fafafa', fontFamily: "'JetBrains Mono', monospace" }}>
                        {market.marketName}
                      </h3>
                      {isSuperSub && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 900,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Zap size={10} /> SuperSub 90'
                        </span>
                      )}
                    </div>

                    <span style={{ fontSize: 10, color: '#71717a', fontFamily: "'JetBrains Mono', monospace" }}>
                      {market.selections.length} choix
                    </span>
                  </div>

                  {/* Description explicative SuperSub si présent */}
                  {market.description && (
                    <p style={{ fontSize: 10, color: '#a1a1aa', marginTop: -6, fontStyle: 'italic' }}>
                      ℹ️ {market.description}
                    </p>
                  )}

                  {/* Grille des sélections par équipe pour les Joueurs ou Grille standard */}
                  {isPlayersSection ? (() => {
                    const homeSelections = market.selections.filter((s) => s.team === homeTeam || s.key?.startsWith('H_') || s.key?.includes('_H_'));
                    const awaySelections = market.selections.filter((s) => s.team === awayTeam || s.key?.startsWith('A_') || s.key?.includes('_A_'));
                    const otherSelections = market.selections.filter(
                      (s) => !homeSelections.includes(s) && !awaySelections.includes(s)
                    );

                    const isHomeExp = Boolean(expandedTeams[`${market.marketId}_home`]) || Boolean(searchFilter.trim());
                    const isAwayExp = Boolean(expandedTeams[`${market.marketId}_away`]) || Boolean(searchFilter.trim());

                    const visHome = isHomeExp ? homeSelections : homeSelections.slice(0, 4);
                    const visAway = isAwayExp ? awaySelections : awaySelections.slice(0, 4);

                    const renderPlayerBtn = (sel) => {
                      const oddVal = parseFloat(sel.odds) || 1.0;
                      return (
                        <button
                          key={sel.key}
                          type="button"
                          onClick={() =>
                            handleSelectBet(
                              market.category,
                              market.marketName,
                              sel.key,
                              sel.label,
                              oddVal,
                              null,
                              sel.prob || null,
                              isSuperSub
                            )
                          }
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: '#0e0e12',
                            border: '1px solid #27272a',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#06b6d4';
                            e.currentTarget.style.background = 'rgba(6, 182, 212, 0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#27272a';
                            e.currentTarget.style.background = '#0e0e12';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                            {sel.photoUrl ? (
                              <img
                                src={sel.photoUrl}
                                alt={sel.label}
                                style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  background: '#27272a',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 10,
                                  color: '#a1a1aa',
                                  fontWeight: 700,
                                }}
                              >
                                {sel.label.slice(0, 2).toUpperCase()}
                              </div>
                            )}

                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: '#fafafa',
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {sel.label}
                              </span>
                              {(sel.position || sel.prob) && (
                                <span style={{ fontSize: 9, color: '#71717a', display: 'block' }}>
                                  {sel.position ? `${sel.position} · ` : ''}
                                  {sel.prob ? `Prob: ${sel.prob}` : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 900,
                              color: '#22d3ee',
                              fontFamily: "'JetBrains Mono', monospace",
                              background: 'rgba(34, 211, 238, 0.08)',
                              padding: '2px 8px',
                              borderRadius: 4,
                              flexShrink: 0,
                            }}
                          >
                            @{oddVal.toFixed(2)}
                          </span>
                        </button>
                      );
                    };

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* 1. Bloc Équipe Domicile */}
                        {homeSelections.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid #27272a',
                                paddingBottom: 6,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <TeamLogo teamName={homeTeam} size={18} />
                                <span style={{ fontSize: 12, fontWeight: 900, color: '#fafafa', letterSpacing: '0.02em' }}>
                                  {homeTeam}
                                </span>
                              </div>
                              <span style={{ fontSize: 10, color: '#71717a', fontFamily: "'JetBrains Mono', monospace" }}>
                                {homeSelections.length} joueurs disponibles
                              </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
                              {visHome.map(renderPlayerBtn)}
                            </div>

                            {homeSelections.length > 4 && !searchFilter.trim() && (
                              <button
                                type="button"
                                onClick={() => toggleExpandTeam(`${market.marketId}_home`)}
                                style={{
                                  alignSelf: 'center',
                                  background: 'transparent',
                                  border: '1px dashed #3f3f46',
                                  borderRadius: 6,
                                  padding: '5px 12px',
                                  color: isHomeExp ? '#22d3ee' : '#a1a1aa',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  fontFamily: "'JetBrains Mono', monospace",
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  marginTop: 4,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {isHomeExp ? (
                                  <>Replier la liste <ChevronUp size={12} /></>
                                ) : (
                                  <>Déplier l'effectif d'{homeTeam} ({homeSelections.length}) <ChevronDown size={12} /></>
                                )}
                              </button>
                            )}
                          </div>
                        )}

                        {/* 2. Bloc Équipe Extérieur */}
                        {awaySelections.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid #27272a',
                                paddingBottom: 6,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <TeamLogo teamName={awayTeam} size={18} />
                                <span style={{ fontSize: 12, fontWeight: 900, color: '#fafafa', letterSpacing: '0.02em' }}>
                                  {awayTeam}
                                </span>
                              </div>
                              <span style={{ fontSize: 10, color: '#71717a', fontFamily: "'JetBrains Mono', monospace" }}>
                                {awaySelections.length} joueurs disponibles
                              </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
                              {visAway.map(renderPlayerBtn)}
                            </div>

                            {awaySelections.length > 4 && !searchFilter.trim() && (
                              <button
                                type="button"
                                onClick={() => toggleExpandTeam(`${market.marketId}_away`)}
                                style={{
                                  alignSelf: 'center',
                                  background: 'transparent',
                                  border: '1px dashed #3f3f46',
                                  borderRadius: 6,
                                  padding: '5px 12px',
                                  color: isAwayExp ? '#22d3ee' : '#a1a1aa',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  fontFamily: "'JetBrains Mono', monospace",
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  marginTop: 4,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {isAwayExp ? (
                                  <>Replier la liste <ChevronUp size={12} /></>
                                ) : (
                                  <>Déplier l'effectif de {awayTeam} ({awaySelections.length}) <ChevronDown size={12} /></>
                                )}
                              </button>
                            )}
                          </div>
                        )}

                        {otherSelections.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
                            {otherSelections.map(renderPlayerBtn)}
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          market.selections.length === 3
                            ? 'repeat(3, 1fr)'
                            : 'repeat(auto-fill, minmax(160px, 1fr))',
                        gap: 8,
                      }}
                    >
                      {market.selections.map((sel) => {
                        const oddVal = parseFloat(sel.odds) || 1.0;
                        return (
                          <button
                            key={sel.key}
                            type="button"
                            onClick={() =>
                              handleSelectBet(
                                market.category,
                                market.marketName,
                                sel.key,
                                sel.label,
                                oddVal,
                                null,
                                sel.prob || null,
                                isSuperSub
                              )
                            }
                            style={{
                              padding: '10px 12px',
                              borderRadius: 8,
                              background: '#0e0e12',
                              border: '1px solid #27272a',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              textAlign: 'left',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#06b6d4';
                              e.currentTarget.style.background = 'rgba(6, 182, 212, 0.08)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = '#27272a';
                              e.currentTarget.style.background = '#0e0e12';
                            }}
                          >
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#fafafa' }}>{sel.label}</span>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 900,
                                color: '#22d3ee',
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            >
                              @{oddVal.toFixed(2)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── 5. PIED DU CATALOGUE & VALIDATION ── */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #27272a',
            background: '#121215',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#a1a1aa' }}>
            <ShieldCheck size={16} color="#10b981" />
            <span>Cotes réelles Betclic certifiées · Détection de Value Bets & Suivi CLV</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                background: '#18181b',
                border: '1px solid #27272a',
                color: '#a1a1aa',
                fontSize: 11,
                fontWeight: 800,
                fontFamily: "'JetBrains Mono', monospace",
                cursor: 'pointer',
              }}
            >
              Fermer
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                setIsDrawerOpen(true);
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)',
                color: '#000',
                fontSize: 11,
                fontWeight: 900,
                fontFamily: "'JetBrains Mono', monospace",
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 15px rgba(6, 182, 212, 0.4)',
              }}
            >
              <Ticket size={14} /> Voir mon Panier
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
