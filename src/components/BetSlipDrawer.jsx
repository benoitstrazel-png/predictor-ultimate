/**
 * src/components/BetSlipDrawer.jsx
 * ─────────────────────────────────────────────────────────────
 * Panier Tiroir Flottant Rétractable (Drawer) — Option B
 * - Rendu via ReactDOM.createPortal(..., document.body) pour découplage total de l'app-shell
 * - Bouton flottant persistant en permanence en bas à droite (Option B)
 * - Tiroir Slide-Over 420px latéral sur Desktop / Bottom-Sheet fluide sur Mobile
 * - Overlay sombre subtilement flouté (blur 4px)
 * - Comparateur dual : Cote Betclic de référence vs Cote Réelle saisie (Suivi CLV)
 * - Gestion explicite des cotes non ouvertes (Saisie manuelle assistée)
 * - Bouton optionnel de dimensionnement intelligent "Kelly Quant V3"
 * - Double affichage du rendement financier : Gain Brut vs Bénéfice Net
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Trash2,
  Ticket,
  ChevronRight,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Layers,
} from 'lucide-react';
import { useBetSlip } from '../context/BetSlipContext';

export default function BetSlipDrawer() {
  const navigate = useNavigate();
  const {
    items,
    itemCount,
    isDrawerOpen,
    setIsDrawerOpen,
    toggleDrawer,
    activeTab,
    setActiveTab,
    accumulatorStake,
    setAccumulatorStake,
    recommendedKellyStake,
    removeFromBetSlip,
    updateItem,
    clearBetSlip,
    accumulatorCalculations,
    singlesCalculations,
    placeTicket,
  } = useBetSlip();

  const [ticketSuccess, setTicketSuccess] = useState(null);
  const [ticketNotes, setTicketNotes] = useState('');
  const [justAddedAnimation, setJustAddedAnimation] = useState(false);

  // Micro-animation d'impulsion lors de l'ajout d'une nouvelle sélection
  useEffect(() => {
    if (itemCount > 0) {
      setJustAddedAnimation(true);
      const timer = setTimeout(() => setJustAddedAnimation(false), 900);
      return () => clearTimeout(timer);
    }
  }, [itemCount]);

  // Fermeture du tiroir par touche Échap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, setIsDrawerOpen]);

  // Validation du ticket
  const handlePlaceTicket = () => {
    if (items.length === 0) return;
    const generated = placeTicket(ticketNotes);
    if (generated && generated.length > 0) {
      setTicketSuccess(generated[0]);
      setTicketNotes('');
      setTimeout(() => {
        setTicketSuccess(null);
      }, 7000);
    }
  };

  const quickStakes = [5, 10, 20, 50];

  if (typeof document === 'undefined') {
    return null;
  }

  return ReactDOM.createPortal(
    <>
      {/* ── 1. BOUTON FLOTTANT PERSISTANT (OPTION B — EN PERMANENCE) ── */}
      <button
        type="button"
        onClick={toggleDrawer}
        className={`betslip-floating-trigger ${isDrawerOpen ? 'drawer-open' : ''}`}
        style={{
          transform: justAddedAnimation ? 'scale(1.08) translateY(-4px)' : undefined,
          borderColor: justAddedAnimation ? '#22d3ee' : undefined,
          boxShadow: justAddedAnimation
            ? '0 16px 40px -4px rgba(0, 0, 0, 0.9), 0 0 35px rgba(6, 182, 212, 0.6)'
            : undefined,
        }}
        title="Ouvrir mon Panier de Paris"
        aria-label="Ouvrir le panier de paris"
      >
        <div className="betslip-floating-icon-box">
          <Ticket size={19} strokeWidth={2.2} />
          {itemCount > 0 && (
            <span className="betslip-badge-count">
              {itemCount}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.25 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#22d3ee' }}>
              PANIER DE PARIS
            </span>
            {itemCount > 0 && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 6px #10b981',
                }}
              />
            )}
          </div>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#fafafa', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
            {itemCount === 0 ? (
              <span style={{ color: '#a1a1aa', fontWeight: 600 }}>0 sélection</span>
            ) : (
              <span>
                {itemCount} pari{itemCount > 1 ? 's' : ''}{' '}
                <span style={{ color: '#71717a' }}>·</span>{' '}
                <span style={{ color: '#22d3ee' }}>@{accumulatorCalculations.totalOdds.toFixed(2)}</span>
              </span>
            )}
          </div>
        </div>

        <ChevronRight size={16} color="#71717a" style={{ marginLeft: 2 }} />
      </button>

      {/* ── 2. OVERLAY SUBTILEMENT FLOUTÉ (BLUR 4PX) ── */}
      <div
        className={`betslip-drawer-overlay ${isDrawerOpen ? 'open' : ''}`}
        onClick={() => setIsDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* ── 3. TIROIR SLIDE-OVER COULISSANT (420PX) ── */}
      <aside
        className={`betslip-drawer-panel ${isDrawerOpen ? 'open' : ''}`}
        aria-label="Tiroir Panier de Paris"
      >
        {/* Poignée mobile drag indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <div
            style={{
              width: 44,
              height: 4,
              borderRadius: 9999,
              background: '#3f3f46',
            }}
          />
        </div>

        {/* ── EN-TÊTE DU TIROIR ── */}
        <div className="betslip-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="betslip-floating-icon-box" style={{ width: 34, height: 34 }}>
              <Ticket size={18} strokeWidth={2.2} />
              {itemCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 6px #10b981',
                  }}
                />
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 14, fontWeight: 900, color: '#fafafa', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em' }}>
                  Panier de Paris
                </h2>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 900,
                    fontFamily: "'JetBrains Mono', monospace",
                    background: itemCount > 0 ? 'rgba(6, 182, 212, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                    color: itemCount > 0 ? '#22d3ee' : '#71717a',
                    border: itemCount > 0 ? '1px solid rgba(6, 182, 212, 0.4)' : 'none',
                  }}
                >
                  {itemCount} SÉL.
                </span>
              </div>
              <p style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2 }}>
                Arbitrage des cotes Betclic & Moteur Quant V3
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {itemCount > 0 && (
              <button
                type="button"
                onClick={clearBetSlip}
                style={{
                  padding: 6,
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  color: '#71717a',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Vider l'intégralité du panier"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              style={{
                padding: 6,
                borderRadius: 6,
                background: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Fermer le tiroir"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── BANNIÈRE SUCCÈS LORS DU SCELLEMENT DU TICKET ── */}
        {ticketSuccess && (
          <div
            style={{
              margin: '12px 16px 0',
              padding: 12,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(6, 182, 212, 0.12) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <CheckCircle2 size={20} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, fontSize: 11 }}>
              <p style={{ fontWeight: 900, fontSize: 12, color: '#10b981', fontFamily: "'JetBrains Mono', monospace" }}>
                Ticket scellé et enregistré !
              </p>
              <p style={{ color: '#d4d4d8', marginTop: 4, lineHeight: 1.4 }}>
                Votre {ticketSuccess.ticketType === 'ACCUMULATOR' ? 'Combiné' : 'Pari Simple'} a été validé à la cote de{' '}
                <strong style={{ color: '#22d3ee', fontFamily: "'JetBrains Mono', monospace" }}>@{ticketSuccess.totalOdds.toFixed(2)}</strong> pour un gain potentiel de{' '}
                <strong style={{ color: '#10b981', fontFamily: "'JetBrains Mono', monospace" }}>{ticketSuccess.potentialPayout.toFixed(2)} €</strong>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  navigate('/my-bets');
                }}
                style={{
                  marginTop: 8,
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 900,
                  fontFamily: "'JetBrains Mono', monospace",
                  background: '#10b981',
                  color: '#000',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Consulter dans Mes Tickets <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

        {/* ── SEGMENTED CONTROL : COMBINÉ VS SIMPLES ── */}
        {itemCount > 0 && (
          <div className="betslip-tab-bar">
            <button
              type="button"
              onClick={() => setActiveTab('ACCUMULATOR')}
              className={`betslip-tab-btn ${activeTab === 'ACCUMULATOR' ? 'active' : ''}`}
            >
              <Layers size={13} />
              Combiné ({itemCount})
              <span style={{ color: activeTab === 'ACCUMULATOR' ? '#22d3ee' : '#a1a1aa' }}>
                @{accumulatorCalculations.totalOdds.toFixed(2)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('SINGLE')}
              className={`betslip-tab-btn ${activeTab === 'SINGLE' ? 'active' : ''}`}
            >
              <Ticket size={13} />
              Paris Simples ({itemCount})
            </button>
          </div>
        )}

        {/* ── LISTE DES SÉLECTIONS DU PANIER ── */}
        <div className="betslip-items-container custom-scrollbar">
          {itemCount === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px', color: '#71717a' }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid #27272a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                <Ticket size={24} color="#52525b" />
              </div>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: '#e4e4e7', fontFamily: "'JetBrains Mono', monospace" }}>
                Votre panier est vide
              </h3>
              <p style={{ fontSize: 11, color: '#a1a1aa', marginTop: 6, maxWidth: 260, lineHeight: 1.5 }}>
                Sélectionnez n'importe quel marché (1N2, Over/Under, Score Exact, Buteur) sur le{' '}
                <strong style={{ color: '#22d3ee' }}>Daily Betting Hub</strong> pour composer votre ticket.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  navigate('/main');
                }}
                style={{
                  marginTop: 18,
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 900,
                  fontFamily: "'JetBrains Mono', monospace",
                  background: 'rgba(6, 182, 212, 0.12)',
                  color: '#22d3ee',
                  border: '1px solid rgba(6, 182, 212, 0.35)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Explorer les matchs du jour <ArrowRight size={13} />
              </button>
            </div>
          ) : (
            items.map((item) => {
              const userOdd = parseFloat(item.odds) || 1.0;
              const hasScraped = Boolean(item.hasScrapedOdds && item.scrapedOdds);
              const scrOdd = hasScraped ? parseFloat(item.scrapedOdds) : null;
              const delta = scrOdd ? Math.round((userOdd - scrOdd) * 100) / 100 : null;

              return (
                <div key={item.id} className="betslip-item-card">
                  {/* Titre & Bouton Supprimer */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#71717a' }}>
                        <span style={{ textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>
                          {item.league || 'Football'}
                        </span>
                        <span>·</span>
                        <span style={{ color: '#d4d4d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.matchLabel}
                        </span>
                      </div>
                      <h4 style={{ fontSize: 13, fontWeight: 900, color: '#fafafa', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
                        {item.selectionLabel}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromBetSlip(item.id)}
                      style={{
                        padding: 4,
                        borderRadius: 4,
                        background: 'transparent',
                        border: 'none',
                        color: '#71717a',
                        cursor: 'pointer',
                      }}
                      title="Supprimer cette sélection"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Badges de Marché, Value Bet & Probabilité Modèle */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        fontFamily: "'JetBrains Mono', monospace",
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: '#d4d4d8',
                        border: '1px solid #27272a',
                      }}
                    >
                      {item.marketLabel || item.marketType}
                    </span>

                    {item.edgePct && (
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 900,
                          fontFamily: "'JetBrains Mono', monospace",
                          background: 'rgba(6, 182, 212, 0.15)',
                          color: '#22d3ee',
                          border: '1px solid rgba(6, 182, 212, 0.35)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Sparkles size={9} />
                        Edge {item.edgePct}
                      </span>
                    )}

                    {item.modelProb && (
                      <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: '#a1a1aa' }}>
                        Prob: <strong style={{ color: '#fafafa' }}>{item.modelProb}</strong>
                      </span>
                    )}
                  </div>

                  {/* ── COMPARATEUR DUAL : COTE BETCLIC RÉF VS COTE RÉELLE SAISIE (CLV) ── */}
                  <div className="betslip-comparator-box">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                      {/* Statut de la cote scrapée Betclic */}
                      {hasScraped ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#a1a1aa' }}>
                          <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 800 }}>Betclic Réf :</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, color: '#fafafa' }}>
                            @{scrOdd.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b', fontSize: 10, fontWeight: 800 }}>
                          <AlertTriangle size={12} />
                          <span>Cote non ouverte (Saisie manuelle)</span>
                        </div>
                      )}

                      {/* Indicateur de variation CLV */}
                      {delta !== null && delta !== 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            fontFamily: "'JetBrains Mono', monospace",
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: delta > 0 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(245, 158, 11, 0.18)',
                            color: delta > 0 ? '#10b981' : '#f59e0b',
                            border: delta > 0 ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)',
                          }}
                          title="Écart par rapport à la cote scrapée Betclic à l'ouverture"
                        >
                          Δ CLV : {delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Saisie de la Cote Réelle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 4 }}>
                      <span style={{ fontSize: 11, color: '#d4d4d8', fontWeight: 700 }}>
                        Cote validée pour le pari :
                      </span>
                      <input
                        type="number"
                        step="0.05"
                        min="1.01"
                        max="100.0"
                        value={item.odds}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 1.01;
                          updateItem(item.id, { odds: val });
                        }}
                        className="betslip-input-odd"
                      />
                    </div>

                    {/* Mise individuelle pour les Paris Simples */}
                    {activeTab === 'SINGLE' && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 6, borderTop: '1px solid #27272a' }}>
                        <span style={{ fontSize: 11, color: '#a1a1aa' }}>Mise sur ce match :</span>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={item.stake || 10}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              updateItem(item.id, { stake: val });
                            }}
                            style={{
                              width: 80,
                              padding: '4px 20px 4px 8px',
                              borderRadius: 6,
                              background: '#18181b',
                              border: '1px solid #3f3f46',
                              color: '#fafafa',
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 12,
                              fontWeight: 900,
                              textAlign: 'right',
                            }}
                          />
                          <span style={{ position: 'absolute', right: 8, top: 4, fontSize: 11, color: '#71717a', fontWeight: 800 }}>€</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── 4. PIED DU TIROIR & VALIDATION DU TICKET ── */}
        {itemCount > 0 && (
          <div className="betslip-footer">
            {activeTab === 'ACCUMULATOR' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Ligne Cote Totale */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa' }}>Cote Totale Combinée :</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#22d3ee', fontFamily: "'JetBrains Mono', monospace" }}>
                    @{accumulatorCalculations.totalOdds.toFixed(2)}
                  </span>
                </div>

                {/* Saisie de la mise globale */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: '#d4d4d8' }}>Mise globale du combiné :</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: '#a1a1aa' }}>{accumulatorStake} €</span>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={accumulatorStake}
                      onChange={(e) => setAccumulatorStake(Math.max(1, parseFloat(e.target.value) || 1))}
                      style={{
                        width: '100%',
                        padding: '8px 40px 8px 12px',
                        borderRadius: 8,
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        color: '#fafafa',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 14,
                        fontWeight: 900,
                      }}
                    />
                    <span style={{ position: 'absolute', right: 12, top: 8, fontSize: 11, color: '#71717a', fontWeight: 800 }}>EUR</span>
                  </div>

                  {/* Boutons de mise rapide + BOUTON OPTIONNEL KELLY QUANT V3 */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    {quickStakes.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAccumulatorStake(amt)}
                        className={`betslip-quick-chip ${accumulatorStake === amt ? 'active' : ''}`}
                      >
                        {amt}€
                      </button>
                    ))}

                    {/* BOUTON OPTIONNEL KELLY QUANT V3 */}
                    <button
                      type="button"
                      onClick={() => setAccumulatorStake(recommendedKellyStake.stake)}
                      className={`betslip-kelly-chip ${accumulatorStake === recommendedKellyStake.stake ? 'active' : ''}`}
                      title="Mise suggérée par le modèle Quant V3 selon le critère de Kelly fractionnaire"
                    >
                      <Zap size={12} />
                      Kelly V3 ({recommendedKellyStake.stake}€)
                    </button>
                  </div>
                </div>

                {/* DOUBLE AFFICHAGE FINANCIER : BRUT VS NET */}
                <div className="betslip-payout-banner">
                  <div>
                    <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.08em', color: '#22d3ee', display: 'block', fontFamily: "'JetBrains Mono', monospace" }}>
                      Gain Potentiel Brut
                    </span>
                    <span style={{ fontSize: 11, color: '#10b981', fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, marginTop: 2, display: 'block' }}>
                      Bénéfice Net : +{accumulatorCalculations.netProfit.toFixed(2)} €
                    </span>
                  </div>

                  <span style={{ fontSize: 18, fontWeight: 900, color: '#22d3ee', fontFamily: "'JetBrains Mono', monospace" }}>
                    {accumulatorCalculations.potentialPayout.toFixed(2)} €
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Récapitulatif Paris Simples */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#a1a1aa' }}>
                  <span>Mises Cumulées ({itemCount} paris) :</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#fafafa', fontFamily: "'JetBrains Mono', monospace" }}>
                    {singlesCalculations.totalStake.toFixed(2)} €
                  </span>
                </div>

                <div className="betslip-payout-banner">
                  <div>
                    <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.08em', color: '#22d3ee', display: 'block', fontFamily: "'JetBrains Mono', monospace" }}>
                      Gains Potentiels Totaux
                    </span>
                    <span style={{ fontSize: 11, color: '#10b981', fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, marginTop: 2, display: 'block' }}>
                      Bénéfice Net : +{singlesCalculations.netProfit.toFixed(2)} €
                    </span>
                  </div>

                  <span style={{ fontSize: 18, fontWeight: 900, color: '#22d3ee', fontFamily: "'JetBrains Mono', monospace" }}>
                    {singlesCalculations.totalPotentialPayout.toFixed(2)} €
                  </span>
                </div>
              </div>
            )}

            {/* Note personnelle sur le ticket */}
            <input
              type="text"
              placeholder="Note sur le ticket (ex: Value Bet L1, Safe du samedi)..."
              value={ticketNotes}
              onChange={(e) => setTicketNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 8,
                background: '#18181b',
                border: '1px solid #27272a',
                fontSize: 11,
                color: '#fafafa',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />

            {/* BOUTON D'ACTION PRINCIPAL : SCELLER LE TICKET */}
            <button
              type="button"
              onClick={handlePlaceTicket}
              className="betslip-seal-btn"
            >
              <CheckCircle2 size={16} strokeWidth={2.5} />
              Valider le Ticket ({activeTab === 'ACCUMULATOR' ? `${accumulatorStake}€` : `${singlesCalculations.totalStake}€`})
            </button>
          </div>
        )}
      </aside>
    </>,
    document.body
  );
}
