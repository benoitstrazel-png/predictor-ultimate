import React, { useState } from 'react';
import DashboardStats from './DashboardStats';
import NextMatchRadar from './NextMatchRadar';
import MatchPrediction from './MatchPrediction';
import Standings from './Standings';
import MatchHistory from './MatchHistory';
import LeagueCalendar from './LeagueCalendar';
import TeamLogo from './ui/TeamLogo';
import ExpertAnalysis from './ExpertAnalysis';
import FocusPlayers from './FocusPlayers';
import BettingSimulator from './BettingSimulator';

const Dashboard = ({
  APP_DATA,
  TEAM_STATS,
  selectedMatch,
  setSelectedMatch,
  currentViewWeek,
  setCurrentViewWeek,
  teams,
  calibration,
  handleTeamChange,
  handleSwapTeams,
}) => {
  const [activeLeague, setActiveLeague] = useState(
    APP_DATA.supportedLeagues?.[0]?.code || 'ENG-PL'
  );

  return (
    <>
      {/* ── LEAGUE SWITCHER ── */}
      <section style={{ marginBottom: 28 }}>
        <div className="league-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--positive)',
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            <div>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'var(--gold)',
              }}>
                Championnats Actifs
              </div>
              <div style={{ fontSize: 12, color: 'var(--neutral)', marginTop: 1 }}>
                Données réelles · Dixon-Coles xG · Cotes Betclic & Météo
              </div>
            </div>
          </div>

          <div className="league-flag-chips">
            {APP_DATA.supportedLeagues?.map(lg => (
              <button
                key={lg.code}
                className={`league-chip ${activeLeague === lg.code ? 'active' : ''}`}
                onClick={() => setActiveLeague(lg.code)}
              >
                {lg.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── KPI STATS BAR ── */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ marginBottom: 16 }}>
          <div className="card-section-title">Indicateurs de Saison</div>
        </div>
        <DashboardStats
          stats={APP_DATA.seasonStats}
          schedule={APP_DATA.fullSchedule}
          currentWeek={APP_DATA.currentWeek}
          teamStats={TEAM_STATS}
        />
      </section>

      {/* ── CENTRE D'ANALYSE ── */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '2rem',
            color: 'var(--ivory)',
            fontWeight: 400,
            letterSpacing: '-0.01em',
            marginBottom: 4,
          }}>
            Centre d'analyse
          </h2>
          <p style={{ fontSize: 12, color: 'var(--neutral)' }}>
            Simulateur de rencontre · Modèle Dixon-Coles · Probabilités calibrées
          </p>
        </div>

        <div className="analysis-card">
          {/* Team selector */}
          <div className="team-selector-row">
            {/* Home */}
            <div className="team-selector-block">
              <TeamLogo teamName={selectedMatch.homeTeam} size="lg" />
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--positive)', marginBottom: 4 }}>
                Domicile
              </div>
              <select
                value={selectedMatch.homeTeam}
                onChange={e => handleTeamChange('home', e.target.value)}
                style={{ width: 160, textAlign: 'center' }}
              >
                {teams.filter(t => t !== selectedMatch.awayTeam).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* VS */}
            <div className="vs-divider">
              <div className="vs-text">×</div>
              <button className="swap-btn" onClick={handleSwapTeams} title="Intervertir">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M20 17H4M4 17l4-4m-4 4 4 4M4 7h16m0 0-4-4m4 4-4 4"/>
                </svg>
              </button>
            </div>

            {/* Away */}
            <div className="team-selector-block">
              <TeamLogo teamName={selectedMatch.awayTeam} size="lg" />
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--danger)', marginBottom: 4 }}>
                Extérieur
              </div>
              <select
                value={selectedMatch.awayTeam}
                onChange={e => handleTeamChange('away', e.target.value)}
                style={{ width: 160, textAlign: 'center' }}
              >
                {teams.filter(t => t !== selectedMatch.homeTeam).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Analysis grid */}
          <div style={{ padding: '0 28px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Prediction */}
            <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 16, padding: 20 }}>
              <div className="card-section-title" style={{ marginBottom: 16 }}>Prédiction</div>
              <MatchPrediction match={selectedMatch} />
            </div>

            {/* Radar */}
            <div style={{ background: 'var(--glass-primary)', border: '1px solid var(--ivory-border)', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="card-section-title" style={{ marginBottom: 16, position: 'absolute', top: 20, left: 20 }}>Radar Tactique</div>
              <NextMatchRadar
                homeTeam={selectedMatch.homeTeam}
                awayTeam={selectedMatch.awayTeam}
                teamStats={TEAM_STATS}
              />
            </div>
          </div>

          {/* Match history */}
          <div style={{ padding: '0 28px 28px', borderTop: '1px solid var(--ivory-border)', paddingTop: 24 }}>
            <div className="card-section-title" style={{ marginBottom: 16 }}>Historique des confrontations</div>
            <MatchHistory match={selectedMatch} />
          </div>
        </div>
      </section>

      {/* ── FOCUS JOUEURS ── */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ marginBottom: 20 }}>
          <div className="card-section-title">Joueurs Clés</div>
        </div>
        <FocusPlayers homeTeam={selectedMatch.homeTeam} awayTeam={selectedMatch.awayTeam} />
      </section>

      {/* ── CALENDRIER + CLASSEMENT ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40 }}>
        <section>
          <div className="card-section-title" style={{ marginBottom: 16 }}>Calendrier · J{currentViewWeek}</div>
          <LeagueCalendar
            schedule={APP_DATA.fullSchedule}
            selectedWeek={currentViewWeek}
            onWeekChange={setCurrentViewWeek}
            highlightTeams={[selectedMatch.homeTeam, selectedMatch.awayTeam]}
          />
        </section>

        <section>
          <div className="card-section-title" style={{ marginBottom: 16 }}>Classement</div>
          <Standings
            standings={APP_DATA.standings}
            schedule={APP_DATA.fullSchedule}
            currentWeek={APP_DATA.currentWeek}
            selectedWeek={currentViewWeek}
            onWeekChange={setCurrentViewWeek}
            highlightTeams={[selectedMatch.homeTeam, selectedMatch.awayTeam]}
          />
        </section>
      </div>

      {/* ── SIMULATEUR DE PARIS ── */}
      <section style={{ marginBottom: 40 }}>
        <div className="card-section-title" style={{ marginBottom: 16 }}>Simulateur de Paris · Semaine {currentViewWeek}</div>
        <BettingSimulator
          matches={APP_DATA.fullSchedule.filter(m => m.week === currentViewWeek)}
        />
      </section>

      {/* ── EXPERT ANALYSIS ── */}
      <section>
        <div className="card-section-title" style={{ marginBottom: 16 }}>Analyses & Tendances</div>
        <ExpertAnalysis nextMatches={APP_DATA.nextMatches} />
      </section>
    </>
  );
};

export default Dashboard;
