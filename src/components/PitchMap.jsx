import React, { useMemo } from 'react';
import { getPlayerPhoto } from '../utils/playerPhotos';
import { PLAYERS_DB } from '../data/players_static';
import ALL_LINEUPS from '../data/lineups_2025_2026.json';
import TM_POSITIONS from '../data/player_positions_tm.json';
import CALCULATED_STATS from '../data/player_stats_calculated.json';

// Helper: Map TM Position to G/D/M/A
const getTmRole = (name) => {
    const norm = (str) => {
        if (typeof str !== 'string') return "";
        return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "").trim();
    };
    const n = norm(name);

    let found = null;
    // 1. Exact Match
    for (const [key, val] of Object.entries(TM_POSITIONS || {})) {
        if (norm(key) === n) { found = val; break; }
    }

    // 2. Fuzzy
    if (!found) {
        const parts = n.split(' ').filter(x => x.length > 1);
        if (parts.length > 0) {
            for (const [key, val] of Object.entries(TM_POSITIONS || {})) {
                const kNorm = norm(key);
                if (kNorm.includes(parts[parts.length - 1]) && (parts.length === 1 || kNorm.includes(parts[0]))) {
                    found = val;
                    break;
                }
            }
        }
    }

    if (found && found.main) {
        if (found.main.includes('Gardien')) return 'G';
        if (found.main.includes('Défense')) return 'D';
        if (found.main.includes('Milieu')) return 'M';
        if (found.main.includes('Attaquant')) return 'A';
    }
    return null; // Fallback
};

const PitchMap = ({ clubName, roster, stats, schedule, currentWeek, matchHistory, showFullSquad }) => {

    // --- FORMATION COORDINATES DEFINITIONS ---
    const FORMATION_COORDS = {
        "4-3-3": {
            G: [{ top: 88, left: 50 }],
            D: [{ top: 68, left: 15 }, { top: 68, left: 38 }, { top: 68, left: 62 }, { top: 68, left: 85 }],
            M: [{ top: 48, left: 20 }, { top: 48, left: 50 }, { top: 48, left: 80 }],
            A: [{ top: 18, left: 20 }, { top: 18, left: 50 }, { top: 18, left: 80 }]
        },
        "4-4-2": {
            G: [{ top: 88, left: 50 }],
            D: [{ top: 68, left: 15 }, { top: 68, left: 38 }, { top: 68, left: 62 }, { top: 68, left: 85 }],
            M: [{ top: 40, left: 15 }, { top: 48, left: 38 }, { top: 48, left: 62 }, { top: 40, left: 85 }],
            A: [{ top: 18, left: 35 }, { top: 18, left: 65 }]
        },
        "4-2-3-1": {
            G: [{ top: 88, left: 50 }],
            D: [{ top: 68, left: 15 }, { top: 68, left: 38 }, { top: 68, left: 62 }, { top: 68, left: 85 }],
            M: [
                { top: 52, left: 35 }, { top: 52, left: 65 }, // CDMs
                { top: 30, left: 20 }, { top: 30, left: 50 }, { top: 30, left: 80 } // AMs
            ],
            A: [{ top: 12, left: 50 }]
        },
        "3-5-2": {
            G: [{ top: 88, left: 50 }],
            D: [{ top: 68, left: 25 }, { top: 68, left: 50 }, { top: 68, left: 75 }],
            M: [
                { top: 50, left: 10 }, { top: 50, left: 90 }, // Wingbacks
                { top: 50, left: 35 }, { top: 45, left: 50 }, { top: 50, left: 65 } // Central Mids
            ],
            A: [{ top: 18, left: 35 }, { top: 18, left: 65 }]
        },
        "3-4-3": {
            G: [{ top: 88, left: 50 }],
            D: [{ top: 68, left: 25 }, { top: 68, left: 50 }, { top: 68, left: 75 }],
            M: [{ top: 45, left: 15 }, { top: 45, left: 38 }, { top: 45, left: 62 }, { top: 45, left: 85 }],
            A: [{ top: 18, left: 20 }, { top: 18, left: 50 }, { top: 18, left: 80 }]
        },
        "5-4-1": {
            G: [{ top: 88, left: 50 }],
            D: [{ top: 70, left: 10 }, { top: 70, left: 30 }, { top: 70, left: 50 }, { top: 70, left: 70 }, { top: 70, left: 90 }],
            M: [{ top: 50, left: 20 }, { top: 50, left: 40 }, { top: 50, left: 60 }, { top: 50, left: 80 }],
            A: [{ top: 15, left: 50 }]
        },
        // 4-1-4-1 (Mapped as M=5, A=1)
        "4-1-4-1": {
            G: [{ top: 88, left: 50 }],
            D: [{ top: 70, left: 15 }, { top: 70, left: 38 }, { top: 70, left: 62 }, { top: 70, left: 85 }],
            M: [
                { top: 55, left: 50 }, // DM
                { top: 38, left: 15 }, { top: 38, left: 38 }, { top: 38, left: 62 }, { top: 38, left: 85 } // 4 AMs
            ],
            A: [{ top: 15, left: 50 }]
        },
        // 3-4-2-1 (Mapped as M=6, A=1)
        "3-4-2-1": {
            G: [{ top: 88, left: 50 }],
            D: [{ top: 72, left: 25 }, { top: 72, left: 50 }, { top: 72, left: 75 }],
            M: [
                // 4 Mids (Wingbacks + CMs)
                { top: 55, left: 10 }, { top: 55, left: 35 }, { top: 55, left: 65 }, { top: 55, left: 90 },
                // 2 AMs (Categorized as M by parser)
                { top: 35, left: 30 }, { top: 35, left: 70 }
            ],
            A: [{ top: 15, left: 50 }]
        },
        // Fallback or mapped types
        "5-3-2": "3-5-2",
        "5-2-3": "3-4-3",
        "3-4-1-2": "3-5-2", // M=5, A=2
        "4-5-1": "4-1-4-1" // Use the same layout
    };

    const getCoords = (formation, pos, index, total) => {
        let layoutName = formation;
        // Handle aliases
        if (typeof FORMATION_COORDS[formation] === 'string') {
            layoutName = FORMATION_COORDS[formation];
        }
        // Fallback to 4-3-3 if unknown
        if (!FORMATION_COORDS[layoutName]) layoutName = "4-3-3";

        const scheme = FORMATION_COORDS[layoutName];
        const posGroup = scheme[pos];
        if (!posGroup) return { top: 50, left: 50 };

        // Safety: if we have more players than slots (e.g. backfill), distribute evenly
        if (index >= posGroup.length) {
            const step = 100 / (total + 1);
            return {
                top: pos === 'G' ? 88 : pos === 'D' ? 68 : pos === 'M' ? 48 : 18,
                left: step * (index + 1)
            };
        }

        return posGroup[index];
    };

    // Defined before useMemo key logic

    // Next Opponent Finder
    const getNextMatch = (cName) => {
        if (!schedule || !currentWeek) return null;
        const upcoming = schedule.find(m =>
            m.week > currentWeek &&
            m.status !== 'FINISHED' &&
            (m.homeTeam === cName || m.awayTeam === cName)
        );
        if (!upcoming) return "Saison terminée";
        return upcoming.homeTeam === cName ? upcoming.awayTeam : upcoming.homeTeam;
    };

    // Last Match Stats Parser
    const getLastMatchStats = (playerName, cName) => {
        if (!matchHistory || matchHistory.length === 0) return null;

        // 1. Find last played match for club
        const playedMatches = matchHistory
            .filter(m => (m.homeTeam === cName || m.awayTeam === cName) && (m.score && m.score !== '-'))
            // Sort by Round Number Descending (Fix for missing dates)
            .sort((a, b) => {
                const getR = r => r ? parseInt((r.match(/\d+/) || [0])[0], 10) : 0;
                return getR(b.round) - getR(a.round);
            });

        const lastMatch = playedMatches[0];
        if (!lastMatch) return null;

        const opponent = lastMatch.homeTeam === cName ? lastMatch.awayTeam : lastMatch.homeTeam;
        const score = lastMatch.score; // e.g. "2-1" or object {home: 2, away: 1} - handle format

        let scoreStr = score;
        if (typeof score === 'object') {
            scoreStr = `${score.home}-${score.away}`;
        }

        // 2. Parse Events for Player
        let goals = 0;
        let assists = 0;
        let rating = null; // Not typically in events, maybe in future
        let yellow = false;
        let red = false;

        if (lastMatch.events) {
            const norm = (str) => str?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() || "";
            const safeMatch = (n1, n2) => {
                if (!n1 || !n2) return false;
                // Matches like "Gouiri A." vs "Amine Gouiri"
                const t1 = n1.split(' ').filter(x => x.length > 1);
                const t2 = n2.split(' ').filter(x => x.length > 1);
                return t1.some(a => t2.some(b => b === a || (b.includes(a) && a.length > 3)));
            };
            const pNorm = norm(playerName);

            (lastMatch.events || []).forEach(e => {
                // Check if player involved
                let involved = false;
                if (e.players) {
                    involved = e.players.some(p => safeMatch(norm(p), pNorm));
                }

                if (involved) {
                    if (e.type === 'Goal') goals++;
                    if (e.type === 'Yellow Card') yellow = true;
                    if (e.type === 'Red Card') red = true;
                }

                // Assist check in detail
                if (e.detail && e.detail.includes(playerName.split(' ').pop())) {
                    // Very rough heuristic for assist if name in detail
                    // Ideally parse e.detail properly
                }
                // Better assist check: e.detail is typically the assister name
                if (e.type === 'Goal' && e.detail && safeMatch(norm(e.detail), pNorm)) {
                    assists++;
                }
            });
        }

        return { opponent, score: scoreStr, goals, assists, yellow, red };
    };

    const getPlayerStats = (name) => {
        let goals = 0;
        let assists = 0;
        const norm = (str) => str?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() || "";
        const safeMatch = (n1, n2) => {
            if (!n1 || !n2) return false;
            if (n1 === n2) return true;
            const t1 = n1.split(' ').filter(x => x.length > 1);
            const t2 = n2.split(' ').filter(x => x.length > 1);
            return t1.some(a => t2.some(b => b === a || (b.includes(a) && a.length > 3)));
        };

        if (stats && stats.scorers) {
            Object.entries(stats.scorers).forEach(([sName, sCount]) => {
                if (safeMatch(norm(sName), norm(name))) goals = sCount;
            });
        }
        if (stats && stats.assisters) {
            Object.entries(stats.assisters).forEach(([aName, aCount]) => {
                if (safeMatch(norm(aName), norm(name))) assists = aCount;
            });
        }
        return { goals, assists };
    };

    // Helper: Extract ID from URL
    const extractId = (url) => {
        if (!url) return "";
        if (!url.includes("http")) return url; // Already an ID
        const match = url.match(/match\/([^/]+)/);
        return match ? match[1] : "";
    };


    // Helper: Map TM Position to Side/Role
    const getDetailedRole = (name) => {
        const norm = (str) => {
            if (typeof str !== 'string') return "";
            return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "").trim();
        };
        const n = norm(name);

        // 1. Exact/Fuzzy Match from JSON
        let found = null;
        for (const [key, val] of Object.entries(TM_POSITIONS || {})) {
            if (norm(key) === n) { found = val; break; }
        }
        if (!found) {
            const parts = n.split(' ').filter(x => x.length > 1);
            if (parts.length > 0) {
                for (const [key, val] of Object.entries(TM_POSITIONS || {})) {
                    const kNorm = norm(key);
                    if (kNorm.includes(parts[parts.length - 1]) && (parts.length === 1 || kNorm.includes(parts[0]))) {
                        found = val;
                        break;
                    }
                }
            }
        }

        // 2. Map to Role+Side
        if (found && found.main) {
            const m = found.main.toLowerCase();
            // Goalkeepers
            if (m.includes('gardien')) return { role: 'G', side: 'center', sort: 0 };

            // Defenders
            if (m.includes('défense')) {
                if (m.includes('gauche')) return { role: 'D', side: 'left', sort: 0 };
                if (m.includes('droit')) return { role: 'D', side: 'right', sort: 2 };
                return { role: 'D', side: 'center', sort: 1 };
            }

            // Midfielders
            if (m.includes('milieu')) {
                if (m.includes('gauche') || m.includes('offensif')) return { role: 'M', side: 'left', sort: 0 }; // often AM are central/free but 'offensif' treated generic here
                if (m.includes('droit')) return { role: 'M', side: 'right', sort: 2 };
                if (m.includes('défensif') || m.includes('central')) return { role: 'M', side: 'center', sort: 1 };
                return { role: 'M', side: 'center', sort: 1 };
            }

            // Attackers
            if (m.includes('attaquant')) {
                if (m.includes('ailier gauche')) return { role: 'A', side: 'left', sort: 0 };
                if (m.includes('ailier droit')) return { role: 'A', side: 'right', sort: 2 };
                if (m.includes('avant-centre')) return { role: 'A', side: 'center', sort: 1 };
                return { role: 'A', side: 'center', sort: 1 };
            }
        }
        return null;
    };

    // 1. Filter roster by position AND "Apps in Lineup" rule
    const { team, dominantFormation, startsMap } = useMemo(() => {
        const safeRoster = roster || [];
        const norm = (str) => {
            if (typeof str !== 'string') return "";
            return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        };

        // Helper: Strict token matching without false-positive collisions
        const namesMatch = (n1, n2) => {
            if (!n1 || !n2) return false;
            const s1 = norm(n1);
            const s2 = norm(n2);
            if (s1 === s2) return true;
            const t1 = s1.split(' ').filter(x => x.length > 2);
            const t2 = s2.split(' ').filter(x => x.length > 2);
            if (t1.length === 0 || t2.length === 0) return false;
            const last1 = t1[t1.length - 1];
            const last2 = t2[t2.length - 1];
            if (last1 === last2 && (t1.length === 1 || t2.length === 1 || t1[0] === t2[0])) return true;
            return false;
        };

        // A. ANALYZE LINEUPS (Starts Count & Formation)
        const startsCount = new Map();
        const activePlayerNames = new Set();
        const formationFreq = {};
        let targetMatch = null;
        let targetSide = null; // 'home' or 'away'

        ALL_LINEUPS.forEach(match => {
            const homeNorm = norm(match.teams.home);
            const awayNorm = norm(match.teams.away);
            const clubNorm = norm(clubName);

            let isHome = homeNorm.includes(clubNorm) || clubNorm.includes(homeNorm);
            let isAway = awayNorm.includes(clubNorm) || clubNorm.includes(awayNorm);

            // Special explicit aliases if normalization isn't enough
            if (clubName === 'Rennes' && (match.teams.home.includes('Rennes') || match.teams.away.includes('Rennes'))) {
                isHome = match.teams.home.includes('Rennes');
                isAway = match.teams.away.includes('Rennes');
            }
            if (clubName === 'Auxerre' && (match.teams.home.includes('Auxerre') || match.teams.away.includes('Auxerre'))) {
                isHome = match.teams.home.includes('Auxerre');
                isAway = match.teams.away.includes('Auxerre');
            }
            if (clubName === 'Le Havre' && (match.teams.home.includes('Le Havre') || match.teams.away.includes('Le Havre'))) {
                isHome = match.teams.home.includes('Le Havre');
                isAway = match.teams.away.includes('Le Havre');
            }



            if (isHome || isAway) {
                if (!targetMatch) {
                    targetMatch = match;
                    targetSide = isHome ? 'home' : 'away';
                }

                const side = isHome ? 'home' : 'away';
                const starters = side === 'home' ? match.lineups.homeStarters : match.lineups.awayStarters;
                const formation = side === 'home' ? match.lineups.homeFormation : match.lineups.awayFormation;

                // Track Formation
                if (formation) {
                    formationFreq[formation] = (formationFreq[formation] || 0) + 1;
                }

                // Track Starts
                starters.forEach(name => {
                    if (typeof name !== 'string') return;
                    const n = norm(name.replace(/\(.*\)/g, '')).trim();
                    activePlayerNames.add(n);
                    startsCount.set(n, (startsCount.get(n) || 0) + 1);
                });

                // Track Subs (Active Names only)
                const subs = side === 'home' ? match.lineups.homeSubstitutes : match.lineups.awaySubstitutes;
                subs.forEach(name => {
                    if (typeof name !== 'string') return;
                    const n = norm(name.replace(/\(.*\)/g, '')).trim();
                    activePlayerNames.add(n);
                });
            }
        });

        // Pick Dominant Formation
        let topFormation = "4-3-3";
        let maxCount = 0;
        for (const [fmt, cnt] of Object.entries(formationFreq)) {
            if (cnt > maxCount) {
                maxCount = cnt;
                topFormation = fmt;
            }
        }

        // B. TRANSIENT PLAYER GENERATION (Only if needed)
        const transientPlayers = [];
        const EXCLUSIONS = {
            'Stade Brestois 29': ['Pierre Lees-Melou', 'Lees-Melou'],
            'Stade Rennais Fc': ['Brice Samba']
        };
        const ALIASES = {
            'A. Sbai': 'Sbai', // Try to match "Sbai" broadly if "A. Sbai" fails
            'Doumbia K.': 'Kamory Doumbia'
        };

        if (targetMatch) {
            const startersRaw = targetSide === 'home' ? targetMatch.lineups.homeStarters : targetMatch.lineups.awayStarters;
            const formationStr = targetSide === 'home' ? targetMatch.lineups.homeFormation : targetMatch.lineups.awayFormation;

            let counts = { D: 4, M: 3, A: 3 };
            if (formationStr) {
                const parts = formationStr.split('-').map(Number);
                if (parts.length >= 3) {
                    counts.D = parts[0];
                    counts.A = parts[parts.length - 1];
                    counts.M = parts.slice(1, parts.length - 1).reduce((a, b) => a + b, 0);
                }
            }

            startersRaw.forEach((rawName, index) => {
                let cleanName = typeof rawName === 'string' ? rawName.replace(/\(.*\)/g, '').trim() : "";

                // 1. Check Aliases
                if (ALIASES[cleanName]) cleanName = ALIASES[cleanName];

                // 2. Check Exclusions
                const clubExcludes = EXCLUSIONS[clubName] || [];
                // clubName comes from props. Note: mapped name might be needed. 
                // But EXCLUSIONS keys should match what's passed in.

                // Robust exclusion check
                const isExcluded = clubExcludes.some(ex => namesMatch(norm(ex), norm(cleanName)));
                if (isExcluded) return;

                const normName = norm(cleanName);

                // Use robust matching to check if exists
                const exists = safeRoster.some(p => namesMatch(norm(p.name), normName));

                if (!exists) {
                    let position = 'M';
                    if (index === 0) position = 'G';
                    else if (index <= counts.D) position = 'D';
                    else if (index <= counts.D + counts.M) position = 'M';
                    else position = 'A';
                    if (typeof rawName === 'string' && rawName.includes('(G)')) position = 'G';

                    transientPlayers.push({
                        name: cleanName,
                        position: position,
                        rating: 6.5,
                        mj: 1,
                        isTransient: true
                    });
                }
            });
        }

        // C. MERGE & DEDUPE ROSTER
        // Prioritize SafeRoster (from DB/API) over Transient Players (from Lineups)
        const mergedList = [...safeRoster];
        transientPlayers.forEach(tp => {
            const tpNorm = norm(tp.name);
            // Robust check: match ANY existing roster player?
            const isDuplicate = safeRoster.some(rp => namesMatch(norm(rp.name), tpNorm));
            if (!isDuplicate) {
                mergedList.push(tp);
            }
        });
        const fullRoster = mergedList;


        // D. SELECT SQUAD using Dominant Formation Counts
        let targetCounts = { G: 1, D: 4, M: 3, A: 3 };
        const parts = topFormation.split('-').map(Number);
        if (parts.length >= 3) {
            targetCounts.D = parts[0];
            targetCounts.A = parts[parts.length - 1];
            targetCounts.M = parts.slice(1, parts.length - 1).reduce((a, b) => a + b, 0);
        }

        const getStartsInternal = (name, map) => {
            const n = norm(name);
            if (map.has(n)) return map.get(n);
            for (let [k, v] of map) {
                if (namesMatch(n, k)) return v;
            }
            return 0;
        };

        const selectedNames = new Set();

        const getBest = (pos, count) => {
            // FIX: If activePlayerNames is empty (no lineup data found), ALLOW ALL players to be candidates.
            const allowAll = activePlayerNames.size === 0;

            const isActive = (pName) => {
                const normName = norm(pName);
                if (allowAll) return true; // Fallback
                if (activePlayerNames.has(normName)) return true;
                for (let activeName of activePlayerNames) {
                    if (namesMatch(normName, activeName)) return true;
                }
                return false;
            };

            const getMinutes = (pName) => {
                const n = norm(pName);
                if (!CALCULATED_STATS) return 0;
                // Search in CALCULATED_STATS for this club
                const teamStats = CALCULATED_STATS[clubName] || [];
                // If team stats empty, try finding player in global values just in case? No, inaccurate.
                // Just use the roster candidates logic if no stats.
                if (!teamStats.length) return 0;

                const found = teamStats.find(ps => namesMatch(norm(ps.name), n));
                return found ? found.minutesPlayed : 0;
            };

            // 1. Get Strict matches (Starters or played games)
            let candidates = fullRoster.filter(p => {
                const n = norm(p.name);
                if (selectedNames.has(n)) return false;
                if (!isActive(p.name)) return false;

                // Determine Position: TM > Roster > Guess
                const tmDetails = getDetailedRole(p.name);
                const effectivePos = tmDetails ? tmDetails.role : p.position;

                let dbPlayer = PLAYERS_DB.find(db => namesMatch(norm(db.Player), n));
                // Bonus for Starts in DB
                // Strict pos checking
                if (effectivePos === pos) return true;
                return false;
            });

            // Fallback: If not enough strict matches, allow loosely matched positions
            // e.g. A defender listed as M
            if (candidates.length < count) {
                const looseCandidates = fullRoster.filter(p => {
                    const n = norm(p.name);
                    if (selectedNames.has(n)) return false;
                    if (!isActive(p.name)) return false;
                    if (candidates.includes(p)) return false;
                    return true;
                });
                // Sort loose candidates by rating/starts to pick best available regardless of pos
                looseCandidates.sort((a, b) => (b.rating || 0) - (a.rating || 0));

                // Try to fill with best available
                // But we prefer same position if possible
                const samePosLoose = looseCandidates.filter(p => p.position === pos);
                const otherPosLoose = looseCandidates.filter(p => p.position !== pos);

                candidates = [...candidates, ...samePosLoose, ...otherPosLoose];
            }

            // Sort by: 1. Minutes (Calculated) -> 2. Starts (Lineups) → 3. Rating
            candidates.sort((a, b) => {
                const minA = getMinutes(a.name);
                const minB = getMinutes(b.name);
                if (minA !== minB) return minB - minA;

                const sA = getStartsInternal(a.name, startsCount);
                const sB = getStartsInternal(b.name, startsCount);
                if (sA !== sB) return sB - sA;

                const ratingA = a.rating || 0;
                const ratingB = b.rating || 0;
                return ratingB - ratingA;
            });

            // Limit and Register
            const finalSelection = candidates.slice(0, count);

            // POST-SELECTION SORT: Optimize Left->Right placement based on detailed roles
            // e.g. Left Wing should be index 0, Right Wing index last
            finalSelection.sort((a, b) => {
                const roleA = getDetailedRole(a.name);
                const roleB = getDetailedRole(b.name);
                const sortA = roleA ? roleA.sort : 1; // Default to Center (1)
                const sortB = roleB ? roleB.sort : 1;
                return sortA - sortB;
            });


            finalSelection.forEach(p => selectedNames.add(norm(p.name)));
            return finalSelection;
        };

        // Execution Order: G -> D -> M -> A (Defensive spine first)
        const team = {
            G: getBest('G', targetCounts.G),
            D: getBest('D', targetCounts.D),
            M: getBest('M', targetCounts.M),
            A: getBest('A', targetCounts.A),
        };

        return { team, dominantFormation: topFormation, startsMap: startsCount, fullRoster };

    }, [roster, clubName]);



    const PlayerNode = ({ player, position, index, total, formation, stats, startsMap }) => {
        // Local version of getPlayerStats using stats prop
        const getPlayerStatsLocal = (name) => {
            let goals = 0, assists = 0;
            const norm = (str) => str?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() || "";
            const safeMatch = (n1, n2) => {
                if (!n1 || !n2) return false;
                if (n1 === n2) return true;
                const t1 = n1.split(' ').filter(x => x.length > 1);
                const t2 = n2.split(' ').filter(x => x.length > 1);
                return t1.some(a => t2.some(b => b === a || (b.includes(a) && a.length > 3)));
            };

            if (stats?.scorers) {
                Object.entries(stats.scorers).forEach(([sName, sCount]) => {
                    if (safeMatch(norm(sName), norm(name))) goals = sCount;
                });
            }
            if (stats?.assisters) {
                Object.entries(stats.assisters).forEach(([aName, aCount]) => {
                    if (safeMatch(norm(aName), norm(name))) assists = aCount;
                });
            }
            return { goals, assists };
        };

        // Local version of getStarts using startsMap prop
        const getStartsLocal = (name) => {
            const norm = (str) => str?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() || "";
            const n = norm(name);
            const val = startsMap?.get(n);
            if (val !== undefined) return val;

            const namesMatch = (n1, n2) => {
                if (!n1 || !n2) return false;
                if (n1 === n2) return true;
                const t1 = n1.split(' ').filter(x => x.length > 1);
                const t2 = n2.split(' ').filter(x => x.length > 1);
                return t1.some(a => t2.some(b => b === a || (b.includes(a) && a.length > 3)));
            };

            if (startsMap) {
                for (let [k, v] of startsMap) {
                    if (namesMatch(n, k)) return v;
                }
            }
            return 0;
        };

        const { goals, assists } = getPlayerStatsLocal(player.name);
        const starts = getStartsLocal(player.name);
        const hasStats = goals > 0 || assists > 0;
        const photoUrl = getPlayerPhoto(clubName, player.name);

        // NEW STATS: Last Match & Next Opponent
        const nextOpponent = getNextMatch(clubName);
        const lastMatchStats = getLastMatchStats(player.name, clubName);

        const safeTotal = total || 1;
        const coords = getCoords(formation, position, index, safeTotal);

        // Get additional player info from DB using enhanced matching
        const normalizeName = (name) => {
            if (!name || typeof name !== 'string') return "";
            return name.toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z ]/g, "")
                .trim();
        };

        const dbPlayer = PLAYERS_DB?.find(db => {
            if (!db?.Player || !player?.name) return false;

            const dbName = normalizeName(db.Player);
            const playerName = normalizeName(player.name);

            // Try exact match first
            if (dbName === playerName) return true;

            // Try matching by last name
            const dbParts = db.Player.split(' ').filter(p => p.length > 1);
            const playerParts = player.name.split(' ').filter(p => p.length > 1);

            if (dbParts.length > 0 && playerParts.length > 0) {
                const dbLastName = normalizeName(dbParts[dbParts.length - 1]);
                const playerLastName = normalizeName(playerParts[playerParts.length - 1]);

                // Match if last names are same and first name initial matches
                if (dbLastName === playerLastName && dbParts.length > 1 && playerParts.length > 1) {
                    const dbFirst = normalizeName(dbParts[0]);
                    const playerFirst = normalizeName(playerParts[0]);
                    if (dbFirst[0] === playerFirst[0]) return true;
                }

                // Fallback: just last name match for single-word names
                if (dbLastName === playerLastName) return true;

                // HANDLE "Lastname F." format (e.g. "Morton T." vs "Tyler Morton")
                // If player name has parts and the last part is short (likely initial), try matching the first part as Last Name
                if (playerParts.length > 1 && playerParts[playerParts.length - 1].length <= 2) {
                    const playerPotentialLastName = normalizeName(playerParts[0]);
                    if (dbLastName === playerPotentialLastName) {
                        // Optional: Verify initial if possible
                        const dbFirst = normalizeName(dbParts[0]);
                        const playerInitial = normalizeName(playerParts[playerParts.length - 1]);
                        // "T." -> "t" vs "Tyler" -> "t"
                        if (dbFirst.startsWith(playerInitial.replace('.', ''))) return true;
                    }
                }
            }

            return false;
        });

        // Smart Label Logic
        let label = player.name.split(' ').pop();
        if (label.length <= 2 && label.includes('.')) {
            label = player.name.split(' ')[0];
            if (label.length <= 2) label = player.name;
        }

        // Special case fallback: if still just initial, try to find a capitalized word > 2 chars in name
        if (label.length <= 2) {
            const manualParts = player.name.split(' ').filter(p => p.length > 2 && /^[A-Z]/.test(p));
            if (manualParts.length > 0) label = manualParts[manualParts.length - 1]; // Take last significant part
        }

        return (
            <div
                className="group cursor-pointer"
                style={{
                    position: 'absolute',
                    top: `${coords.top}%`,
                    left: `${coords.left}%`,
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 20
                }}
            >
                {/* Photo / Dot - Circle 80px */}
                <div
                    className={`relative rounded-full border flex items-center justify-center shadow-lg transition-all overflow-hidden ${hasStats ? 'border-accent scale-110' : 'border-slate-400'} bg-slate-800`}
                    style={{ width: '80px', height: '80px' }}
                >
                    {photoUrl ? (
                        <img
                            src={photoUrl}
                            alt={player.name}
                            className="w-full h-full"
                            style={{ objectFit: 'cover', objectPosition: 'top' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    ) : (
                        <span className={`text-[10px] font-bold ${hasStats ? 'text-accent' : 'text-slate-400'}`}>
                            {player.rating}
                        </span>
                    )}
                </div>

                {/* Name Label */}
                <div className="mt-1 bg-black/70 px-2 py-0.5 rounded text-[9px] text-white font-bold whitespace-nowrap backdrop-blur-sm border border-white/20 shadow-sm">
                    {label}
                </div>

                {/* Stats Badge */}
                <div className="flex gap-1 mt-1 pointer-events-none z-20 absolute top-full pt-1">
                    {starts > 0 && (
                        <div className="bg-emerald-500/90 text-white px-1.5 py-0.5 rounded text-[8px] font-black shadow-sm">
                            👕{starts}
                        </div>
                    )}
                    {goals > 0 && (
                        <div className="bg-accent/90 text-[#0B1426] px-1.5 py-0.5 rounded text-[8px] font-black shadow-sm">
                            ⚽{goals}
                        </div>
                    )}
                    {assists > 0 && (
                        <div className="bg-blue-400/90 text-white px-1.5 py-0.5 rounded text-[8px] font-black shadow-sm">
                            🎯{assists}
                        </div>
                    )}
                </div>

                {/* Enhanced Hover Tooltip - Hidden by default with CSS */}
                <div
                    className="absolute bottom-full mb-2 z-50 pointer-events-none tooltip-content"
                    style={{ display: 'none' }}
                >
                    <div className="bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-2xl text-xs w-56">
                        {/* Player Name */}
                        <div className="font-bold text-white text-sm border-b border-white/10 pb-2 mb-2">
                            {player.name}
                        </div>

                        {/* Player Info Grid */}
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            {dbPlayer?.Age && (
                                <div className="flex justify-between text-slate-300">
                                    <span>Âge:</span>
                                    <span className="text-white font-semibold">{dbPlayer.Age} ans</span>
                                </div>
                            )}
                            {dbPlayer?.Pos && (
                                <div className="flex justify-between text-slate-300">
                                    <span>Poste:</span>
                                    <span className="text-cyan-400 font-semibold">{dbPlayer.Pos}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-slate-300">
                                <span>Note:</span>
                                <span className="text-yellow-400 font-bold">{player.rating}</span>
                            </div>
                            <div className="flex justify-between text-slate-300">
                                <span>Titularisations:</span>
                                <span className="text-emerald-400 font-semibold">{starts}</span>
                            </div>
                        </div>

                        {/* Season Stats - Clean List */}
                        <div className="space-y-1 mb-3 pt-2 border-t border-white/10">
                            <div className="flex justify-between items-center text-slate-400">
                                <span>Note moy.</span>
                                <span className="text-accent font-bold text-[10px] bg-accent/10 px-1.5 rounded">{player.rating}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400">
                                <span>Titularisations</span>
                                <span className="text-white font-bold">{starts}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400">
                                <span>Buts / Passes</span>
                                <span className="text-white font-bold">{goals} / {assists}</span>
                            </div>
                        </div>

                        {/* NEXT MATCH INFO */}
                        {nextOpponent && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                                <span className="text-[10px] uppercase text-emerald-400 font-bold tracking-wider mb-1 block">Prochain Match</span>
                                <div className="flex items-center gap-2 text-white font-bold">
                                    <span className="text-slate-400">vs</span> {nextOpponent}
                                </div>
                            </div>
                        )}

                        {/* LAST MATCH INFO */}
                        {lastMatchStats && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                                <span className="text-[10px] uppercase text-sky-400 font-bold tracking-wider mb-1 block">Dernier Match</span>
                                <div className="text-white font-bold text-xs mb-1">
                                    vs {lastMatchStats.opponent} <span className="text-slate-400">({lastMatchStats.score})</span>
                                </div>
                                {(lastMatchStats.goals > 0 || lastMatchStats.assists > 0 || lastMatchStats.yellow || lastMatchStats.red) ? (
                                    <div className="flex gap-2 text-[10px]">
                                        {lastMatchStats.goals > 0 && <span className="bg-accent/20 text-accent px-1 rounded">⚽ {lastMatchStats.goals}</span>}
                                        {lastMatchStats.assists > 0 && <span className="bg-blue-400/20 text-blue-400 px-1 rounded">🎯 {lastMatchStats.assists}</span>}
                                        {lastMatchStats.yellow && <span className="bg-yellow-400/20 text-yellow-400 px-1 rounded">🟨</span>}
                                        {lastMatchStats.red && <span className="bg-red-500/20 text-red-500 px-1 rounded">🟥</span>}
                                    </div>
                                ) : (
                                    <span className="text-[10px] text-slate-500 italic">Aucune action notable</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Conditional Render: Full Squad View
    if (showFullSquad) {
        // Sort full roster by Starts then Rating
        const sortedRoster = [...(fullRoster || [])].sort((a, b) => {
            const getStartsLocal = (name) => {
                const norm = (str) => str?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() || "";
                const n = norm(name);

                const val = startsMap?.get(n);
                if (val !== undefined) return val;
                // Fuzzy
                if (startsMap) {
                    for (let [k, v] of startsMap) {
                        if (k.includes(n) || n.includes(k)) return v;
                    }
                }
                return 0;
            };

            const sA = getStartsLocal(a.name);
            const sB = getStartsLocal(b.name);
            if (sA !== sB) return sB - sA;
            return (b.rating || 0) - (a.rating || 0);
        });

        return (
            <div className="card bg-[#0B1426] p-4 flex flex-col items-center h-full min-h-[500px]">
                <div className="flex justify-between w-full mb-4 items-center">
                    <h4 className="text-secondary text-xs uppercase font-bold">📋 Effectif Complet ({clubName})</h4>
                    <span className="text-[10px] text-slate-400 font-mono border border-slate-700 px-2 py-0.5 rounded bg-black/20">
                        {sortedRoster.length} Joueurs
                    </span>
                </div>

                <div className="w-full overflow-y-auto max-h-[750px] custom-scrollbar pr-2">
                    <table className="w-full text-left text-xs text-slate-300">
                        <thead className="sticky top-0 bg-[#0B1426] z-10">
                            <tr className="text-slate-500 border-b border-white/10 uppercase font-bold text-[10px]">
                                <th className="p-2">Joueur</th>
                                <th className="p-2">Pos</th>
                                <th className="p-2 text-right">J.</th>
                                <th className="p-2 text-right">Note</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {sortedRoster.map((p, i) => {
                                const tmRole = getTmRole(p.name);
                                // Find starts
                                const norm = (str) => {
                                    if (typeof str !== 'string') return "";
                                    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                                };
                                const n = norm(p.name);
                                let starts = startsMap?.get(n) || 0;
                                if (starts === 0 && startsMap) {
                                    for (let [k, v] of startsMap) {
                                        if (k === n || (k.includes(n) && n.length > 3) || (n.includes(k) && k.length > 3)) starts = v;
                                    }
                                }

                                return (
                                    <tr key={i} className="hover:bg-white/5 transition-colors">
                                        <td className="p-2 font-bold text-white flex items-center gap-2">
                                            {getPlayerPhoto(clubName, p.name) && (
                                                <img src={getPlayerPhoto(clubName, p.name)} alt="" className="w-6 h-6 rounded-full border border-slate-600 object-cover" />
                                            )}
                                            {p.name}
                                        </td>
                                        <td className="p-2">
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${(tmRole === 'G' || p.position === 'G') ? 'bg-yellow-500/20 text-yellow-400' :
                                                (tmRole === 'D' || p.position === 'D') ? 'bg-blue-500/20 text-blue-400' :
                                                    (tmRole === 'M' || p.position === 'M') ? 'bg-emerald-500/20 text-emerald-400' :
                                                        'bg-red-500/20 text-red-400'
                                                }`}>
                                                {tmRole || p.position || '?'}
                                            </span>
                                        </td>
                                        <td className="p-2 text-right text-emerald-400 font-mono">{starts > 0 ? starts : '-'}</td>
                                        <td className="p-2 text-right font-bold text-accent">{p.rating || '-'}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="card bg-[#0B1426] p-4 flex flex-col items-center h-full min-h-[500px]" >
            {/* HEADER with Formation detected */}
            < div className="flex justify-between w-full mb-4 items-center" >
                <h4 className="text-secondary text-xs uppercase font-bold">⚡ Tactique (Compo Probable)</h4>
                <span className="text-[10px] text-slate-400 font-mono border border-slate-700 px-2 py-0.5 rounded bg-black/20">
                    {dominantFormation}
                </span>
            </div >

            {/* PITCH CONTAINER */}
            < div
                className="relative w-full rounded-xl shadow-2xl select-none"
                style={{
                    position: 'relative',
                    height: '800px',
                    width: '100%',
                    background: 'linear-gradient(to bottom, #34D399, #059669)',
                    border: '4px solid white',
                    overflow: 'hidden'
                }}
            >

                {/* PITCH MARKINGS */}
                < div className="absolute top-6 left-0 w-full text-center pointer-events-none z-0" >
                    <h3 className="text-white/30 font-black text-3xl uppercase tracking-[0.2em] font-mono">COMPOS</h3>
                </div >
                <div className="absolute inset-4 rounded-sm pointer-events-none opacity-90 z-0" style={{ position: 'absolute', border: '2px solid rgba(255,255,255,0.8)' }}>
                    {/* Midline */}
                    <div className="absolute top-1/2 left-0 w-full transform -translate-y-1/2" style={{ position: 'absolute', height: '2px', backgroundColor: 'rgba(255,255,255,0.8)' }}></div>
                    {/* Center Circle */}
                    <div className="absolute top-1/2 left-1/2 w-32 h-32 rounded-full transform -translate-x-1/2 -translate-y-1/2" style={{ position: 'absolute', border: '2px solid rgba(255,255,255,0.8)' }}></div>
                    <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2" style={{ position: 'absolute' }}></div>

                    {/* Top Penalty Box */}
                    <div className="absolute top-0 left-1/2 w-64 h-32 transform -translate-x-1/2" style={{ position: 'absolute', borderBottom: '2px solid rgba(255,255,255,0.8)', borderLeft: '2px solid rgba(255,255,255,0.8)', borderRight: '2px solid rgba(255,255,255,0.8)' }}></div>
                    <div className="absolute top-0 left-1/2 w-24 h-12 transform -translate-x-1/2" style={{ position: 'absolute', borderBottom: '2px solid rgba(255,255,255,0.8)', borderLeft: '2px solid rgba(255,255,255,0.8)', borderRight: '2px solid rgba(255,255,255,0.8)' }}></div>
                    <div className="absolute top-24 left-1/2 w-32 h-16 rounded-full transform -translate-x-1/2 clip-top" style={{ position: 'absolute', borderBottom: '2px solid rgba(255,255,255,0.3)' }}></div>

                    {/* Bottom Penalty Box */}
                    <div className="absolute bottom-0 left-1/2 w-64 h-32 transform -translate-x-1/2" style={{ position: 'absolute', borderTop: '2px solid rgba(255,255,255,0.8)', borderLeft: '2px solid rgba(255,255,255,0.8)', borderRight: '2px solid rgba(255,255,255,0.8)' }}></div>
                    <div className="absolute bottom-0 left-1/2 w-24 h-12 transform -translate-x-1/2" style={{ position: 'absolute', borderTop: '2px solid rgba(255,255,255,0.8)', borderLeft: '2px solid rgba(255,255,255,0.8)', borderRight: '2px solid rgba(255,255,255,0.8)' }}></div>
                    <div className="absolute bottom-24 left-1/2 w-32 h-16 rounded-full transform -translate-x-1/2 clip-bottom" style={{ position: 'absolute', borderTop: '2px solid rgba(255,255,255,0.3)' }}></div>
                </div>

                {/* CORNER ARCS */}
                <div className="absolute top-4 left-4 w-6 h-6 rounded-br-full pointer-events-none z-0" style={{ position: 'absolute', borderRight: '2px solid rgba(255,255,255,0.8)', borderBottom: '2px solid rgba(255,255,255,0.8)' }}></div>
                <div className="absolute top-4 right-4 w-6 h-6 rounded-bl-full pointer-events-none z-0" style={{ position: 'absolute', borderLeft: '2px solid rgba(255,255,255,0.8)', borderBottom: '2px solid rgba(255,255,255,0.8)' }}></div>
                <div className="absolute bottom-4 left-4 w-6 h-6 rounded-tr-full pointer-events-none z-0" style={{ position: 'absolute', borderRight: '2px solid rgba(255,255,255,0.8)', borderTop: '2px solid rgba(255,255,255,0.8)' }}></div>
                <div className="absolute bottom-4 right-4 w-6 h-6 rounded-tl-full pointer-events-none z-0" style={{ position: 'absolute', borderLeft: '2px solid rgba(255,255,255,0.8)', borderTop: '2px solid rgba(255,255,255,0.8)' }}></div>

                {/* PLAYERS LAYER */}
                <div className="absolute inset-0 z-10" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                    {team.G?.map((p, i) => <PlayerNode key={`g-${i}`} player={p} position="G" index={i} total={team.G.length} formation={dominantFormation} stats={stats} startsMap={startsMap} />)}
                    {team.D?.map((p, i) => <PlayerNode key={`d-${i}`} player={p} position="D" index={i} total={team.D.length} formation={dominantFormation} stats={stats} startsMap={startsMap} />)}
                    {team.M?.map((p, i) => <PlayerNode key={`m-${i}`} player={p} position="M" index={i} total={team.M.length} formation={dominantFormation} stats={stats} startsMap={startsMap} />)}
                    {team.A?.map((p, i) => <PlayerNode key={`a-${i}`} player={p} position="A" index={i} total={team.A.length} formation={dominantFormation} stats={stats} startsMap={startsMap} />)}
                </div>
            </div >
        </div >
    );
};

export default PitchMap;
