import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Swords,
  Trophy,
  History,
  Users,
  Sparkles,
  TrendingUp,
  Calendar,
} from 'lucide-react';

const mobileNavItems = [
  { to: '/main', icon: LayoutDashboard, label: 'Hub' },
  { to: '/match-deep-dive', icon: Swords, label: 'H2H' },
  { to: '/league-focus', icon: Trophy, label: 'Ligues' },
  { to: '/history', icon: History, label: 'Historique' },
  { to: '/squads-mercato', icon: Users, label: 'Mercato' },
  { to: '/copilot', icon: Sparkles, label: 'Copilot' },
  { to: '/bankroll', icon: TrendingUp, label: 'Bankroll' },
];

export default function MobileNavbar({ onOpenAiModal, onToggleFixtures, isFixturesOpen }) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
      <div className="mobile-nav-scroll">
        {mobileNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `mobile-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={18} strokeWidth={1.8} />
            <span className="mobile-nav-label">{label}</span>
          </NavLink>
        ))}

        {/* Bouton pour ouvrir le drawer des matchs */}
        <button
          onClick={onToggleFixtures}
          className={`mobile-nav-item mobile-nav-btn ${isFixturesOpen ? 'active' : ''}`}
          type="button"
          title="Calendrier des Matchs"
        >
          <Calendar size={18} strokeWidth={1.8} />
          <span className="mobile-nav-label">Matchs</span>
        </button>

        {/* Bouton IA Copilot modal */}
        <button
          onClick={onOpenAiModal}
          className="mobile-nav-item mobile-nav-btn ai-highlight"
          type="button"
          title="Assistant RAG IA"
        >
          <Sparkles size={18} strokeWidth={1.8} />
          <span className="mobile-nav-label">IA RAG</span>
        </button>
      </div>
    </nav>
  );
}
