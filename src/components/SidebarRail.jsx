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
  Ticket,
} from 'lucide-react';

const navItems = [
  { to: '/main',            icon: LayoutDashboard, label: '1. Daily Betting Hub & Value Bets' },
  { to: '/match-deep-dive', icon: Swords,           label: '2. Match Deep Dive & H2H' },
  { to: '/league-focus',    icon: Trophy,           label: '3. Focus Championnat & Stats' },
  { to: '/history',         icon: History,          label: '4. Historique & Résumés IA' },
  { to: '/squads-mercato',  icon: Users,            label: '5. Effectifs & Mercato Multi-Saisons (Transfermarkt)' },
  { to: '/copilot',         icon: Sparkles,         label: '6. AI Predictor Copilot' },
  { to: '/model-tracking',  icon: TrendingUp,       label: '7. Model Tracking' },
  { to: '/my-bets',         icon: Ticket,           label: '8. Mes Paris & Tickets' },
];

export default function SidebarRail({ onOpenAiModal }) {
  return (
    <aside className="sidebar-rail">
      {/* Top: Logo + Nav */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        {/* Logo */}
        <NavLink to="/main" className="sidebar-logo" title="Predictor Ultimate Quant Terminal">
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            fontWeight: 800,
            color: '#06b6d4',
            letterSpacing: '0.05em',
            lineHeight: 1,
          }}>
            PU
          </span>
        </NavLink>

        {/* Divider */}
        <div style={{
          width: 20,
          height: 1,
          background: '#27272a',
          margin: '16px 0 10px',
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
          onMouseEnter={e => e.currentTarget.style.color = '#fafafa'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(245,240,232,0.3)'}
        >
          <Bell size={18} strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );
}
