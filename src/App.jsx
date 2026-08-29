import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import SidebarRail from './components/SidebarRail';
import HeroSpotlight from './components/HeroSpotlight';
import FixturesDrawer from './components/FixturesDrawer';
import AiPredictorModal from './components/AiPredictorModal';
import DynamicIsland from './components/DynamicIsland';

import DailyBettingHub from './components/DailyBettingHub';
import MatchDeepDive from './components/MatchDeepDive';
import LeagueFocusHub from './components/LeagueFocusHub';
import MatchHistoryHub from './components/MatchHistoryHub';
import SquadsMercatoProps from './components/SquadsMercatoProps';
import CopilotView from './components/CopilotView';
import BankrollTracking from './components/BankrollTracking';

import { MatchProvider, useMatch } from './context/MatchContext';
import { calculateCalibration } from './utils/calibration';

const TEAM_STATS = {};

function AppContent() {
  const navigate = useNavigate();
  const { selectedMatch, selectMatch, allMatches, appData } = useMatch();

  const [teams, setTeams] = useState([]);
  const [calibration, setCalibration] = useState({});
  const [selectedLeague, setSelectedLeague] = useState(
    appData?.supportedLeagues?.[0]?.code || 'FRA-L1'
  );
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Prochains matchs pour le carrousel Spotlight
  const upcomingMatches = allMatches.filter(m => m.status === 'LIVE' || m.status === 'SCHEDULED');
  const [heroIdx, setHeroIdx] = useState(0);
  const heroMatch = selectedMatch || upcomingMatches[heroIdx];

  // Synchroniser l'index du carrousel avec le match sélectionné
  useEffect(() => {
    if (selectedMatch && upcomingMatches.length > 0) {
      const idx = upcomingMatches.findIndex(m => m.id === selectedMatch.id);
      if (idx !== -1 && idx !== heroIdx) {
        setHeroIdx(idx);
      }
    }
  }, [selectedMatch?.id, upcomingMatches]);

  useEffect(() => {
    if (allMatches && allMatches.length > 0) {
      const uniqueTeams = new Set();
      allMatches.forEach(match => {
        if (match.homeTeam) uniqueTeams.add(match.homeTeam);
        if (match.awayTeam) uniqueTeams.add(match.awayTeam);
      });
      setTeams(Array.from(uniqueTeams).sort());
      setCalibration(calculateCalibration(allMatches, appData?.teamStats || {}));
    }
  }, [allMatches, appData]);

  const handleNextMatch = () => {
    if (upcomingMatches.length === 0) return;
    const nextI = (heroIdx + 1) % upcomingMatches.length;
    setHeroIdx(nextI);
    selectMatch(upcomingMatches[nextI]);
  };

  const handlePrevMatch = () => {
    if (upcomingMatches.length === 0) return;
    const prevI = (heroIdx - 1 + upcomingMatches.length) % upcomingMatches.length;
    setHeroIdx(prevI);
    selectMatch(upcomingMatches[prevI]);
  };

  return (
    <div className="app-shell">
      {/* ── 1. Dynamic Island (Top Center) ── */}
      <DynamicIsland />

      {/* ── 2. Left Sidebar Rail ── */}
      <SidebarRail onOpenAiModal={() => setIsAiModalOpen(true)} />

      {/* ── 3. Center Main Cockpit Area ── */}
      <main className="main-content">
        <div className="main-scroll">
          {/* Cinematic Hero Spotlight Stage */}
          <HeroSpotlight
            key={`hero-${heroMatch?.id}`}
            selectedMatch={heroMatch}
            onOpenAiModal={() => setIsAiModalOpen(true)}
            onNextMatch={handleNextMatch}
            onPrevMatch={handlePrevMatch}
          />

          {/* Cockpit Content Views */}
          <div style={{ padding: '28px 32px 48px' }}>
            <Routes>
              <Route path="/" element={<Navigate to="/main" replace />} />

              {/* Tab 1: Daily Betting Hub & Value Bets */}
              <Route
                path="/main"
                element={
                  <DailyBettingHub
                    key={`daily-${selectedMatch?.id}`}
                    APP_DATA={appData}
                    selectedMatch={selectedMatch}
                    setSelectedMatch={selectMatch}
                  />
                }
              />

              {/* Tab 2: Match Deep Dive & H2H */}
              <Route
                path="/match-deep-dive"
                element={
                  <MatchDeepDive
                    key={`dive-${selectedMatch?.id}`}
                    selectedMatch={selectedMatch}
                    APP_DATA={appData}
                    teams={teams}
                  />
                }
              />

              {/* Tab 3: Focus Championnat & Stats */}
              <Route path="/league-focus" element={<LeagueFocusHub />} />

              {/* Tab 4: Historique & Résumés IA (Moteur Buteurs) */}
              <Route path="/history" element={<MatchHistoryHub />} />

              {/* Tab 5: Squads, Mercato & Player Props */}
              <Route
                path="/squads-mercato"
                element={
                  <SquadsMercatoProps
                    key={`squads-${selectedMatch?.id}`}
                    targetMatch={selectedMatch}
                  />
                }
              />

              {/* Tab 6: AI Predictor Copilot */}
              <Route path="/copilot" element={<CopilotView />} />

              {/* Tab 7: Bankroll & Model Performance */}
              <Route path="/bankroll" element={<BankrollTracking APP_DATA={appData} />} />

              {/* Legacy route fallbacks & Catch-all */}
              <Route path="/match-focus" element={<Navigate to="/match-deep-dive" replace />} />
              <Route path="/players" element={<Navigate to="/squads-mercato" replace />} />
              <Route path="/comparator" element={<Navigate to="/match-deep-dive" replace />} />
              <Route path="/forecasts" element={<Navigate to="/main" replace />} />
              <Route path="/tipsters" element={<Navigate to="/main" replace />} />
              <Route path="*" element={<Navigate to="/main" replace />} />
            </Routes>
          </div>
        </div>
      </main>

      {/* ── 4. Right Fixtures Drawer ── */}
      <FixturesDrawer
        selectedLeague={selectedLeague}
        onSelectLeague={setSelectedLeague}
        onSelectMatch={(fixture) => {
          selectMatch(fixture);
          const idx = upcomingMatches.findIndex(m => m.id === fixture.id);
          if (idx !== -1) setHeroIdx(idx);
          navigate('/match-deep-dive');
        }}
      />

      {/* ── 5. RAG AI Modal ── */}
      <AiPredictorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        selectedMatch={selectedMatch}
        APP_DATA={appData}
      />
    </div>
  );
}

function App() {
  return (
    <MatchProvider>
      <AppContent />
    </MatchProvider>
  );
}

export default App;
