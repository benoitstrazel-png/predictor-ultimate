import React, { useState, useMemo } from 'react';
import UNIFIED_HISTORY from '../data/unified_history.json';
import MatchDetailsModal from './MatchDetailsModal';

const MatchHistory = ({ match }) => {
    const { homeTeam, awayTeam } = match;
    const [selectedModalMatch, setSelectedModalMatch] = useState(null);

    // Compute history dynamically across all 5 leagues
    const history = useMemo(() => {
        // 1. Last Home games for Home Team
        const lastHome = UNIFIED_HISTORY
            .filter(m => (m.homeTeam === homeTeam || m.home_team === homeTeam))
            .slice(-5)
            .map(m => {
                const scoreStr = m.score || '0-0';
                const [hg, ag] = scoreStr.split('-').map(Number);
                const opponent = m.awayTeam || m.away_team;
                let res = 'N';
                if (hg > ag) res = 'V';
                if (ag > hg) res = 'D';
                return { res, score: `${hg}-${ag}`, opponent, goals: m.goals || [], fullMatch: m };
            }).reverse();

        // 2. Last Away games for Away Team
        const lastAway = UNIFIED_HISTORY
            .filter(m => (m.awayTeam === awayTeam || m.away_team === awayTeam))
            .slice(-5)
            .map(m => {
                const scoreStr = m.score || '0-0';
                const [hg, ag] = scoreStr.split('-').map(Number);
                const opponent = m.homeTeam || m.home_team;
                let res = 'N';
                if (ag > hg) res = 'V';
                if (hg > ag) res = 'D';
                return { res, score: `${ag}-${hg}`, opponent, goals: m.goals || [], fullMatch: m }; // Score from away perspective
            }).reverse();

        // 3. H2H
        const h2h = UNIFIED_HISTORY
            .filter(m => {
                const h = m.homeTeam || m.home_team;
                const a = m.awayTeam || m.away_team;
                return (h === homeTeam && a === awayTeam) || (h === awayTeam && a === homeTeam);
            })
            .slice(-5)
            .map(m => ({
                date: m.date,
                home: m.homeTeam || m.home_team,
                away: m.awayTeam || m.away_team,
                score: m.score || '0-0',
                goals: m.goals || [],
                fullMatch: m
            }))
            .reverse();

        return { lastHome, lastAway, h2h };
    }, [homeTeam, awayTeam]);

    // Render a single match result row (vertical layout)
    const renderMatchRow = (item, index) => {
        const { res, score, opponent, fullMatch } = item;
        let bgClass = "bg-gray-700 border-gray-600";
        let textClass = "text-gray-300";

        if (res === 'V') { bgClass = "bg-[#CEF002]/20 border-[#CEF002]/50"; textClass = "text-[#CEF002]"; }
        if (res === 'N') { bgClass = "bg-orange-400/20 border-orange-400/50"; textClass = "text-orange-400"; }
        if (res === 'D') { bgClass = "bg-red-500/20 border-red-500/50"; textClass = "text-red-400"; }

        return (
            <div
                key={index}
                onClick={() => fullMatch && setSelectedModalMatch(fullMatch)}
                className="flex items-center justify-between w-full p-3 bg-black/20 hover:bg-white/10 rounded-lg border border-white/5 transition-colors group cursor-pointer"
                title="Cliquer pour voir la chronologie et les statistiques du match"
            >
                <div className="flex items-center gap-3">
                    {/* Bubble */}
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full border ${bgClass} ${textClass} font-black text-xs shadow-lg`}>
                        {res}
                    </div>
                    {/* Opponent */}
                    <span className="text-xs text-secondary font-bold uppercase tracking-wider">vs <span className="text-white ml-1">{opponent}</span></span>
                </div>
                {/* Score */}
                <span className="text-xs font-mono text-white/70 tracking-widest">{score}</span>
            </div>
        );
    };

    return (
        <div className="card bg-transparent !p-0 border-none flex flex-col gap-8">
            <div className="flex items-center -mb-2">
                <h2 className="text-white text-sm uppercase tracking-widest font-bold border-l-4 border-accent pl-3">
                    Historique Récent
                </h2>
            </div>

            {/* Team A History */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <h3 className="text-secondary text-xs uppercase tracking-wider mb-4 flex justify-between items-center">
                    <span className="text-accent font-bold">{homeTeam}</span>
                    <span className="opacity-50">à Domicile</span>
                </h3>
                <div className="flex flex-col gap-3">
                    {history.lastHome.length > 0 ? history.lastHome.map((m, i) => renderMatchRow(m, i)) : <span className="text-xs text-secondary italic">Aucune donnée</span>}
                </div>
            </div>

            {/* Team B History */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <h3 className="text-secondary text-xs uppercase tracking-wider mb-4 flex justify-between items-center">
                    <span className="text-red-400 font-bold">{awayTeam}</span>
                    <span className="opacity-50">à l'Extérieur</span>
                </h3>
                <div className="flex flex-col gap-3">
                    {history.lastAway.length > 0 ? history.lastAway.map((m, i) => renderMatchRow(m, i)) : <span className="text-xs text-secondary italic">Aucune donnée</span>}
                </div>
            </div>

            {/* H2H Table */}
            <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden">
                <div className="bg-white/5 px-4 py-3 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-white text-xs uppercase tracking-wider font-bold">Face à Face</h3>
                    <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-secondary">5 derniers matchs</span>
                </div>

                <table className="w-full text-sm text-left border-collapse">
                    <tbody className="divide-y divide-white/5">
                        {history.h2h.map((h, i) => (
                            <tr
                                key={i}
                                onClick={() => h.fullMatch && setSelectedModalMatch(h.fullMatch)}
                                className="hover:bg-white/10 transition-colors group cursor-pointer"
                                title="Cliquer pour voir la chronologie et les statistiques du match"
                            >
                                <td className="p-3 text-secondary text-xs w-32 font-mono">{h.date}</td>
                                <td className="p-3">
                                    <div className="flex items-center gap-3">
                                        <span className={`font-bold transition-all ${h.home === homeTeam ? "text-accent scale-105" : "text-white/70"}`}>{h.home}</span>
                                        <span className="text-secondary text-[10px] font-light uppercase px-1">vs</span>
                                        <span className={`font-bold transition-all ${h.away === awayTeam ? "text-red-400 scale-105" : "text-white/70"}`}>{h.away}</span>
                                    </div>
                                </td>
                                <td className="p-3 text-right">
                                    <span className="bg-black/40 px-2 py-1 rounded font-mono font-black text-white tracking-widest">{h.score}</span>
                                </td>
                            </tr>
                        ))}
                        {history.h2h.length === 0 && (
                            <tr><td colSpan="3" className="p-4 text-center text-xs text-secondary italic">Aucun historique récent.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Match Details Modal */}
            <MatchDetailsModal
                match={selectedModalMatch}
                isOpen={Boolean(selectedModalMatch)}
                onClose={() => setSelectedModalMatch(null)}
            />
        </div>
    );
};

export default MatchHistory;
