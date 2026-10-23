import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import SidebarRail from './components/SidebarRail';
import MobileNavbar from './components/MobileNavbar';
import FixturesDrawer from './components/FixturesDrawer';
import AiPredictorModal from './components/AiPredictorModal';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Terminal, Sparkles, Database, Calendar } from 'lucide-react';
import TeamLogo from './components/ui/TeamLogo';

// Lazy-loaded cockpit views for fast initial load
const DailyBettingHub = lazy(() => import('./components/DailyBettingHub'));
const MatchDeepDive = lazy(() => import('./components/MatchDeepDive'));
const LeagueFocusHub = lazy(() => import('./components/LeagueFocusHub'));
const MatchHistoryHub = lazy(() => import('./components/MatchHistoryHub'));
const SquadsMercatoProps = lazy(() => import('./components/SquadsMercatoProps'));
const CopilotView = lazy(() => import('./components/CopilotView'));
const BankrollTracking = lazy(() => import('./components/BankrollTracking'));

import { MatchProvider, useMatch } from './context/MatchContext';
import { calculateCalibration } from './utils/calibration';

function AppContent() {
  const navigate = useNavigate();
  const {
    selectedMatch,
    selectMatch,
    allMatches,
    appData,
    modelVersion,
    setModelVersion,
  } = useMatch();

  const [teams, setTeams] = useState([]);
  const [calibration, setCalibration] = useState({});
  const [selectedLeague, setSelectedLeague] = useState(
    appData?.supportedLeagues?.[0]?.code || 'FRA-L1'
  );
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isFixturesOpen, setIsFixturesOpen] = useState(false);

  const upcomingMatches = allMatches.filter(
    (m) => m.status === 'LIVE' || m.status === 'SCHEDULED'
  );
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    if (selectedMatch && upcomingMatches.length > 0) {
      const idx = upcomingMatches.findIndex((m) => m.id === selectedMatch.id);
      if (idx !== -1 && idx !== heroIdx) {
        setHeroIdx(idx);
      }
    }
  }, [selectedMatch?.id, upcomingMatches]);

  useEffect(() => {
    if (allMatches && allMatches.length > 0) {
      const uniqueTeams = new Set();
      allMatches.forEach((match) => {
        if (match.homeTeam) uniqueTeams.add(match.homeTeam);
        if (match.awayTeam) uniqueTeams.add(match.awayTeam);
      });
      setTeams(Array.from(uniqueTeams).sort());
      setCalibration(calculateCalibration(allMatches, appData?.teamStats || {}));
    }
  }, [allMatches, appData]);

  return (
    <div className="app-shell" style={{ background: '#09090b', color: '#fafafa' }}>
      {/* ── 1. Left Sidebar Rail ── */}
      <SidebarRail onOpenAiModal={() => setIsAiModalOpen(true)} />

      {/* ── 2. Center Main Terminal Area (Zero 56vh Hero Banner) ── */}
      <main className="main-content" style={{ background: '#09090b' }}>
        <div className="main-scroll">
          {/* Top Compact Terminal Status Ticker (38px height) */}
          <div style={{
            height: 38,
            background: '#121215',
            borderBottom: '1px solid #27272a',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                color: '#06b6d4', fontWeight: 700, letterSpacing: '0.04em'
              }}>
                <Terminal size={13} /> PREDICTOR QUANT TERMINAL
              </span>
              <span style={{ color: '#27272a' }}>|</span>
              {selectedMatch && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#e4e4e7' }}>
                  <span style={{ color: '#71717a' }}>FOCUS:</span>
                  <TeamLogo teamName={selectedMatch.homeTeam} size={13} />
                  <strong>{selectedMatch.homeTeam}</strong>
                  <span style={{ color: '#71717a' }}>vs</span>
                  <TeamLogo teamName={selectedMatch.awayTeam} size={13} />
                  <strong>{selectedMatch.awayTeam}</strong>
                  <span style={{
                    padding: '1px 5px', borderRadius: 2,
                    background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#10b981', fontSize: 10
                  }}>
                    1N2: {selectedMatch.probabilities?.home} / {selectedMatch.probabilities?.draw} / {selectedMatch.probabilities?.away}
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#71717a', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Database size={11} color="#10b981" /> SQLITE/LIBSQL SEALED ({modelVersion.toUpperCase()})
              </span>
              <button
                onClick={() => setIsFixturesOpen((prev) => !prev)}
                style={{
                  background: '#18181b', border: '1px solid #27272a', color: '#e4e4e7',
                  padding: '3px 8px', borderRadius: 3, fontSize: 10, cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace", display: 'inline-flex', alignItems: 'center', gap: 4
                }}
              >
                <Calendar size={11} /> Calendrier ({allMatches.length})
              </button>
              <button
                onClick={() => setIsAiModalOpen(true)}
                style={{
                  background: 'rgba(6, 182, 212, 0.14)', border: '1px solid #06b6d4', color: '#06b6d4',
                  padding: '3px 9px', borderRadius: 3, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace", display: 'inline-flex', alignItems: 'center', gap: 4
                }}
              >
                <Sparkles size={11} /> Brief RAG Structuré
              </button>
            </div>
          </div>

          {/* Cockpit Content Views */}
          <div>
            <Suspense
              fallback={
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '400px',
                  gap: '12px',
                  color: '#06b6d4'
                }}>
                  <span style={{
                    fontSize: '11px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#a1a1aa',
                    fontFamily: "'JetBrains Mono', monospace"
                  }}>
                    Initialisation du terminal quantitatif...
                  </span>
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Navigate to="/main" replace />} />

                {/* Tab 1: Terminal Match Feed & Multi-Model Switcher */}
                <Route
                  path="/main"
                  element={
                    <DailyBettingHub
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
                      key={`dive-${selectedMatch?.id}-${modelVersion}`}
                      selectedMatch={selectedMatch}
                      APP_DATA={appData}
                      teams={teams}
                    />
                  }
                />

                {/* Tab 3: Focus Championnat & Stats */}
                <Route path="/league-focus" element={<LeagueFocusHub />} />

                {/* Tab 4: Historique & Résumés IA */}
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

                {/* Tab 7: Model Tracking & Viability */}
                <Route path="/model-tracking" element={<BankrollTracking APP_DATA={appData} />} />
                <Route path="/bankroll" element={<Navigate to="/model-tracking" replace />} />

                {/* Legacy route fallbacks & Catch-all */}
                <Route path="/match-focus" element={<Navigate to="/match-deep-dive" replace />} />
                <Route path="/players" element={<Navigate to="/squads-mercato" replace />} />
                <Route path="/comparator" element={<Navigate to="/match-deep-dive" replace />} />
                <Route path="/forecasts" element={<Navigate to="/main" replace />} />
                <Route path="/tipsters" element={<Navigate to="/main" replace />} />
                <Route path="*" element={<Navigate to="/main" replace />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </main>

      {/* ── 3. Right Fixtures Drawer ── */}
      <FixturesDrawer
        isOpen={isFixturesOpen}
        onClose={() => setIsFixturesOpen(false)}
        selectedLeague={selectedLeague}
        onSelectLeague={setSelectedLeague}
        onSelectMatch={(fixture) => {
          selectMatch(fixture);
          const idx = upcomingMatches.findIndex((m) => m.id === fixture.id);
          if (idx !== -1) setHeroIdx(idx);
          setIsFixturesOpen(false);
          navigate('/match-deep-dive');
        }}
      />

      {/* ── 4. Mobile / Tablet Bottom Navigation Bar ── */}
      <MobileNavbar
        onOpenAiModal={() => setIsAiModalOpen(true)}
        onToggleFixtures={() => setIsFixturesOpen((prev) => !prev)}
        isFixturesOpen={isFixturesOpen}
      />

      {/* ── 5. Structured RAG Tactical Brief Modal ── */}
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
      <Analytics />
      <SpeedInsights />
    </MatchProvider>
  );
}

export default App;
