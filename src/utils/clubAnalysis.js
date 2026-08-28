
/**
 * Utility to analyze club performance based on detailed match events.
 * 
 * Input format (matches):
 * [
 *   {
 *     homeTeam: "Marseille",
 *     awayTeam: "Monaco",
 *     score: "1-0",
 *     events: [ { time: "40'", type: "Yellow Card", team: "Marseille" }, ... ]
 *   },
 *   ...
 * ]
 */

export const analyzeClubEvents = (clubName, allMatches) => {
    const stats = {
        goalsFor: {
            total: 0,
            distribution: {
                '0-15': 0, '16-30': 0, '31-45': 0,
                '46-60': 0, '61-75': 0, '76-90+': 0
            }
        },
        goalsAgainst: {
            total: 0,
            distribution: {
                '0-15': 0, '16-30': 0, '31-45': 0,
                '46-60': 0, '61-75': 0, '76-90+': 0
            }
        },
        discipline: {
            yellow: 0,
            red: 0,
            total: 0,
            distribution: {
                '0-15': 0, '16-30': 0, '31-45': 0,
                '46-60': 0, '61-75': 0, '76-90+': 0
            }
        },
        penalties: {
            awarded: 0,
            conceded: 0,
            scored: 0, // for the club
            conceded_scored: 0 // against the club
        },
        scenarios: {
            cleanSheets: 0,
            failedToScore: 0,
            comebacks: 0, // Won after trailing
            droppedPoints: 0 // Lost/Draw after leading
        },
        players: {
            scorers: {},
            assisters: {}
        }
    };

    const clubMatches = allMatches.filter(m => m.homeTeam === clubName || m.awayTeam === clubName);

    clubMatches.forEach(match => {
        const isHome = match.homeTeam === clubName;
        const opponent = isHome ? match.awayTeam : match.homeTeam;

        // --- SCENARIO ANALYSIS (Simple approach) ---
        // Ideally we replay events to know if they led or trailed.
        // Let's replay the timeline.

        let clubScore = 0;
        let oppScore = 0;
        let ledAtSomePoint = false;
        let trailedAtSomePoint = false;
        let hasScored = false;
        let hasConceded = false;

        // Support both match.events and match.goals natively
        const rawEvents = match.events || (match.goals || []).map(g => ({
            time: g.time ? (String(g.time).includes("'") ? String(g.time) : `${g.time}'`) : "45'",
            type: 'Goal',
            team: g.team || (isHome ? match.homeTeam : match.awayTeam),
            player: g.player,
            detail: g.detail || ''
        }));

        // Sort events by time
        const sortedEvents = [...rawEvents].sort((a, b) => {
            const tA = parseInt(String(a.time).replace('+', '')) || 0;
            const tB = parseInt(String(b.time).replace('+', '')) || 0;
            return tA - tB;
        });

        sortedEvents.forEach(e => {
            const minStr = e.time.replace("'", "");
            const minute = parseInt(minStr) || 0;
            const isStoppage = minStr.includes('+') || minute > 90;

            // Bucket
            let bucket = '76-90+';
            if (minute <= 15) bucket = '0-15';
            else if (minute <= 30) bucket = '16-30';
            else if (minute <= 45) bucket = '31-45';
            else if (minute <= 60) bucket = '46-60';
            else if (minute <= 75) bucket = '61-75';

            if (e.type === 'Goal') {
                if (e.team === clubName) {
                    // GOAL FOR
                    stats.goalsFor.total++;
                    stats.goalsFor.distribution[bucket]++;
                    clubScore++;
                    hasScored = true;

                    // Track Scorer
                    if (e.player) {
                        const scorer = e.player.replace(/\(.*\)/, '').trim();
                        if (scorer) stats.players.scorers[scorer] = (stats.players.scorers[scorer] || 0) + 1;
                    }

                    // Track Assister
                    if (e.detail && e.detail.includes('Assist:')) {
                        const assister = e.detail.split('Assist:')[1].trim().replace(/\)$/, '');
                        if (assister) stats.players.assisters[assister] = (stats.players.assisters[assister] || 0) + 1;
                    }

                    if (e.detail && e.detail.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('penalty')) {
                        stats.penalties.awarded++;
                        stats.penalties.scored++;
                    }
                } else {
                    // GOAL AGAINST
                    stats.goalsAgainst.total++;
                    stats.goalsAgainst.distribution[bucket]++;
                    oppScore++;
                    hasConceded = true;

                    if (e.detail && e.detail.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('penalty')) {
                        stats.penalties.conceded++;
                        stats.penalties.conceded_scored++;
                    }
                }
            } else if (e.type === 'Yellow Card') {
                if (e.team === clubName) {
                    stats.discipline.yellow++;
                    stats.discipline.total++;
                    stats.discipline.distribution[bucket]++;
                }
            } else if (e.type === 'Red Card') {
                if (e.team === clubName) {
                    stats.discipline.red++;
                    stats.discipline.total++;
                    stats.discipline.distribution[bucket]++;
                }
            } else if (e.type === 'Other' && e.detail.includes('Pénalty manqué')) {
                // Determine who missed
                if (e.team === clubName) stats.penalties.awarded++;
                else stats.penalties.conceded++;
            }

            // State check
            if (clubScore > oppScore) ledAtSomePoint = true;
            if (clubScore < oppScore) trailedAtSomePoint = true;
        });

        // Scenario Conclusions
        if (!hasConceded) stats.scenarios.cleanSheets++;
        if (!hasScored) stats.scenarios.failedToScore++;

        const finalResult = clubScore > oppScore ? 'W' : (clubScore === oppScore ? 'D' : 'L');

        if (trailedAtSomePoint && finalResult === 'W') stats.scenarios.comebacks++;
        if (ledAtSomePoint && (finalResult === 'D' || finalResult === 'L')) stats.scenarios.droppedPoints++;
    });

    return stats;
};

// Helper for Recharts
export const getChartData = (stats) => {
    return Object.keys(stats.goalsFor.distribution).map(bucket => ({
        name: bucket,
        scored: stats.goalsFor.distribution[bucket],
        conceded: stats.goalsAgainst.distribution[bucket],
        cards: stats.discipline.distribution[bucket]
    }));
};
