import React from 'react';
import PlayerAvatar from './PlayerAvatar';
import { ArrowRight, DollarSign, Calendar, TrendingUp, Sparkles, CheckCircle2, Shield } from 'lucide-react';

export default function TransferCard({ transfer }) {
  if (!transfer) return null;

  const isHighValue = (transfer.fee_numeric_eur || 0) >= 40000000;
  const isFree = (transfer.fee_numeric_eur || 0) === 0;

  const roleColors = {
    G: { label: '🧤 Gardien', bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: 'rgba(234, 179, 8, 0.3)' },
    D: { label: '🛡️ Défenseur', bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' },
    M: { label: '⚙️ Milieu', bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' },
    A: { label: '⚡ Attaquant', bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)' }
  };
  const roleStyle = roleColors[transfer.player_role] || roleColors.M;

  return (
    <div style={{
      background: 'var(--glass-primary)',
      border: isHighValue ? '1px solid var(--gold-border)' : '1px solid var(--ivory-border)',
      borderRadius: 16,
      padding: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.2s, box-shadow 0.2s',
      boxShadow: isHighValue ? '0 8px 24px rgba(212, 175, 55, 0.12)' : 'none'
    }}>
      {/* ── 1. EN-TÊTE : PROFIL COMPLET DU JOUEUR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PlayerAvatar name={transfer.player_name} photoUrl={transfer.player_photo_url} size={48} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ivory)' }}>
                {transfer.player_name}
              </span>
              <span style={{ fontSize: 13 }} title={transfer.player_nationality}>
                {transfer.player_nationality_flag || '🌍'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 11, color: 'var(--neutral)', flexWrap: 'wrap' }}>
              <span style={{
                padding: '2px 6px',
                borderRadius: 4,
                background: roleStyle.bg,
                color: roleStyle.color,
                border: `1px solid ${roleStyle.border}`,
                fontWeight: 700
              }}>
                {transfer.player_position}
              </span>
              <span>·</span>
              <span>Âge au transfert : <strong style={{ color: 'var(--ivory)' }}>{transfer.age_at_transfer} ans</strong></span>
              <span>·</span>
              <span>Pied : <strong style={{ color: 'var(--gold)' }}>{transfer.preferred_foot || 'Droitier'}</strong></span>
            </div>
          </div>
        </div>

        {/* Badge Type d'opération */}
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: 8,
          background: isFree ? 'rgba(34, 197, 94, 0.12)' : 'var(--obsidian-2)',
          color: isFree ? '#4ade80' : 'var(--gold)',
          border: isFree ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--gold-border)'
        }}>
          {transfer.transfer_type_label || '💰 Achat'}
        </span>
      </div>

      {/* ── 2. LIGNE DU TRANSFERT : CLUB DÉPART ➔ CLUB ARRIVÉE ── */}
      <div style={{
        background: 'var(--obsidian-2)',
        border: '1px solid var(--ivory-border)',
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12
      }}>
        {/* Club Départ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          {transfer.from_team_logo && (
            <img src={transfer.from_team_logo} alt={transfer.from_team_name} style={{ width: 34, height: 34, objectFit: 'contain' }} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase' }}>Club Vendeur / Départ</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {transfer.from_team_name}
            </div>
          </div>
        </div>

        {/* Flèche de Mouvement */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 8px' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gold-muted)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowRight size={14} color="var(--gold)" />
          </div>
          <span style={{ fontSize: 9, color: 'var(--neutral)', marginTop: 2, whiteSpace: 'nowrap' }}>
            {transfer.mercato_window_label || 'Mercato Estival'}
          </span>
        </div>

        {/* Club Arrivée */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, justifyContent: 'flex-end', textAlign: 'right' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--neutral)', textTransform: 'uppercase' }}>Club Acheteur / Arrivée</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {transfer.to_team_name}
            </div>
          </div>
          {transfer.to_team_logo && (
            <img src={transfer.to_team_logo} alt={transfer.to_team_name} style={{ width: 34, height: 34, objectFit: 'contain' }} />
          )}
        </div>
      </div>

      {/* ── 3. MÉTRIQUES FINANCIÈRES & DATE D'EFFET ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 10,
        fontSize: 11
      }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--ivory-border)' }}>
          <span style={{ color: 'var(--neutral)', display: 'block', fontSize: 10 }}>Montant Transaction</span>
          <strong style={{ color: isFree ? '#4ade80' : 'var(--ivory)', fontSize: 13 }}>
            {transfer.fee_display}
          </strong>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--ivory-border)' }}>
          <span style={{ color: 'var(--neutral)', display: 'block', fontSize: 10 }}>Valeur Estimée</span>
          <strong style={{ color: 'var(--gold)', fontSize: 13 }}>
            {transfer.market_value_display}
          </strong>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--ivory-border)' }}>
          <span style={{ color: 'var(--neutral)', display: 'block', fontSize: 10 }}>Date Officielle</span>
          <strong style={{ color: 'var(--ivory)', fontSize: 12 }}>
            {transfer.transfer_date_formatted || transfer.transfer_date}
          </strong>
        </div>
      </div>

      {/* ── 4. NOTE EXPLICATIVE ── */}
      {transfer.transfer_notes && (
        <div style={{
          fontSize: 11,
          color: 'var(--neutral)',
          fontStyle: 'italic',
          background: 'rgba(212,175,55,0.04)',
          padding: '6px 10px',
          borderRadius: 6,
          borderLeft: '2px solid var(--gold)'
        }}>
          {transfer.transfer_notes}
        </div>
      )}
    </div>
  );
}
