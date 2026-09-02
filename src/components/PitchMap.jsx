import React, { useMemo, useState } from 'react';
import { getPlayerPhoto } from '../utils/playerPhotos';
import { PLAYERS_DB } from '../data/players_static';
import ALL_LINEUPS from '../data/lineups_2025_2026.json';
import TM_POSITIONS from '../data/player_positions_tm.json';
import CALCULATED_STATS from '../data/player_stats_calculated.json';
import PLAYERS_REGISTRY from '../data/compiled/players_master_registry.json';
import { getClubSquad } from '../data/squads_index';

// Normalisation string robuste
const normStr = (str) => {
    if (!str || typeof str !== 'string') return "";
    return str.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

// Extraction de nom sécurisée (gère string ou objet {name, pos})
const extractPlayerName = (item) => {
    if (!item) return "";
    if (typeof item === 'string') return item.replace(/\(.*\)/g, '').trim();
    if (typeof item === 'object' && item.name) return String(item.name).replace(/\(.*\)/g, '').trim();
    return "";
};

// Comparaison de noms intelligente (gère "Gouiri A." vs "Amine Gouiri", "Leali N." vs "Nicola Leali")
const areNamesMatching = (name1, name2) => {
    if (!name1 || !name2) return false;
    const s1 = normStr(name1);
    const s2 = normStr(name2);
    if (s1 === s2) return true;

    const parts1 = s1.split(' ').filter(x => x.length > 0);
    const parts2 = s2.split(' ').filter(x => x.length > 0);
    if (parts1.length === 0 || parts2.length === 0) return false;

    // Correspondance par nom de famille
    const last1 = parts1[parts1.length - 1];
    const last2 = parts2[parts2.length - 1];
    const first1 = parts1[0];
    const first2 = parts2[0];

    // Cas "Nom P." ou "P. Nom"
    if (last1 === last2 && (parts1.length === 1 || parts2.length === 1 || first1[0] === first2[0])) {
        return true;
    }
    // Inversion Nom Prénom
    if (first1 === last2 && (parts1.length === 1 || parts2.length === 1 || last1[0] === first2[0])) {
        return true;
    }
    if (last1 === first2 && (parts1.length === 1 || parts2.length === 1 || first1[0] === last2[0])) {
        return true;
    }

    // Inclusion stricte si longueur suffisante
    if (s1.length > 5 && s2.length > 5 && (s1.includes(s2) || s2.includes(s1))) {
        return true;
    }

    return false;
};

// Résolution détaillée du rôle, du poste exact et de la position latérale (gauche / centre / droit)
const getPlayerTacticalDetails = (playerOrName) => {
    const playerName = typeof playerOrName === 'string' ? playerOrName : playerOrName?.name;
    if (!playerName) return { role: 'M', subRole: 'CM', label: 'Milieu', side: 'center', sort: 1 };

    const n = normStr(playerName);
    const rawPos = typeof playerOrName === 'object' ? (playerOrName.position || playerOrName.pos || '') : '';
    const rawRole = typeof playerOrName === 'object' ? (playerOrName.role_category || playerOrName.role || '') : '';

    // 0. Détection prioritaire par objet direct si déjà spécifié
    const normRawPos = normStr(rawPos);
    if (rawRole === 'G' || normRawPos.includes('gardien') || normRawPos === 'gk') {
        return { role: 'G', subRole: 'GK', label: 'Gardien de but', side: 'center', sort: 0 };
    }

    // 1. Recherche dans Master Registry
    for (const p of Object.values(PLAYERS_REGISTRY || {})) {
        if (areNamesMatching(p.name, playerName) || areNamesMatching(p.displayName, playerName) || areNamesMatching(p.shortName, playerName)) {
            const pos = (p.position || '').toUpperCase();
            const r = p.role || 'M';

            if (r === 'G' || pos === 'GK') {
                return { role: 'G', subRole: 'GK', label: 'Gardien de but', side: 'center', sort: 0, registry: p };
            }
            if (r === 'D' || ['CB', 'LB', 'RB', 'LWB', 'RWB', 'DF'].includes(pos)) {
                if (['LB', 'LWB'].includes(pos)) return { role: 'D', subRole: pos, label: 'Arrière Gauche', side: 'left', sort: 0, registry: p };
                if (['RB', 'RWB'].includes(pos)) return { role: 'D', subRole: pos, label: 'Arrière Droit', side: 'right', sort: 2, registry: p };
                return { role: 'D', subRole: pos || 'CB', label: 'Défenseur Central', side: 'center', sort: 1, registry: p };
            }
            if (r === 'A' || ['ST', 'CF', 'LW', 'RW', 'FW'].includes(pos)) {
                if (pos === 'LW') return { role: 'A', subRole: 'LW', label: 'Ailier Gauche', side: 'left', sort: 0, registry: p };
                if (pos === 'RW') return { role: 'A', subRole: 'RW', label: 'Ailier Droit', side: 'right', sort: 2, registry: p };
                return { role: 'A', subRole: pos || 'ST', label: 'Avant-Centre', side: 'center', sort: 1, registry: p };
            }
            if (r === 'M' || ['CDM', 'CM', 'CAM', 'LM', 'RM', 'MF'].includes(pos)) {
                if (pos === 'LM') return { role: 'M', subRole: 'LM', label: 'Milieu Gauche', side: 'left', sort: 0, registry: p };
                if (pos === 'RM') return { role: 'M', subRole: 'RM', label: 'Milieu Droit', side: 'right', sort: 2, registry: p };
                if (pos === 'CDM') return { role: 'M', subRole: 'CDM', label: 'Milieu Défensif', side: 'center', sort: 1, registry: p };
                if (pos === 'CAM') return { role: 'M', subRole: 'CAM', label: 'Milieu Offensif', side: 'center', sort: 1, registry: p };
                return { role: 'M', subRole: 'CM', label: 'Milieu Central', side: 'center', sort: 1, registry: p };
            }
        }
    }

    // 2. Recherche dans TM_POSITIONS
    let tmMatch = null;
    for (const [key, val] of Object.entries(TM_POSITIONS || {})) {
        if (areNamesMatching(key, playerName)) {
            tmMatch = val;
            break;
        }
    }

    if (tmMatch && tmMatch.main) {
        const m = tmMatch.main.toLowerCase();
        if (m.includes('gardien')) return { role: 'G', subRole: 'GK', label: 'Gardien de but', side: 'center', sort: 0 };
        if (m.includes('défense') || m.includes('arriere') || m.includes('lateral')) {
            if (m.includes('gauche')) return { role: 'D', subRole: 'LB', label: 'Arrière Gauche', side: 'left', sort: 0 };
            if (m.includes('droit')) return { role: 'D', subRole: 'RB', label: 'Arrière Droit', side: 'right', sort: 2 };
            return { role: 'D', subRole: 'CB', label: 'Défenseur Central', side: 'center', sort: 1 };
        }
        if (m.includes('milieu')) {
            if (m.includes('gauche')) return { role: 'M', subRole: 'LM', label: 'Milieu Gauche', side: 'left', sort: 0 };
            if (m.includes('droit')) return { role: 'M', subRole: 'RM', label: 'Milieu Droit', side: 'right', sort: 2 };
            if (m.includes('défensif')) return { role: 'M', subRole: 'CDM', label: 'Milieu Défensif', side: 'center', sort: 1 };
            if (m.includes('offensif')) return { role: 'M', subRole: 'CAM', label: 'Milieu Offensif', side: 'center', sort: 1 };
            return { role: 'M', subRole: 'CM', label: 'Milieu Central', side: 'center', sort: 1 };
        }
        if (m.includes('attaquant') || m.includes('ailier') || m.includes('avant-centre') || m.includes('buteur')) {
            if (m.includes('gauche')) return { role: 'A', subRole: 'LW', label: 'Ailier Gauche', side: 'left', sort: 0 };
            if (m.includes('droit')) return { role: 'A', subRole: 'RW', label: 'Ailier Droit', side: 'right', sort: 2 };
            return { role: 'A', subRole: 'ST', label: 'Avant-Centre', side: 'center', sort: 1 };
        }
    }

    // 3. Fallback sur les propriétés de l'objet joueur
    if (rawRole === 'D' || normRawPos.includes('defense') || normRawPos.includes('arriere')) {
        if (normRawPos.includes('gauche')) return { role: 'D', subRole: 'LB', label: 'Arrière Gauche', side: 'left', sort: 0 };
        if (normRawPos.includes('droit')) return { role: 'D', subRole: 'RB', label: 'Arrière Droit', side: 'right', sort: 2 };
        return { role: 'D', subRole: 'CB', label: 'Défenseur Central', side: 'center', sort: 1 };
    }
    if (rawRole === 'A' || normRawPos.includes('attaquant') || normRawPos.includes('ailier') || normRawPos.includes('avant')) {
        if (normRawPos.includes('gauche')) return { role: 'A', subRole: 'LW', label: 'Ailier Gauche', side: 'left', sort: 0 };
        if (normRawPos.includes('droit')) return { role: 'A', subRole: 'RW', label: 'Ailier Droit', side: 'right', sort: 2 };
        return { role: 'A', subRole: 'ST', label: 'Avant-Centre', side: 'center', sort: 1 };
    }
    if (rawRole === 'M' || normRawPos.includes('milieu')) {
        if (normRawPos.includes('gauche')) return { role: 'M', subRole: 'LM', label: 'Milieu Gauche', side: 'left', sort: 0 };
        if (normRawPos.includes('droit')) return { role: 'M', subRole: 'RM', label: 'Milieu Droit', side: 'right', sort: 2 };
        return { role: 'M', subRole: 'CM', label: 'Milieu Central', side: 'center', sort: 1 };
    }

    return { role: 'M', subRole: 'CM', label: 'Milieu', side: 'center', sort: 1 };
};

const getTmRole = (name) => {
    return getPlayerTacticalDetails(name).role;
};

const PitchMap = ({ clubName, roster, stats, schedule, currentWeek, matchHistory, showFullSquad }) => {

    // --- FORMATION COORDINATES DEFINITIONS ---
    const FORMATION_COORDS = {
        "4-3-3": {
            G: [{ top: 88, left: 50 }],
            D: [{ top: 68, left: 16 }, { top: 68, left: 38 }, { top: 68, left: 62 }, { top: 68, left: 84 }],
            M: [{ top: 48, left: 24 }, { top: 48, left: 50 }, { top: 48, left: 76 }],
            A: [{ top: 18, left: 20 }, { top: 18, left: 50 }, { top: 18, left: 80 }]
        },
        "4-4-2": {
            G: [{ top: 88, left: 50 }],
            D: [{ top: 68, left: 16 }, { top: 68, left: 38 }, { top: 68, left: 62 }, { top: 68, left: 84 }],
            M: [{ top: 44, left: 16 }, { top: 48, left: 38 }, { top: 48, left: 62 }, { top: 44, left: 84 }],
            A: [{ top: 18, left: 35 }, { top: 18, left: 65 }]
        },
        "4-2-3-1": {
            G: [{ top: 88, left: 50 }],
            D: [{ top: 70, left: 16 }, { top: 70, left: 38 }, { top: 70, left: 62 }, { top: 70, left: 84 }],
            M: [
                { top: 54, left: 35 }, { top: 54, left: 65 }, // CDMs
                { top: 34, left: 20 }, { top: 34, left: 50 }, { top: 34, left: 80 } // CAMs / Wings
            ],
            A: [{ top: 14, left: 50 }]
        },
        "3-5-2": {
            G: [{ top: 88, left: 50 }],
            D: [{ top: 70, left: 25 }, { top: 70, left: 50 }, { top: 70, left: 75 }],
            M: [
                { top: 50, left: 12 }, { top: 50, left: 88 }, // Wingbacks
                { top: 52, left: 34 }, { top: 46, left: 50 }, { top: 52, left: 66 } // Central Mids
            ],
            A: [{ top: 18, left: 35 }, { top: 18, left: 65 }]
        },
        "3-4-3": {
            G: [{ top: 88, left: 50 }],
            D: [{ top: 70, left: 25 }, { top: 70, left: 50 }, { top: 70, left: 75 }],
            M: [{ top: 46, left: 16 }, { top: 48, left: 38 }, { top: 48, left: 62 }, { top: 46, left: 84 }],
            A: [{ top: 18, left: 20 }, { top: 18, left: 50 }, { top: 18, left: 80 }]
        },
        "5-4-1": {
            G: [{ top: 88, left: 50 }],
            D: [{ top: 72, left: 12 }, { top: 72, left: 31 }, { top: 72, left: 50 }, { top: 72, left: 69 }, { top: 72, left: 88 }],
            M: [{ top: 48, left: 18 }, { top: 50, left: 39 }, { top: 50, left: 61 }, { top: 48, left: 82 }],
            A: [{ top: 16, left: 50 }]
        },
        "4-1-4-1": {
            G: [{ top: 88, left: 50 }],
            D: [{ top: 70, left: 16 }, { top: 70, left: 38 }, { top: 70, left: 62 }, { top: 70, left: 84 }],
            M: [
                { top: 56, left: 50 }, // DM
                { top: 38, left: 16 }, { top: 38, left: 38 }, { top: 38, left: 62 }, { top: 38, left: 84 } // 4 AMs / Wings
            ],
            A: [{ top: 15, left: 50 }]
        },
        "3-4-2-1": {
            G: [{ top: 88, left: 50 }],
            D: [{ top: 72, left: 25 }, { top: 72, left: 50 }, { top: 72, left: 75 }],
            M: [
                { top: 54, left: 12 }, { top: 54, left: 37 }, { top: 54, left: 63 }, { top: 54, left: 88 },
                { top: 34, left: 32 }, { top: 34, left: 68 }
            ],
            A: [{ top: 15, left: 50 }]
        },
        "5-3-2": "3-5-2",
        "5-2-3": "3-4-3",
        "3-4-1-2": "3-5-2",
        "4-5-1": "4-1-4-1"
    };

    const getCoords = (formation, pos, index, total) => {
        let layoutName = formation;
        if (typeof FORMATION_COORDS[formation] === 'string') {
            layoutName = FORMATION_COORDS[formation];
        }
        if (!FORMATION_COORDS[layoutName]) layoutName = "4-3-3";

        const scheme = FORMATION_COORDS[layoutName];
        const posGroup = scheme[pos];
        if (!posGroup) return { top: 50, left: 50 };

        if (index >= posGroup.length) {
            const step = 100 / (total + 1);
            return {
                top: pos === 'G' ? 88 : pos === 'D' ? 68 : pos === 'M' ? 48 : 18,
                left: step * (index + 1)
            };
        }

        return posGroup[index];
    };

    // Récupération de l'historique complet du club (toutes saisons confondues)
    const clubAllSeasonsData = useMemo(() => {
        try {
            return getClubSquad(clubName, 'ALL');
        } catch (e) {
            return null;
        }
    }, [clubName]);

    // Prochain adversaire
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

    // Statistiques du dernier match
    const getLastMatchStats = (playerName, cName) => {
        if (!matchHistory || matchHistory.length === 0) return null;

        const playedMatches = matchHistory
            .filter(m => (m.homeTeam === cName || m.awayTeam === cName) && (m.score && m.score !== '-'))
            .sort((a, b) => {
                const getR = r => r ? parseInt((String(r).match(/\d+/) || [0])[0], 10) : 0;
                return getR(b.round) - getR(a.round);
            });

        const lastMatch = playedMatches[0];
        if (!lastMatch) return null;

        const opponent = lastMatch.homeTeam === cName ? lastMatch.awayTeam : lastMatch.homeTeam;
        let scoreStr = lastMatch.score;
        if (typeof scoreStr === 'object') {
            scoreStr = `${scoreStr.home}-${scoreStr.away}`;
        }

        let goals = 0;
        let assists = 0;
        let yellow = false;
        let red = false;

        if (lastMatch.events) {
            (lastMatch.events || []).forEach(e => {
                let involved = false;
                if (e.players) {
                    involved = e.players.some(p => areNamesMatching(p, playerName));
                }

                if (involved) {
                    if (e.type === 'Goal') goals++;
                    if (e.type === 'Yellow Card') yellow = true;
                    if (e.type === 'Red Card') red = true;
                }

                if (e.type === 'Goal' && e.detail && areNamesMatching(e.detail, playerName)) {
                    assists++;
                }
            });
        }

        return { opponent, score: scoreStr, goals, assists, yellow, red };
    };

    // Sélection et composition du 11 probable
    const { team, dominantFormation, startsMap, fullRoster } = useMemo(() => {
        const safeRoster = roster || [];
        const startsCount = new Map();
        const activePlayerNames = new Set();
        const formationFreq = {};

        // 1. Analyse de toutes les feuilles de match
        ALL_LINEUPS.forEach(match => {
            if (!match.teams) return;
            const homeNorm = normStr(match.teams.home);
            const awayNorm = normStr(match.teams.away);
            const clubNorm = normStr(clubName);

            const isHome = homeNorm.includes(clubNorm) || clubNorm.includes(homeNorm);
            const isAway = awayNorm.includes(clubNorm) || clubNorm.includes(awayNorm);

            if (isHome || isAway) {
                const side = isHome ? 'home' : 'away';
                const starters = side === 'home' ? match.lineups?.homeStarters : match.lineups?.awayStarters;
                const subs = side === 'home' ? match.lineups?.homeSubstitutes : match.lineups?.awaySubstitutes;
                const formation = side === 'home' ? match.lineups?.homeFormation : match.lineups?.awayFormation;

                if (formation) {
                    formationFreq[formation] = (formationFreq[formation] || 0) + 1;
                }

                (starters || []).forEach(rawItem => {
                    const clean = extractPlayerName(rawItem);
                    if (clean) {
                        const n = normStr(clean);
                        activePlayerNames.add(n);
                        startsCount.set(n, (startsCount.get(n) || 0) + 1);
                    }
                });

                (subs || []).forEach(rawItem => {
                    const clean = extractPlayerName(rawItem);
                    if (clean) {
                        activePlayerNames.add(normStr(clean));
                    }
                });
            }
        });

        // Schéma dominant
        let topFormation = "4-3-3";
        let maxCount = 0;
        for (const [fmt, cnt] of Object.entries(formationFreq)) {
            if (cnt > maxCount) {
                maxCount = cnt;
                topFormation = fmt;
            }
        }

        const fullRosterList = [...safeRoster];

        // Nombre de joueurs cibles par ligne selon le schéma
        let targetCounts = { G: 1, D: 4, M: 3, A: 3 };
        const parts = topFormation.split('-').map(Number);
        if (parts.length >= 3) {
            targetCounts.D = parts[0];
            targetCounts.A = parts[parts.length - 1];
            targetCounts.M = parts.slice(1, parts.length - 1).reduce((a, b) => a + b, 0);
        }

        const getStartsInternal = (name) => {
            const n = normStr(name);
            if (startsCount.has(n)) return startsCount.get(n);
            for (let [k, v] of startsCount) {
                if (areNamesMatching(n, k)) return v;
            }
            return 0;
        };

        const getMinutesInternal = (p) => {
            // Minutes depuis stats de saison si présentes
            if (p.stats?.minutesPlayed) return p.stats.minutesPlayed;
            if (p.stats?.appearances) return p.stats.appearances * 75;

            // Minutes depuis CALCULATED_STATS
            if (CALCULATED_STATS && CALCULATED_STATS[clubName]) {
                const found = CALCULATED_STATS[clubName].find(ps => areNamesMatching(ps.name, p.name));
                if (found && found.minutesPlayed) return found.minutesPlayed;
            }

            // Minutes depuis PLAYERS_DB
            const dbP = PLAYERS_DB?.find(db => areNamesMatching(db.Player, p.name));
            if (dbP && dbP.Min) return dbP.Min;

            return 0;
        };

        const selectedPlayerNames = new Set();

        const getBestForRole = (targetRole, count) => {
            // Candidats strictement assignés à ce rôle
            let candidates = fullRosterList.filter(p => {
                const pNorm = normStr(p.name);
                if (selectedPlayerNames.has(pNorm)) return false;

                const tactical = getPlayerTacticalDetails(p);
                return tactical.role === targetRole;
            });

            // Tri qualitatif : Titularisations -> Minutes jouées -> Note
            candidates.sort((a, b) => {
                const sA = getStartsInternal(a.name);
                const sB = getStartsInternal(b.name);
                if (sA !== sB) return sB - sA;

                const minA = getMinutesInternal(a);
                const minB = getMinutesInternal(b);
                if (minA !== minB) return minB - minA;

                return (b.rating || 6.5) - (a.rating || 6.5);
            });

            // Si effectif insuffisant pour ce rôle (hors Gardien qui ne doit jamais être pollué)
            if (candidates.length < count && targetRole !== 'G') {
                const remaining = fullRosterList.filter(p => {
                    const pNorm = normStr(p.name);
                    if (selectedPlayerNames.has(pNorm)) return false;
                    if (candidates.includes(p)) return false;
                    // Ne jamais convertir un gardien en joueur de champ !
                    const tactical = getPlayerTacticalDetails(p);
                    return tactical.role !== 'G';
                });

                remaining.sort((a, b) => {
                    const minA = getMinutesInternal(a);
                    const minB = getMinutesInternal(b);
                    return minB - minA;
                });

                candidates = [...candidates, ...remaining];
            }

            const selection = candidates.slice(0, count);

            // Tri tactique horizontal de gauche à droite (Left -> Center -> Right)
            selection.sort((a, b) => {
                const tacA = getPlayerTacticalDetails(a);
                const tacB = getPlayerTacticalDetails(b);
                return tacA.sort - tacB.sort;
            });

            selection.forEach(p => selectedPlayerNames.add(normStr(p.name)));
            return selection;
        };

        const teamSquad = {
            G: getBestForRole('G', targetCounts.G),
            D: getBestForRole('D', targetCounts.D),
            M: getBestForRole('M', targetCounts.M),
            A: getBestForRole('A', targetCounts.A)
        };

        return { team: teamSquad, dominantFormation: topFormation, startsMap: startsCount, fullRoster: fullRosterList };

    }, [roster, clubName]);

    // Composant Noeud Joueur avec Carte Tooltip complète au survol
    const PlayerNode = ({ player, position, index, total, formation, startsMap }) => {
        const [isHovered, setIsHovered] = useState(false);

        const tactical = useMemo(() => getPlayerTacticalDetails(player), [player]);
        const starts = useMemo(() => {
            const n = normStr(player.name);
            if (startsMap?.has(n)) return startsMap.get(n);
            if (startsMap) {
                for (let [k, v] of startsMap) {
                    if (areNamesMatching(n, k)) return v;
                }
            }
            return player.stats?.appearances || 0;
        }, [player, startsMap]);

        // Données du joueur issues de PLAYERS_DB (FBref)
        const dbPlayer = useMemo(() => {
            return PLAYERS_DB?.find(db => areNamesMatching(db.Player, player.name));
        }, [player]);

        // Données de carrière agrégées dans le club
        const clubStats = useMemo(() => {
            if (!clubAllSeasonsData?.seasons) {
                return {
                    appearances: player.stats?.appearances || 0,
                    goals: player.stats?.goals || 0,
                    assists: player.stats?.assists || 0,
                    seasonsCount: 1
                };
            }

            let totalApps = 0;
            let totalGls = 0;
            let totalAst = 0;
            let seasonsCount = 0;

            Object.entries(clubAllSeasonsData.seasons).forEach(([seasonKey, pList]) => {
                const match = (pList || []).find(p => areNamesMatching(p.name, player.name));
                if (match) {
                    seasonsCount++;
                    if (match.stats) {
                        totalApps += match.stats.appearances || 0;
                        totalGls += match.stats.goals || 0;
                        totalAst += match.stats.assists || 0;
                    }
                }
            });

            return {
                appearances: Math.max(totalApps, player.stats?.appearances || 0),
                goals: Math.max(totalGls, player.stats?.goals || 0),
                assists: Math.max(totalAst, player.stats?.assists || 0),
                seasonsCount: Math.max(1, seasonsCount)
            };
        }, [clubAllSeasonsData, player]);

        const coords = getCoords(formation, position, index, total || 1);
        const photoUrl = getPlayerPhoto(clubName, player.name, player);
        const roleCode = tactical.role.toLowerCase();
        const fallbackRoleAvatar = `/assets/players/defaults/${roleCode === 'g' ? 'g' : roleCode === 'd' ? 'd' : roleCode === 'a' ? 'a' : 'm'}_default.webp`;

        const nextOpponent = getNextMatch(clubName);
        const lastMatch = getLastMatchStats(player.name, clubName);

        // Positionnement adaptatif anti-débordement du tooltip
        const isTopLine = coords.top < 38;
        const isFarLeft = coords.left <= 25;
        const isFarRight = coords.left >= 75;

        const tooltipStyle = {
            position: 'absolute',
            ...(isTopLine ? { top: 'calc(100% + 14px)' } : { bottom: 'calc(100% + 14px)' }),
            ...(isFarLeft ? { left: '0px', transform: 'none' } : isFarRight ? { right: '0px', left: 'auto', transform: 'none' } : { left: '50%', transform: 'translateX(-50%)' }),
            zIndex: 9999
        };

        // Nom court élégant
        let label = player.name.split(' ').pop();
        if (label.length <= 2 && label.includes('.')) {
            label = player.name.split(' ')[0];
        }

        const goals = player.stats?.goals || dbPlayer?.Gls || 0;
        const assists = player.stats?.assists || dbPlayer?.Ast || 0;
        const appearances = player.stats?.appearances || dbPlayer?.MP || starts || 0;
        const minutes = dbPlayer?.Min || (appearances > 0 ? appearances * 78 : 0);
        const xG = dbPlayer?.xG ?? '-';
        const xAG = dbPlayer?.xAG ?? '-';
        const rating = player.rating || (dbPlayer ? '7.1' : '6.8');
        const age = player.age || dbPlayer?.Age || tactical.registry?.age || '-';
        const nationality = player.nationality || tactical.registry?.nationality || (dbPlayer?.Nation ? dbPlayer.Nation.split(' ').pop() : '-');
        const marketValue = player.market_value || tactical.registry?.marketValue || '-';

        return (
            <div
                className="group"
                style={{
                    position: 'absolute',
                    top: `${coords.top}%`,
                    left: `${coords.left}%`,
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: isHovered ? 999 : 20,
                    cursor: 'pointer'
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Photo Joueur (76px) */}
                <div
                    className={`relative rounded-full border-2 flex items-center justify-center shadow-2xl transition-all duration-200 overflow-hidden bg-slate-950 ${
                        isHovered 
                            ? 'scale-115 border-amber-400 ring-4 ring-amber-400/30' 
                            : (goals > 0 || assists > 0) 
                                ? 'border-emerald-400 shadow-emerald-950/40' 
                                : 'border-white/90'
                    }`}
                    style={{ width: '76px', height: '76px' }}
                >
                    <img
                        src={photoUrl || fallbackRoleAvatar}
                        alt={player.name}
                        className="w-full h-full object-cover object-top"
                        onError={(e) => {
                            if (e.target.src !== fallbackRoleAvatar) {
                                e.target.src = fallbackRoleAvatar;
                            }
                        }}
                    />
                    {/* Badge Rôle Position */}
                    <div className={`absolute bottom-0 inset-x-0 text-center py-0.5 text-[8px] font-black uppercase text-white shadow-md tracking-wider ${
                        tactical.role === 'G' ? 'bg-amber-600/95' :
                        tactical.role === 'D' ? 'bg-blue-600/95' :
                        tactical.role === 'M' ? 'bg-emerald-600/95' : 'bg-rose-600/95'
                    }`}>
                        {tactical.subRole || tactical.role}
                    </div>
                </div>

                {/* Nom du Joueur */}
                <div className="mt-1 bg-black/90 px-2.5 py-0.5 rounded-full text-[11px] text-white font-bold whitespace-nowrap backdrop-blur-md border border-white/30 shadow-lg">
                    {label}
                </div>

                {/* Badges d'activité rapide */}
                <div className="flex gap-1 mt-0.5 pointer-events-none">
                    {starts > 0 && (
                        <span className="bg-emerald-600/95 text-white px-1.5 py-0.2 rounded text-[9px] font-extrabold shadow">
                            👕{starts}
                        </span>
                    )}
                    {goals > 0 && (
                        <span className="bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded text-[9px] font-black shadow">
                            ⚽{goals}
                        </span>
                    )}
                    {assists > 0 && (
                        <span className="bg-sky-400 text-slate-950 px-1.5 py-0.2 rounded text-[9px] font-black shadow">
                            🎯{assists}
                        </span>
                    )}
                </div>

                {/* CARTE TOOLTIP STATISTIQUES AU SURVOL (HAUTE LISIBILITÉ & CONTRASTE) */}
                {isHovered && (
                    <div
                        style={tooltipStyle}
                        className="w-80 bg-[#0B132B] border border-amber-400/40 rounded-2xl p-4 shadow-[0_16px_50px_rgba(0,0,0,0.95)] backdrop-blur-2xl text-slate-100 pointer-events-none z-[9999] animate-fadeIn"
                    >
                        {/* Entête du Joueur */}
                        <div className="flex items-center gap-3 border-b border-white/15 pb-3 mb-3">
                            <div className="w-12 h-12 rounded-full border-2 border-amber-400/70 overflow-hidden bg-slate-900 shrink-0 shadow-md">
                                <img
                                    src={photoUrl || fallbackRoleAvatar}
                                    alt=""
                                    className="w-full h-full object-cover object-top"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-extrabold text-white text-base leading-tight truncate">{player.name}</div>
                                <div className="flex items-center gap-2 text-xs text-slate-300 mt-1">
                                    <span className="font-bold text-amber-300 bg-amber-400/15 px-1.5 py-0.5 rounded border border-amber-400/30 text-[10px]">
                                        {tactical.label} ({tactical.subRole})
                                    </span>
                                    <span>•</span>
                                    <span className="text-slate-200 font-semibold">{clubName}</span>
                                    {player.number && <span className="font-mono font-bold text-sky-300">#{player.number}</span>}
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 px-2 py-1 rounded-lg text-xs font-black shadow">
                                    ★ {rating}
                                </span>
                            </div>
                        </div>

                        {/* SECTION 1 : SAISON EN COURS */}
                        <div className="mb-3">
                            <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1">📊 Saison 2026-2027</span>
                                <span className="text-slate-300 font-semibold bg-white/10 px-2 py-0.5 rounded-full text-[10px]">{appearances} apparitions</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-slate-900/90 p-2 rounded-xl border border-white/10">
                                    <div className="text-[10px] text-slate-400 font-medium">Buts / Passes</div>
                                    <div className="font-black text-white text-sm mt-0.5">{goals} <span className="text-amber-400">/</span> {assists}</div>
                                </div>
                                <div className="bg-slate-900/90 p-2 rounded-xl border border-white/10">
                                    <div className="text-[10px] text-slate-400 font-medium">Titularisations</div>
                                    <div className="font-black text-emerald-400 text-sm mt-0.5">{starts}</div>
                                </div>
                                <div className="bg-slate-900/90 p-2 rounded-xl border border-white/10">
                                    <div className="text-[10px] text-slate-400 font-medium">Temps de jeu</div>
                                    <div className="font-black text-sky-400 text-sm mt-0.5">{minutes}'</div>
                                </div>
                            </div>
                            {(xG !== '-' || xAG !== '-') && (
                                <div className="flex justify-between text-[11px] bg-slate-900/60 rounded-lg p-1.5 mt-2 border border-white/5 text-slate-300">
                                    <span>xG Attendus: <strong className="text-emerald-300 font-bold">{xG}</strong></span>
                                    <span>xAG Passes clés: <strong className="text-sky-300 font-bold">{xAG}</strong></span>
                                </div>
                            )}
                        </div>

                        {/* SECTION 2 : HISTORIQUE DANS LE CLUB */}
                        <div className="mb-3 pt-2.5 border-t border-white/15">
                            <div className="text-[10px] uppercase font-bold text-sky-300 tracking-wider mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1">🏟️ Bilan au Club ({clubName})</span>
                                <span className="text-slate-300 font-semibold">{clubStats.seasonsCount} saison{clubStats.seasonsCount > 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-white/10">
                                <span className="text-slate-300">Total Matchs / Buts :</span>
                                <span className="font-black text-white">{clubStats.appearances} m. • {clubStats.goals} buts • {clubStats.assists} p.</span>
                            </div>
                            {player.joined_date && (
                                <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 px-1">
                                    <span>Arrivée: <strong className="text-slate-200">{player.joined_date}</strong></span>
                                    {player.contract_until && <span>Fin de contrat: <strong className="text-amber-300">{player.contract_until}</strong></span>}
                                </div>
                            )}
                        </div>

                        {/* SECTION 3 : PROFIL & VALEUR */}
                        <div className="pt-2.5 border-t border-white/15">
                            <div className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider mb-2">
                                👤 Profil & Transfert
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-slate-900/80 p-1.5 rounded-lg border border-white/5 flex justify-between">
                                    <span className="text-slate-400">Âge :</span>
                                    <span className="text-white font-bold">{age} ans</span>
                                </div>
                                <div className="bg-slate-900/80 p-1.5 rounded-lg border border-white/5 flex justify-between">
                                    <span className="text-slate-400">Nationalité :</span>
                                    <span className="text-white font-bold">{nationality}</span>
                                </div>
                                <div className="bg-slate-900/80 p-2 rounded-lg border border-amber-400/20 col-span-2 flex justify-between items-center">
                                    <span className="text-slate-300 font-medium">Valeur Marchande :</span>
                                    <span className="text-amber-300 font-black text-sm">{marketValue}</span>
                                </div>
                            </div>
                        </div>

                        {/* DERNIER / PROCHAIN MATCH INFO */}
                        {(lastMatch || nextOpponent) && (
                            <div className="mt-2.5 pt-2.5 border-t border-white/15 text-[10px] space-y-1">
                                {lastMatch && (
                                    <div className="flex justify-between items-center text-slate-300">
                                        <span>Dernier match vs <strong className="text-white">{lastMatch.opponent}</strong> ({lastMatch.score})</span>
                                        {(lastMatch.goals > 0 || lastMatch.assists > 0) && (
                                            <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                                ⚽{lastMatch.goals} 🎯{lastMatch.assists}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {nextOpponent && (
                                    <div className="flex justify-between items-center text-slate-400">
                                        <span>Prochaine rencontre :</span>
                                        <span className="font-bold text-amber-300">vs {nextOpponent}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Mode Effectif Complet (tableau)
    if (showFullSquad) {
        const sortedRoster = [...(fullRoster || [])].sort((a, b) => {
            const tacA = getPlayerTacticalDetails(a);
            const tacB = getPlayerTacticalDetails(b);
            if (tacA.role !== tacB.role) {
                const roleOrder = { G: 0, D: 1, M: 2, A: 3 };
                return (roleOrder[tacA.role] ?? 4) - (roleOrder[tacB.role] ?? 4);
            }
            const sA = startsMap?.get(normStr(a.name)) || 0;
            const sB = startsMap?.get(normStr(b.name)) || 0;
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
                                <th className="p-2">Poste Précis</th>
                                <th className="p-2 text-right">Tit.</th>
                                <th className="p-2 text-right">Note</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {sortedRoster.map((p, i) => {
                                const tac = getPlayerTacticalDetails(p);
                                const n = normStr(p.name);
                                const starts = startsMap?.get(n) || 0;
                                const pPhoto = getPlayerPhoto(clubName, p.name, p);

                                return (
                                    <tr key={i} className="hover:bg-white/5 transition-colors">
                                        <td className="p-2 font-bold text-white flex items-center gap-2">
                                            {pPhoto && (
                                                <img src={pPhoto} alt="" className="w-6 h-6 rounded-full border border-slate-600 object-cover object-top" />
                                            )}
                                            {p.name}
                                        </td>
                                        <td className="p-2">
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                tac.role === 'G' ? 'bg-amber-500/20 text-amber-400' :
                                                tac.role === 'D' ? 'bg-blue-500/20 text-blue-400' :
                                                tac.role === 'M' ? 'bg-emerald-500/20 text-emerald-400' :
                                                'bg-rose-500/20 text-rose-400'
                                            }`}>
                                                {tac.label} ({tac.subRole})
                                            </span>
                                        </td>
                                        <td className="p-2 text-right text-emerald-400 font-mono">{starts > 0 ? starts : '-'}</td>
                                        <td className="p-2 text-right font-bold text-accent">{p.rating || '6.8'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="card bg-[#0B1426] p-4 flex flex-col items-center h-full min-h-[500px]">
            {/* HEADER with Formation detected */}
            <div className="flex justify-between w-full mb-4 items-center">
                <h4 className="text-secondary text-xs uppercase font-bold">⚡ Tactique (Compo Probable)</h4>
                <span className="text-[10px] text-slate-400 font-mono border border-slate-700 px-2 py-0.5 rounded bg-black/20">
                    {dominantFormation}
                </span>
            </div>

            {/* PITCH CONTAINER */}
            <div
                className="relative w-full rounded-2xl shadow-2xl select-none overflow-hidden"
                style={{
                    position: 'relative',
                    height: '820px',
                    width: '100%',
                    background: 'radial-gradient(ellipse at center, #15803d 0%, #166534 60%, #14532d 100%)',
                    border: '3px solid rgba(255, 255, 255, 0.9)'
                }}
            >
                {/* SVG VECTOR FOOTBALL PITCH MARKINGS */}
                <svg
                    viewBox="0 0 680 1050"
                    preserveAspectRatio="none"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                >
                    {/* Subtle Pitch Grass Turf Stripes */}
                    <g opacity="0.12">
                        <rect x="0" y="0" width="680" height="105" fill="#ffffff" />
                        <rect x="0" y="210" width="680" height="105" fill="#ffffff" />
                        <rect x="0" y="420" width="680" height="105" fill="#ffffff" />
                        <rect x="0" y="630" width="680" height="105" fill="#ffffff" />
                        <rect x="0" y="840" width="680" height="105" fill="#ffffff" />
                    </g>

                    {/* Watermark COMPOS */}
                    <text
                        x="340"
                        y="80"
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.25)"
                        fontSize="32"
                        fontWeight="900"
                        letterSpacing="8"
                        fontFamily="monospace"
                    >
                        COMPOS
                    </text>

                    {/* Pitch Outer Boundary Line */}
                    <rect
                        x="30"
                        y="30"
                        width="620"
                        height="990"
                        rx="4"
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="2.5"
                    />

                    {/* Halfway Line */}
                    <line
                        x1="30"
                        y1="525"
                        x2="650"
                        y2="525"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="2.5"
                    />

                    {/* Center Circle & Spot */}
                    <circle
                        cx="340"
                        cy="525"
                        r="85"
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="2.5"
                    />
                    <circle
                        cx="340"
                        cy="525"
                        r="4.5"
                        fill="rgba(255,255,255,0.95)"
                    />

                    {/* Top Goal Area & Penalty Box */}
                    <rect
                        x="150"
                        y="30"
                        width="380"
                        height="160"
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="2.5"
                    />
                    <rect
                        x="240"
                        y="30"
                        width="200"
                        height="60"
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="2.5"
                    />
                    {/* Top Penalty Spot */}
                    <circle
                        cx="340"
                        cy="140"
                        r="3.5"
                        fill="rgba(255,255,255,0.95)"
                    />
                    {/* Top Penalty Arc */}
                    <path
                        d="M 268 190 A 85 85 0 0 0 412 190"
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="2.5"
                    />
                    {/* Top Goal Net */}
                    <rect
                        x="290"
                        y="15"
                        width="100"
                        height="15"
                        fill="none"
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                    />

                    {/* Bottom Goal Area & Penalty Box */}
                    <rect
                        x="150"
                        y="860"
                        width="380"
                        height="160"
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="2.5"
                    />
                    <rect
                        x="240"
                        y="960"
                        width="200"
                        height="60"
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="2.5"
                    />
                    {/* Bottom Penalty Spot */}
                    <circle
                        cx="340"
                        cy="910"
                        r="3.5"
                        fill="rgba(255,255,255,0.95)"
                    />
                    {/* Bottom Penalty Arc */}
                    <path
                        d="M 268 860 A 85 85 0 0 1 412 860"
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="2.5"
                    />
                    {/* Bottom Goal Net */}
                    <rect
                        x="290"
                        y="1020"
                        width="100"
                        height="15"
                        fill="none"
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                    />

                    {/* Corner Arcs */}
                    <path
                        d="M 30 55 A 25 25 0 0 0 55 30"
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="2.5"
                    />
                    <path
                        d="M 625 30 A 25 25 0 0 0 650 55"
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="2.5"
                    />
                    <path
                        d="M 30 995 A 25 25 0 0 1 55 1020"
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="2.5"
                    />
                    <path
                        d="M 625 1020 A 25 25 0 0 1 650 995"
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="2.5"
                    />
                </svg>

                {/* PLAYERS LAYER */}
                <div className="absolute inset-0 z-10" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                    {team.G?.map((p, i) => <PlayerNode key={`g-${i}`} player={p} position="G" index={i} total={team.G.length} formation={dominantFormation} startsMap={startsMap} />)}
                    {team.D?.map((p, i) => <PlayerNode key={`d-${i}`} player={p} position="D" index={i} total={team.D.length} formation={dominantFormation} startsMap={startsMap} />)}
                    {team.M?.map((p, i) => <PlayerNode key={`m-${i}`} player={p} position="M" index={i} total={team.M.length} formation={dominantFormation} startsMap={startsMap} />)}
                    {team.A?.map((p, i) => <PlayerNode key={`a-${i}`} player={p} position="A" index={i} total={team.A.length} formation={dominantFormation} startsMap={startsMap} />)}
                </div>
            </div>
        </div>
    );
};

export default PitchMap;
export { getTmRole, getPlayerTacticalDetails };
