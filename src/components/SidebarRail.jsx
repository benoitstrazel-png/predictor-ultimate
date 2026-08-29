import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Swords,
  Trophy,
  Users,
  Sparkles,
  TrendingUp,
  History,
  Bell,
} from 'lucide-react';

const navItems = [
  { to: '/main',            icon: LayoutDashboard, label: '1. Daily Betting Hub & Value Bets' },
  { to: '/match-deep-dive', icon: Swords,           label: '2. Match Deep Dive & H2H' },
  { to: '/league-focus',    icon: Trophy,           label: '3. Focus Championnat & Stats' },
  { to: '/history',         icon: History,          label: '4. Historique & Résumés IA' },
  { to: '/squads-mercato',  icon: Users,            label: '5. Effectifs & Mercato Multi-Saisons (Transfermarkt)' },
  { to: '/copilot',         icon: Sparkles,         label: '6. AI Predictor Copilot' },
  { to: '/bankroll',        icon: TrendingUp,        label: '7. Bankroll & Model Tracking' },
];

export default function SidebarRail({ onOpenAiModal }) {
  return (
    <aside className="sidebar-rail">
      {/* Top: Logo + Nav */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        {/* Logo */}
        <NavLink to="/main" className="sidebar-logo" title="European Football Predictor V2">
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 13,
            color: 'var(--obsidian)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}>
            EF
          </span>
        </NavLink>

        {/* Divider */}
        <div style={{
          width: 20,
          height: 1,
          background: 'var(--gold-border)',
          margin: '20px 0',
          borderRadius: 1,
        }} />

        {/* Nav items */}
        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={18} strokeWidth={1.75} />
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom: AI Modal + Notifications */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onOpenAiModal}
          className="sidebar-ai-btn"
          title="Assistant RAG On-Demand"
        >
          <Sparkles size={18} strokeWidth={1.75} />
        </button>

        <button
          title="Alertes instantanées"
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            color: 'rgba(245,240,232,0.3)',
            cursor: 'pointer',
            border: 'none',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--ivory)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(245,240,232,0.3)'}
        >
          <Bell size={18} strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );
}
