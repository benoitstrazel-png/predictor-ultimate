import React from 'react';
import { ArrowRightLeft } from 'lucide-react';

/**
 * MatchTimeline Component
 * Replicates the exact visual timeline format provided in the reference image:
 * - 1ST HALF header with half-time score
 * - 2ND HALF header with full-time score
 * - Home team events aligned to the Left
 * - Away team events aligned to the Right
 * - Icons for Goal (ball + running score), Yellow Card, Red Card, Substitution (dual arrows), VAR badge
 */
export default function MatchTimeline({ match }) {
  if (!match) return null;

  const homeTeam = match.homeTeam || match.home_team || 'Domicile';
  const awayTeam = match.awayTeam || match.away_team || 'Extérieur';
  const rawEvents = match.timeline || [];

  // Fallback if timeline is empty: reconstruct from goals, cards, substitutions
  const events = React.useMemo(() => {
    if (rawEvents && rawEvents.length > 0) {
      return [...rawEvents].sort((a, b) => {
        const minA = a.minute || 0;
        const minB = b.minute || 0;
        if (minA !== minB) return minA - minB;
        return (a.addedTime || 0) - (b.addedTime || 0);
      });
    }

    const list = [];
    (match.goals || []).forEach((g, idx) => {
      const min = parseInt(String(g.time).replace('+', '.'), 10) || 0;
      const isHome = g.team ? (g.team.trim().toLowerCase() === homeTeam.trim().toLowerCase()) : true;
      list.push({
        id: `goal_${idx}`,
        period: min <= 45 ? '1ST_HALF' : '2ND_HALF',
        minute: min,
        minuteDisplay: `${g.time}'`,
        type: g.isPenalty ? 'PENALTY_GOAL' : (g.isOwnGoal ? 'OWN_GOAL' : 'GOAL'),
        isHome,
        teamName: g.team || (isHome ? homeTeam : awayTeam),
        player: g.player,
        assist: g.assist || (g.detail && g.detail.startsWith('Assist:') ? g.detail.replace('Assist:', '').trim() : null),
        score: g.score || match.score,
        isPenalty: Boolean(g.isPenalty),
        isOwnGoal: Boolean(g.isOwnGoal),
        detail: g.detail,
      });
    });

    (match.cards || []).forEach((c, idx) => {
      const min = parseInt(String(c.time).replace('+', '.'), 10) || 0;
      const isHome = c.team ? (c.team.trim().toLowerCase() === homeTeam.trim().toLowerCase()) : false;
      list.push({
        id: `card_${idx}`,
        period: min <= 45 ? '1ST_HALF' : '2ND_HALF',
        minute: min,
        minuteDisplay: `${c.time}'`,
        type: c.type === 'RED' ? 'RED_CARD' : 'YELLOW_CARD',
        cardType: c.type || 'YELLOW',
        isHome,
        teamName: c.team || (isHome ? homeTeam : awayTeam),
        player: c.player,
        reason: c.detail ? c.detail.replace('Carton Yellow', '').replace('Carton Red', '').trim() || 'Faute de jeu' : 'Faute de jeu',
        detail: c.detail,
      });
    });

    (match.substitutions || []).forEach((s, idx) => {
      const min = parseInt(String(s.time).replace('+', '.'), 10) || 0;
      const isHome = s.team ? (s.team.trim().toLowerCase() === homeTeam.trim().toLowerCase()) : true;
      list.push({
        id: `sub_${idx}`,
        period: min <= 45 ? '1ST_HALF' : '2ND_HALF',
        minute: min,
        minuteDisplay: `${s.time}'`,
        type: 'SUBSTITUTION',
        isHome,
        teamName: s.team || (isHome ? homeTeam : awayTeam),
        playerIn: s.playerIn,
        playerOut: s.playerOut,
        isInjury: false,
        detail: `Entrée: ${s.playerIn} / Sortie: ${s.playerOut}`,
      });
    });

    return list.sort((a, b) => a.minute - b.minute);
  }, [match, rawEvents, homeTeam, awayTeam]);

  // Group events by period
  const firstHalfEvents = events.filter(e => e.period === '1ST_HALF' || e.minute <= 45);
  const secondHalfEvents = events.filter(e => e.period === '2ND_HALF' || (e.minute > 45 && e.minute <= 90));
  const extraTimeEvents = events.filter(e => e.period === 'EXTRA_TIME' || e.minute > 90);

  // Score calculations at half-time and full-time
  const htScore = match.halfTimeScore || (firstHalfEvents.length > 0
    ? `${firstHalfEvents.filter(e => e.type?.includes('GOAL') && e.isHome).length} - ${firstHalfEvents.filter(e => e.type?.includes('GOAL') && !e.isHome).length}`
    : '0 - 0');

  const ftScore = match.score ? (typeof match.score === 'object' ? `${match.score.home} - ${match.score.away}` : match.score.replace('-', ' - ')) : (match.homeScore !== undefined ? `${match.homeScore} - ${match.awayScore}` : '0 - 0');

  // Render a single event item
  const renderEventRow = (ev) => {
    const isHome = ev.isHome;
    const isGoal = ev.type === 'GOAL' || ev.type === 'PENALTY_GOAL' || ev.type === 'OWN_GOAL';
    const isYellow = ev.type === 'YELLOW_CARD';
    const isRed = ev.type === 'RED_CARD';
    const isYellowRed = ev.type === 'YELLOW_RED_CARD';
    const isSub = ev.type === 'SUBSTITUTION';
    const isVar = ev.type === 'VAR' || ev.type?.includes('VAR');

    return (
      <div
        key={ev.id || `${ev.minute}_${ev.type}_${ev.player || ev.playerIn}`}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
          alignItems: 'center',
          padding: '7px 12px',
          borderRadius: 8,
          transition: 'background 0.15s ease',
        }}
        className="timeline-row hover:bg-white/[0.03]"
      >
        {/* ── HOME SIDE (LEFT) ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', minHeight: 28 }}>
          {isHome ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap' }}>
              {/* Minute */}
              <span style={{
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--ivory)',
                minWidth: 32,
                fontFamily: 'monospace'
              }}>
                {ev.minuteDisplay || `${ev.minute}'`}
              </span>

              {/* Icon & Details based on event type */}
              {isGoal && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13
                  }}>
                    ⚽
                  </div>
                  {ev.score && (
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)' }}>
                      {ev.score}
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ivory)' }}>
                    {ev.player}
                  </span>
                  {ev.assist && (
                    <span style={{ fontSize: 12, color: 'var(--neutral)' }}>
                      ({ev.assist})
                    </span>
                  )}
                  {ev.isPenalty && (
                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(234, 179, 8, 0.2)', color: '#fbbf24', fontWeight: 600 }}>
                      (P)
                    </span>
                  )}
                  {ev.isOwnGoal && (
                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontWeight: 600 }}>
                      (CSC)
                    </span>
                  )}
                </div>
              )}

              {isYellow && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 13,
                    height: 18,
                    borderRadius: 2,
                    background: '#eab308',
                    display: 'inline-block',
                    boxShadow: '0 0 8px rgba(234, 179, 8, 0.4)',
                  }} />
                  {(ev.isCoach || ev.reason?.toLowerCase().includes('entraîneur') || ev.reason?.toLowerCase().includes('entraineur')) && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: 'var(--gold)',
                      background: 'rgba(201, 169, 110, 0.15)',
                      border: '1px solid var(--gold-border)',
                      padding: '1px 6px',
                      borderRadius: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3
                    }}>
                      👔 Entraîneur
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ivory)' }}>
                    {ev.player}
                  </span>
                  {ev.reason && (
                    <span style={{ fontSize: 12, color: 'var(--neutral)' }}>
                      ({ev.reason})
                    </span>
                  )}
                </div>
              )}

              {(isRed || isYellowRed) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isYellowRed ? (
                    <div style={{ display: 'flex', gap: 2 }}>
                      <span style={{ width: 10, height: 18, borderRadius: 2, background: '#eab308' }} />
                      <span style={{ width: 10, height: 18, borderRadius: 2, background: '#ef4444' }} />
                    </div>
                  ) : (
                    <span style={{
                      width: 13,
                      height: 18,
                      borderRadius: 2,
                      background: '#ef4444',
                      display: 'inline-block',
                      boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
                    }} />
                  )}
                  {(ev.isCoach || ev.reason?.toLowerCase().includes('entraîneur') || ev.reason?.toLowerCase().includes('entraineur')) && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: 'var(--gold)',
                      background: 'rgba(201, 169, 110, 0.15)',
                      border: '1px solid var(--gold-border)',
                      padding: '1px 6px',
                      borderRadius: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3
                    }}>
                      👔 Entraîneur
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ivory)' }}>
                    {ev.player}
                  </span>
                  {ev.reason && (
                    <span style={{ fontSize: 12, color: '#f87171' }}>
                      ({ev.reason})
                    </span>
                  )}
                </div>
              )}

              {isSub && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#4ade80',
                  }}>
                    <ArrowRightLeft size={13} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ivory)' }}>
                    {ev.playerIn}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--neutral)' }}>
                    {ev.playerOut}
                  </span>
                  {ev.isInjury && (
                    <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>
                      (Blessure)
                    </span>
                  )}
                </div>
              )}

              {isVar && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: 'var(--ivory)',
                    letterSpacing: '0.05em',
                  }}>
                    VAR
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--neutral)' }}>
                    {ev.detail || 'Décision arbitrale vérifiée'}
                  </span>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* ── AWAY SIDE (RIGHT) ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minHeight: 28 }}>
          {!isHome ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
              {/* Icon & Details based on event type */}
              {isGoal && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {ev.isPenalty && (
                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(234, 179, 8, 0.2)', color: '#fbbf24', fontWeight: 600 }}>
                      (P)
                    </span>
                  )}
                  {ev.isOwnGoal && (
                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontWeight: 600 }}>
                      (CSC)
                    </span>
                  )}
                  {ev.assist && (
                    <span style={{ fontSize: 12, color: 'var(--neutral)' }}>
                      ({ev.assist})
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ivory)' }}>
                    {ev.player}
                  </span>
                  {ev.score && (
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)' }}>
                      {ev.score}
                    </span>
                  )}
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13
                  }}>
                    ⚽
                  </div>
                </div>
              )}

              {isYellow && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {ev.reason && (
                    <span style={{ fontSize: 12, color: 'var(--neutral)' }}>
                      ({ev.reason})
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ivory)' }}>
                    {ev.player}
                  </span>
                  {(ev.isCoach || ev.reason?.toLowerCase().includes('entraîneur') || ev.reason?.toLowerCase().includes('entraineur')) && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: 'var(--gold)',
                      background: 'rgba(201, 169, 110, 0.15)',
                      border: '1px solid var(--gold-border)',
                      padding: '1px 6px',
                      borderRadius: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3
                    }}>
                      👔 Entraîneur
                    </span>
                  )}
                  <span style={{
                    width: 13,
                    height: 18,
                    borderRadius: 2,
                    background: '#eab308',
                    display: 'inline-block',
                    boxShadow: '0 0 8px rgba(234, 179, 8, 0.4)',
                  }} />
                </div>
              )}

              {(isRed || isYellowRed) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {ev.reason && (
                    <span style={{ fontSize: 12, color: '#f87171' }}>
                      ({ev.reason})
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ivory)' }}>
                    {ev.player}
                  </span>
                  {(ev.isCoach || ev.reason?.toLowerCase().includes('entraîneur') || ev.reason?.toLowerCase().includes('entraineur')) && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: 'var(--gold)',
                      background: 'rgba(201, 169, 110, 0.15)',
                      border: '1px solid var(--gold-border)',
                      padding: '1px 6px',
                      borderRadius: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3
                    }}>
                      👔 Entraîneur
                    </span>
                  )}
                  {isYellowRed ? (
                    <div style={{ display: 'flex', gap: 2 }}>
                      <span style={{ width: 10, height: 18, borderRadius: 2, background: '#eab308' }} />
                      <span style={{ width: 10, height: 18, borderRadius: 2, background: '#ef4444' }} />
                    </div>
                  ) : (
                    <span style={{
                      width: 13,
                      height: 18,
                      borderRadius: 2,
                      background: '#ef4444',
                      display: 'inline-block',
                      boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
                    }} />
                  )}
                </div>
              )}

              {isSub && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {ev.isInjury && (
                    <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>
                      (Blessure)
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--neutral)' }}>
                    {ev.playerOut}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ivory)' }}>
                    {ev.playerIn}
                  </span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#4ade80',
                  }}>
                    <ArrowRightLeft size={13} />
                  </div>
                </div>
              )}

              {isVar && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--neutral)' }}>
                    {ev.detail || 'Décision arbitrale vérifiée'}
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: 'var(--ivory)',
                    letterSpacing: '0.05em',
                  }}>
                    VAR
                  </span>
                </div>
              )}

              {/* Minute */}
              <span style={{
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--ivory)',
                minWidth: 32,
                textAlign: 'right',
                fontFamily: 'monospace'
              }}>
                {ev.minuteDisplay || `${ev.minute}'`}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      background: 'rgba(13, 18, 32, 0.65)',
      borderRadius: 16,
      padding: '20px 16px',
      border: '1px solid var(--ivory-border)',
    }}>
      {/* ── 1ST HALF SECTION ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            color: 'var(--ivory-dim)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase'
          }}>
            1ST HALF
          </span>
          <span style={{
            fontSize: 12,
            fontWeight: 800,
            color: 'var(--gold)',
            fontFamily: 'monospace'
          }}>
            {htScore}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {firstHalfEvents.length > 0 ? (
            firstHalfEvents.map(renderEventRow)
          ) : (
            <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 11, color: 'var(--neutral)', fontStyle: 'italic' }}>
              Aucun événement marquant en première mi-temps.
            </div>
          )}
        </div>
      </div>

      {/* ── 2ND HALF SECTION ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            color: 'var(--ivory-dim)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase'
          }}>
            2ND HALF
          </span>
          <span style={{
            fontSize: 12,
            fontWeight: 800,
            color: 'var(--gold)',
            fontFamily: 'monospace'
          }}>
            {ftScore}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {secondHalfEvents.length > 0 ? (
            secondHalfEvents.map(renderEventRow)
          ) : (
            <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 11, color: 'var(--neutral)', fontStyle: 'italic' }}>
              Aucun événement marquant en seconde mi-temps.
            </div>
          )}
        </div>
      </div>

      {/* ── EXTRA TIME (IF APPLICABLE) ── */}
      {extraTimeEvents.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            <span style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--gold)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}>
              PROLONGATIONS
            </span>
            <span style={{
              fontSize: 12,
              fontWeight: 800,
              color: 'var(--gold)',
              fontFamily: 'monospace'
            }}>
              {ftScore}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {extraTimeEvents.map(renderEventRow)}
          </div>
        </div>
      )}
    </div>
  );
}
