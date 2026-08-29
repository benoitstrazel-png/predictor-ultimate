import React, { useState } from 'react';
import { SlidersHorizontal, TrendingUp, Clock } from 'lucide-react';
import TeamLogo from './ui/TeamLogo';
import MatchDetailsModal from './MatchDetailsModal';
import APP_DATA from '../data/app_data.json';

const LEAGUE_FLAGS = {
  'EUR-CL': '🇪🇺',
  'EUR-EL': '🇪🇺',
  'EUR-ECL': '🇪🇺',
  'ENG-PL': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'ESP-LL': '🇪🇸',
  'ITA-SA': '🇮🇹',
  'GER-BL': '🇩🇪',
  'FRA-L1': '🇫🇷',
  'FRIENDLY': '🌐',
};

const LEAGUE_SHORT = {
  'EUR-CL': 'CL',
  'EUR-EL': 'EL',
  'EUR-ECL': 'ECL',
  'ENG-PL': 'PL',
  'ESP-LL': 'LL',
  'ITA-SA': 'SA',
  'GER-BL': 'BL',
  'FRA-L1': 'L1',
  'FRIENDLY': 'AMI',
};

export default function FixturesDrawer({ selectedLeague, onSelectLeague, onSelectMatch }) {
  const [showFilter, setShowFilter] = useState(false);
  const [filterValueBet, setFilterValueBet] = useState(false);
  const [detailsModalMatch, setDetailsModalMatch] = useState(null);

  const leagues = APP_DATA.supportedLeagues || [];

  let filteredSchedule = (APP_DATA.fullSchedule || []).filter(
    m => m.league === selectedLeague
  );

  if (filterValueBet) {
    filteredSchedule = filteredSchedule.filter(m => m.valueBets && m.valueBets.length > 0);
  }

  // Sort: LIVE and upcoming first
  filteredSchedule.sort((a, b) => {
    if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
    if (b.status === 'LIVE' && a.status !== 'LIVE') return 1;
    if (a.status === 'SCHEDULED' && b.status !== 'SCHEDULED') return -1;
    if (b.status === 'SCHEDULED' && a.status !== 'SCHEDULED') return 1;
    return 0;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    if (dateStr.includes("Aujourd'hui") || dateStr.includes("Demain") || dateStr.includes("En Cours") || dateStr.includes("Sam.") || dateStr.includes("Dim.") || dateStr.includes("Ven.")) {
      return dateStr;
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const valueBetCount = (APP_DATA.fullSchedule || [])
    .filter(m => m.league === selectedLeague && m.valueBets?.length > 0).length;

  return (
    <div className="fixtures-drawer">
      {/* Header */}
      <div className="fixtures-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--gold)',
              marginBottom: 4,
            }}>
              Matchs & Cotes
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ivory)' }}>
              {filteredSchedule.length} rencontres
              {valueBetCount > 0 && (
                <span style={{
                  marginLeft: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--positive)',
                  background: 'var(--positive-muted)',
                  border: '1px solid var(--positive-border)',
                  padding: '2px 7px',
                  borderRadius: 6,
                }}>
                  {valueBetCount} value
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowFilter(f => !f)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: showFilter ? 'var(--gold-muted)' : 'var(--ivory-ghost)',
              border: `1px solid ${showFilter ? 'var(--gold-border)' : 'var(--ivory-border)'}`,
              color: showFilter ? 'var(--gold)' : 'var(--neutral)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>

        {/* Filter dropdown */}
        {showFilter && (
          <div style={{ marginTop: 10, padding: '10px', background: 'var(--obsidian-3)', borderRadius: 10, border: '1px solid var(--ivory-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--ivory-dim)' }}>
              <input
                type="checkbox"
                checked={filterValueBet}
                onChange={e => setFilterValueBet(e.target.checked)}
                style={{ accentColor: 'var(--gold)' }}
              />
              Afficher uniquement les Value Bets
            </label>
          </div>
        )}

        {/* League tabs */}
        <div className="fixtures-league-tabs">
          {leagues.map(lg => (
            <button
              key={lg.code}
              className={`league-tab ${selectedLeague === lg.code ? 'active' : ''}`}
              onClick={() => onSelectLeague(lg.code)}
            >
              {LEAGUE_FLAGS[lg.code] || ''} {LEAGUE_SHORT[lg.code] || lg.name}
            </button>
          ))}
        </div>
      </div>

      {/* Fixtures list */}
      <div className="fixtures-list">
        {filteredSchedule.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 24, marginBottom: 4, opacity: 0.4 }}>📭</div>
            Aucun match trouvé
          </div>
        ) : (
          filteredSchedule.map(fixture => {
            const hasVB = fixture.valueBets && fixture.valueBets.length > 0;
            const isFinished = fixture.status === 'FINISHED';

            return (
              <div
                key={fixture.id}
                className={`fixture-card ${hasVB ? 'value-bet' : ''}`}
                onClick={() => onSelectMatch?.(fixture)}
              >
                {/* Home */}
                <div className="fixture-team">
                  <TeamLogo teamName={fixture.homeTeam} size="sm" />
                  <span className="fixture-team-name">{fixture.homeTeam}</span>
                </div>

                {/* Center */}
                <div className="fixture-center">
                  <div className="fixture-score">
                    {isFinished
                      ? <span style={{ fontSize: '1.1rem' }}>{fixture.homeScore} – {fixture.awayScore}</span>
                      : fixture.status === 'LIVE'
                      ? <span style={{ fontSize: '0.95rem', color: 'var(--positive)', fontWeight: 700 }}>{fixture.score ? `${fixture.score.home}-${fixture.score.away}` : 'LIVE'}</span>
                      : <span className="fixture-vs">vs</span>
                    }
                  </div>
                  <div className="fixture-meta">{formatDate(fixture.matchDate)}</div>
                  {hasVB && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
                      <TrendingUp size={9} color="var(--gold)" />
                      <span className="value-badge" style={{ fontSize: 8, padding: '1px 5px' }}>
                        {fixture.valueBets[0].selection === '1' ? `1 (${fixture.homeTeam.slice(0, 4)}.)` : fixture.valueBets[0].selection === '2' ? `2 (${fixture.awayTeam.slice(0, 4)}.)` : 'N'} {fixture.valueBets[0].edge_percentage || fixture.valueBets[0].edge}
                      </span>
                    </div>
                  )}
                  {fixture.rating && (
                    <div style={{ fontSize: 9, color: 'var(--gold)', marginTop: 2, opacity: 0.8 }}>
                      ★ {fixture.rating}
                    </div>
                  )}
                </div>

                {/* Away */}
                <div className="fixture-team">
                  <TeamLogo teamName={fixture.awayTeam} size="sm" />
                  <span className="fixture-team-name">{fixture.awayTeam}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Match Details Modal for Fixtures */}
      <MatchDetailsModal
        match={detailsModalMatch}
        isOpen={Boolean(detailsModalMatch)}
        onClose={() => setDetailsModalMatch(null)}
      />
    </div>
  );
}
