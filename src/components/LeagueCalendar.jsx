import React, { useState, useEffect } from 'react';
import InfoTooltip from './ui/InfoTooltip';
import TeamLogo from './ui/TeamLogo';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const LeagueCalendar = ({ schedule, selectedWeek, onWeekChange, highlightTeams = [] }) => {
    // Controlled component: selectedWeek comes from parent
    const [groupedMatches, setGroupedMatches] = useState({});
    const [sortedDays, setSortedDays] = useState([]);

    const maxWeek = schedule.length > 0 ? Math.max(...schedule.map(m => m.week || 0)) : 34;
    const weeks = Array.from({ length: maxWeek }, (_, i) => i + 1);

    useEffect(() => {
        const weekMatches = schedule.filter(m => m.week === selectedWeek);

        // Grouping Logic
        const groups = {};

        weekMatches.forEach(match => {
            let dateObj = null;
            let timeStr = "";

            // Handle various date formats
            // 1. "yyyy-mm-dd" (Standard JSON)
            // 2. "dd.mm. HH:MM" (Flashscore scrape)
            // 3. ISO String

            if (match.date) {
                if (match.date.includes('.')) {
                    // Scraper format: "25.01. 20:45"
                    const parts = match.date.split(' ');
                    const dateParts = parts[0].split('.');
                    const time = parts[1];

                    // Assuming current season year/next year logic is complex, 
                    // but for separating days, MM-DD is enough. 
                    // Let's try to construct a valid date for sorting.
                    const day = parseInt(dateParts[0]);
                    const month = parseInt(dateParts[1]) - 1; // 0-indexed
                    let year = 2025; // Default start
                    if (month < 7) year = 2026; // Approx logic

                    dateObj = new Date(year, month, day);
                    timeStr = time;
                } else if (match.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // "2026-01-10"
                    dateObj = new Date(match.date);
                    timeStr = "20:45"; // Default time if missing
                } else {
                    // Try direct parse
                    dateObj = new Date(match.date);
                }
            }

            if (!dateObj || isNaN(dateObj.getTime())) {
                // Fallback for missing/bad dates
                dateObj = new Date(2099, 0, 1);
                timeStr = "TBD";
            }

            // Group Key: "Saturday 25 January"
            const dayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'long' });
            const dayNum = dateObj.getDate();
            const monthName = dateObj.toLocaleDateString('fr-FR', { month: 'long' });

            // Capitalize First Letter
            const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
            const groupKey = `${capitalize(dayName)} ${dayNum} ${capitalize(monthName)}`;

            // Sort Key (Timestamp for day)
            const sortKey = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();

            if (!groups[sortKey]) {
                groups[sortKey] = {
                    label: groupKey,
                    matches: []
                };
            }

            // Add time to match object for display
            match.displayTime = timeStr;
            // Add sort timestamp for within-day sorting
            match.timestamp = dateObj.getTime();
            if (timeStr.includes(':')) {
                const [h, m] = timeStr.split(':').map(Number);
                match.timestamp += h * 3600000 + m * 60000;
            }

            groups[sortKey].matches.push(match);
        });

        // Sort days
        const sortedKeys = Object.keys(groups).sort((a, b) => parseInt(a) - parseInt(b));
        setSortedDays(sortedKeys.map(k => groups[k]));

        // Sort matches within days
        sortedKeys.forEach(k => {
            groups[k].matches.sort((a, b) => a.timestamp - b.timestamp);
        });

    }, [selectedWeek, schedule]);

    // Helper for confidence color
    const getConfClass = (conf) => {
        if (!conf) return 'text-slate-400';
        if (conf >= 60) return 'text-[#CEF002]'; // Lime
        if (conf >= 45) return 'text-orange-400'; // Orange
        return 'text-red-400'; // Red
    };

    return (
        <div className="card bg-[#0B1426] border border-white/5 shadow-xl">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-white m-0 text-lg uppercase tracking-widest font-bold flex items-center gap-2">
                        📅 Affiches <span className="text-accent text-sm bg-accent/10 px-2 py-0.5 rounded">J{selectedWeek}</span>
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onWeekChange(Math.max(1, selectedWeek - 1))}
                        disabled={selectedWeek <= 1}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-white/10 group"
                        aria-label="Semaine précédente"
                    >
                        <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>

                    <select
                        className="bg-slate-800 text-white p-1.5 rounded text-sm w-24 font-bold border border-white/10 focus:border-accent outline-none text-center appearance-none cursor-pointer"
                        value={selectedWeek}
                        onChange={(e) => onWeekChange(parseInt(e.target.value))}
                    >
                        {weeks.map(w => (
                            <option key={w} value={w}>J{w}</option>
                        ))}
                    </select>

                    <button
                        onClick={() => onWeekChange(Math.min(maxWeek, selectedWeek + 1))}
                        disabled={selectedWeek >= maxWeek}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-white/10 group"
                        aria-label="Semaine suivante"
                    >
                        <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </div>

            {/* Matches List Grouped by Day */}
            <div className="flex flex-col gap-6">
                {sortedDays.length === 0 && <p className="text-secondary text-center py-8">Aucun match trouvé pour cette journée.</p>}

                {sortedDays.map((dayGroup, idx) => (
                    <div key={idx} className="flex flex-col gap-3">
                        {/* Day Header */}
                        <div className="flex items-center gap-3">
                            <div className="h-[1px] flex-1 bg-white/10"></div>
                            <span className="text-accent font-bold uppercase tracking-widest text-xs border border-accent/20 px-3 py-1 rounded-full bg-accent/5">
                                {dayGroup.label}
                            </span>
                            <div className="h-[1px] flex-1 bg-white/10"></div>
                        </div>

                        {/* Matches Grid for this Day */}
                        <div className="flex flex-col gap-3">
                            {dayGroup.matches.map(match => {
                                const isHighlighted = highlightTeams.includes(match.homeTeam) || highlightTeams.includes(match.awayTeam);
                                // Logic for display text
                                let winnerDisplay = match.prediction?.winner;
                                const winnerConf = match.prediction?.winner_conf || 0;

                                if (winnerDisplay === 'Draw' || winnerDisplay === 'Nul') {
                                    winnerDisplay = "Nul";
                                } else if (winnerDisplay === match.homeTeam) {
                                    winnerDisplay = match.homeTeam;
                                } else if (winnerDisplay === match.awayTeam) {
                                    winnerDisplay = match.awayTeam;
                                }

                                // --- ADVANCED CONSISTENCY FIX: Score matching Winner AND Goals Pred ---
                                let displayScore = match.prediction?.score || '-';

                                if (match.status === 'SCHEDULED' && match.prediction?.score) {
                                    const scoreParts = match.prediction.score.split('-');
                                    let h = parseInt(scoreParts[0]);
                                    let a = parseInt(scoreParts[1]);

                                    if (!isNaN(h) && !isNaN(a)) {
                                        const isOver2_5 = match.prediction.goals_pred?.includes('+2.5');
                                        const isUnder2_5 = match.prediction.goals_pred?.includes('-2.5');

                                        // 1. Force Winner Consistency first
                                        const originalIsDraw = h === a;
                                        const isWeakPrediction = winnerConf < 45;

                                        let forceWinner = true;
                                        if (originalIsDraw && isWeakPrediction) {
                                            forceWinner = false; // We accept the draw
                                            winnerDisplay = "Nul";
                                        }

                                        if (forceWinner) {
                                            if (winnerDisplay === match.homeTeam && h <= a) h = a + 1;
                                            else if (winnerDisplay === match.awayTeam && a <= h) a = h + 1;
                                            else if (winnerDisplay === "Nul" && h !== a) { const m = Math.max(h, a); h = m; a = m; }
                                        }

                                        // 2. Force Goals Consistency (experimental)
                                        if (isUnder2_5 && (h + a) > 2) {
                                            if (winnerDisplay === match.homeTeam) { h = 1; a = 0; }
                                            else if (winnerDisplay === match.awayTeam) { h = 0; a = 1; }
                                            else { h = 1; a = 1; }
                                        }
                                        else if (isOver2_5 && (h + a) < 3) {
                                            if (winnerDisplay === match.homeTeam) { h = 2; a = 1; }
                                            else if (winnerDisplay === match.awayTeam) { h = 1; a = 2; }
                                            else { h = 2; a = 2; }
                                        }

                                        displayScore = `${h}-${a}`;
                                    }
                                }

                                if (match.status === 'FINISHED') {
                                    displayScore = match.score ? `${match.score.home}-${match.score.away}` : `${match.homeScore ?? 0}-${match.awayScore ?? 0}`;
                                } else if (match.status === 'POSTPONED') {
                                    displayScore = '?-?';
                                }
                                // -----------------------------------------------------------------------

                                return (
                                    <div key={match.id} className={`glass-card p-3 transition-all hover:bg-white/5 relative overflow-hidden
                                        ${isHighlighted ? 'border-accent bg-accent/5 shadow-[0_0_15px_rgba(206,240,2,0.1)]' : 'border-white/5'}`}>

                                        {/* Time Badge (Top Right) */}
                                        <div className="absolute top-2 right-2 text-[10px] font-mono text-slate-500 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                                            {match.displayTime}
                                        </div>

                                        {/* 3-COLUMN LAYOUT: Left (Home), Center (Info), Right (Away) */}
                                        <div className="grid grid-cols-3 gap-2 items-center min-h-[80px]">

                                            {/* HOME (Left): Logo Top, Name Bottom */}
                                            <div className="flex flex-col items-center justify-center gap-1.5">
                                                <TeamLogo teamName={match.homeTeam} size="sm" />
                                                <span className={`font-bold text-xs text-center leading-tight ${isHighlighted && match.homeTeam === highlightTeams[0] ? 'text-accent' : 'text-white'}`}>
                                                    {match.homeTeam}
                                                </span>
                                            </div>

                                            {/* CENTER: Stacked Info */}
                                            <div className="flex flex-col items-center justify-center text-center mt-2">
                                                {/* Score */}
                                                {match.status === 'FINISHED' ? (
                                                    <span className="text-xl font-black font-mono text-accent tracking-widest mb-1">
                                                        {displayScore}
                                                    </span>
                                                ) : match.status === 'POSTPONED' ? (
                                                    <span className="text-xl font-black font-mono text-slate-600 tracking-widest mb-1">
                                                        -
                                                    </span>
                                                ) : (
                                                    <div className="mb-1">
                                                        <span className="text-lg font-black font-mono text-accent animate-pulse tracking-widest">
                                                            {displayScore}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* PREDICTIONS STACKED */}
                                                {match.status === 'SCHEDULED' && match.prediction && (
                                                    <div className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-slate-300">
                                                        {/* Line 1: Winner */}
                                                        <div className="whitespace-nowrap">
                                                            <span className="opacity-50 mr-1">V:</span>
                                                            <span className="text-white mr-1">{winnerDisplay}</span>
                                                            <span className={getConfClass(winnerConf)}>({winnerConf}%)</span>
                                                        </div>
                                                        {/* Line 2: Goals */}
                                                        {match.prediction.goals_pred && (
                                                            <div className="whitespace-nowrap">
                                                                <span className="text-white mr-1">{match.prediction.goals_pred}</span>
                                                                <span className={getConfClass(match.prediction.goals_conf)}>({match.prediction.goals_conf}%)</span>
                                                            </div>
                                                        )}
                                                        {/* Line 3: Red Card */}
                                                        {match.prediction.red_card_prob !== undefined && (
                                                            <div className={`whitespace-nowrap flex items-center gap-1 ${match.prediction.red_card_prob > 30 ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}>
                                                                <span className="text-[9px]">🟥</span>
                                                                <span>{match.prediction.red_card_prob}% Exclusion</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {/* POSTPONED badge */}
                                                {match.status === 'POSTPONED' && (
                                                    <div className="flex flex-col items-center gap-1 mt-1">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 bg-orange-400/10 border border-orange-400/30 px-2 py-0.5 rounded-full">
                                                            ⏸ Reporté
                                                        </span>
                                                        {match.date && (
                                                            <span className="text-[9px] text-slate-500">{match.date}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* AWAY (Right): Logo Top, Name Bottom (Symmetrical) */}
                                            <div className="flex flex-col items-center justify-center gap-1.5">
                                                <TeamLogo teamName={match.awayTeam} size="sm" />
                                                <span className={`font-bold text-xs text-center leading-tight ${isHighlighted && match.awayTeam === highlightTeams[1] ? 'text-accent' : 'text-white'}`}>
                                                    {match.awayTeam}
                                                </span>
                                            </div>

                                        </div>

                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Betting Simulator removed from here, now in Dashboard */}
        </div>
    );
};

export default LeagueCalendar;
