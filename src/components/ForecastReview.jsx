
import React, { useState, useMemo } from 'react';
import predictionsHistory from '../data/predictions_history.json';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import TeamLogo from './ui/TeamLogo';

const findRealMatch = (scheduleList, pred) => {
    if (!scheduleList || !pred) return null;
    return scheduleList.find(m =>
        m.id === pred.id ||
        (m.week === pred.week && m.homeTeam === pred.home && m.awayTeam === pred.away) ||
        (m.homeTeam === pred.home && m.awayTeam === pred.away)
    );
};

const ForecastReview = ({ schedule, currentWeek }) => {
    // 1. Sort History by sourceWeek descending (newest first)
    const sortedHistory = useMemo(() => {
        return [...predictionsHistory].sort((a, b) => b.sourceWeek - a.sourceWeek);
    }, []);

    const [selectedSourceId, setSelectedSourceId] = useState(sortedHistory.length > 0 ? sortedHistory[0].sourceWeek : '');
    const [selectedTargetWeek, setSelectedTargetWeek] = useState(currentWeek ? parseInt(currentWeek) : 1);

    // 2. Get Selected Snapshot
    const snapshot = useMemo(() => {
        return sortedHistory.find(h => h.sourceWeek === parseInt(selectedSourceId));
    }, [selectedSourceId, sortedHistory]);

    // 3. Compute Metrics for the WHOLE snapshot (Evolution)
    const evolutionData = useMemo(() => {
        if (!snapshot) return [];

        const weeks = {};

        snapshot.predictions.forEach(pred => {
            if (!weeks[pred.week]) weeks[pred.week] = { week: pred.week, total: 0, winner: 0, score: 0, goals: 0, red_card: 0 };

            const realMatch = findRealMatch(schedule, pred);
            if (realMatch && realMatch.status === 'FINISHED' && realMatch.score) {
                weeks[pred.week].total++;

                // A. WINNER (1N2)
                let realWinner = 'Nul';
                if (realMatch.score.home > realMatch.score.away) realWinner = realMatch.homeTeam;
                if (realMatch.score.away > realMatch.score.home) realWinner = realMatch.awayTeam;

                const pWinnerLabel = pred.prediction.winner === 'Match Nul' ? 'Nul' : pred.prediction.winner;
                const isWinnerCorrect = (realWinner === 'Nul' && pWinnerLabel === 'Nul') ||
                    (realWinner !== 'Nul' && (pWinnerLabel === realWinner || pWinnerLabel.includes(realWinner)));

                if (isWinnerCorrect) weeks[pred.week].winner++;

                // B. EXACT SCORE
                const pScore = pred.prediction.score;
                const rScore = `${realMatch.score.home}-${realMatch.score.away}`;
                if (pScore === rScore) weeks[pred.week].score++;

                // C. GOALS (Over/Under 2.5)
                const totalGoals = realMatch.score.home + realMatch.score.away;
                const isOver = totalGoals > 2.5;
                const predLabel = pred.prediction.goals_pred; // "+2.5 Buts"
                if ((isOver && predLabel.includes('+')) || (!isOver && predLabel.includes('-'))) {
                    weeks[pred.week].goals++;
                }

                // D. RED CARD (Exclusion)
                // Prediction: "red_card_prob" (0-100). If > 20% -> Predicted Risk.
                // Reality: realMatch.hasRedCard (boolean from update_dashboard_full)
                const predRisk = pred.prediction.red_card_prob > 20;
                const actualRed = realMatch.hasRedCard || false;

                // Accuracy Logic: 
                // If Pred Risk (True) AND Actual Red (True) => Correct (Hit)
                // If Pred No Risk (False) AND Actual No Red (False) => Correct (Safe)
                // Simply: predRisk === actualRed
                if (predRisk === actualRed) {
                    weeks[pred.week].red_card++;
                }
            }
        });

        // Format for Chart
        return Object.values(weeks)
            .filter(w => w.total > 0)
            .sort((a, b) => a.week - b.week)
            .map(w => ({
                name: `J${w.week}`,
                "Vainqueur": Math.round((w.winner / w.total) * 100),
                "Score Exact": Math.round((w.score / w.total) * 100),
                "Buts +/- 2.5": Math.round((w.goals / w.total) * 100),
                "Carton Rouge": Math.round((w.red_card / w.total) * 100)
            }));
    }, [snapshot, schedule]);

    // 4. Comparison Data for TABLE (Selected Target Week)
    const tableData = useMemo(() => {
        if (!snapshot) return [];
        return snapshot.predictions
            .filter(p => p.week === parseInt(selectedTargetWeek))
            .map(pred => {
                const realMatch = findRealMatch(schedule, pred);
                // Calculate comparison details
                let comparison = {
                    winner: 'pending',
                    score: 'pending',
                    goals: 'pending',
                    red_card: 'pending'
                };
                let realData = { score: '-', winner: '-', goals: 0, red: false };

                if (realMatch && realMatch.status === 'FINISHED') {
                    realData.score = `${realMatch.score.home}-${realMatch.score.away}`;
                    realData.goals = realMatch.score.home + realMatch.score.away;
                    realData.red = realMatch.hasRedCard || false;

                    if (realMatch.score.home > realMatch.score.away) realData.winner = realMatch.homeTeam;
                    else if (realMatch.score.away > realMatch.score.home) realData.winner = realMatch.awayTeam;
                    else realData.winner = 'Nul';

                    // 1. Winner Check
                    const pWinnerLabel = pred.prediction.winner === 'Match Nul' ? 'Nul' : pred.prediction.winner;
                    const winOk = (realData.winner === 'Nul' && pWinnerLabel === 'Nul') ||
                        (realData.winner !== 'Nul' && (pWinnerLabel === realData.winner || pWinnerLabel.includes(realData.winner)));
                    comparison.winner = winOk ? 'correct' : 'incorrect';

                    // 2. Score Check
                    comparison.score = (pred.prediction.score === realData.score) ? 'correct' : 'incorrect';

                    // 3. Goals Check
                    const isOver = realData.goals > 2.5;
                    const predOver = pred.prediction.goals_pred.includes('+');
                    comparison.goals = (isOver === predOver) ? 'correct' : 'incorrect';

                    // 4. Red Card Check
                    const predRisk = pred.prediction.red_card_prob > 20;
                    comparison.red_card = (predRisk === realData.red) ? 'correct' : 'incorrect';
                }

                return {
                    ...pred,
                    realMatch,
                    realData,
                    comparison
                };
            });
    }, [snapshot, selectedTargetWeek, schedule]);

    // 5. CALCULATE TOP PERFORMERS (Global Ranking)
    const topPerformers = useMemo(() => {
        const stats = sortedHistory.map(hist => {
            let total = 0;
            let winner = 0;
            let score = 0;
            let goals = 0;

            hist.predictions.forEach(pred => {
                const realMatch = findRealMatch(schedule, pred);
                if (realMatch && realMatch.status === 'FINISHED' && realMatch.score) {
                    total++;

                    // Winner
                    let realWinner = 'Nul';
                    if (realMatch.score.home > realMatch.score.away) realWinner = realMatch.homeTeam;
                    if (realMatch.score.away > realMatch.score.home) realWinner = realMatch.awayTeam;

                    const pWinnerLabel = pred.prediction.winner === 'Match Nul' ? 'Nul' : pred.prediction.winner;
                    const isWinnerCorrect = (realWinner === 'Nul' && pWinnerLabel === 'Nul') ||
                        (realWinner !== 'Nul' && (pWinnerLabel === realWinner || pWinnerLabel.includes(realWinner)));
                    if (isWinnerCorrect) winner++;

                    // Score
                    if (pred.prediction.score === `${realMatch.score.home}-${realMatch.score.away}`) score++;

                    // Goals
                    const totalGoals = realMatch.score.home + realMatch.score.away;
                    const isOver = totalGoals > 2.5;
                    const predLabel = pred.prediction.goals_pred;
                    if ((isOver && predLabel.includes('+')) || (!isOver && predLabel.includes('-'))) goals++;
                }
            });

            return {
                id: hist.sourceWeek,
                total,
                winnerPct: total > 0 ? (winner / total) : 0,
                scorePct: total > 0 ? (score / total) : 0,
                goalsPct: total > 0 ? (goals / total) : 0,
            };
        }).filter(s => s.total > 0);

        const getTop3 = (key) => {
            return [...stats]
                .sort((a, b) => {
                    if (b[key] !== a[key]) return b[key] - a[key]; // Higher % first
                    return b.total - a.total; // Tie-breaker: More matches predicted first
                })
                .slice(0, 3);
        };

        return {
            winner: getTop3('winnerPct'),
            score: getTop3('scorePct'),
            goals: getTop3('goalsPct')
        };
    }, [sortedHistory, schedule]);

    if (!sortedHistory.length) return <div className="p-10 text-center text-slate-500">Aucun historique de prédiction disponible. Lancez le script de backfill.</div>;

    return (
        <div className="flex flex-col gap-6 animate-fadeIn">

            {/* 0. TOP PERFORMERS PODIUM */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <PerformanceCard title="🏆 Meilleurs Vainqueurs" data={topPerformers.winner} metric="winnerPct" color="text-accent" />
                <PerformanceCard title="🎯 Scores Exacts" data={topPerformers.score} metric="scorePct" color="text-blue-400" />
                <PerformanceCard title="⚽ Buts +/- 2.5" data={topPerformers.goals} metric="goalsPct" color="text-green-400" />
            </div>

            {/* 1. SELECTION HEADER */}
            <div className="card glass-panel p-6 border-b-4 border-accent">
                <div className="flex flex-col md:flex-row gap-8 justify-between items-end">
                    <div className="flex gap-6">
                        {/* SOURCE SELECTOR */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] uppercase font-bold text-secondary tracking-widest">
                                📅 Prédit après la
                            </label>
                            <select
                                value={selectedSourceId}
                                onChange={(e) => {
                                    setSelectedSourceId(e.target.value);
                                    // Auto-select valid target
                                    const snap = sortedHistory.find(s => s.sourceWeek === parseInt(e.target.value));
                                    if (snap && snap.predictions.length > 0) {
                                        const firstPredWeek = Math.min(...snap.predictions.map(p => p.week));
                                        setSelectedTargetWeek(firstPredWeek);
                                    }
                                }}
                                className="bg-slate-900 text-white p-3 rounded-xl border border-white/10 outline-none focus:border-accent font-bold min-w-[200px]"
                            >
                                {sortedHistory.map(s => (
                                    <option key={s.sourceWeek} value={s.sourceWeek}>
                                        Journée {s.sourceWeek} ({new Date(s.timestamp).toLocaleDateString()})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* OVERALL ACCURACY DISPLAY FOR THIS SOURCE */}
                    <div className="flex gap-8">
                        <div className="text-center px-4 border-r border-white/10">
                            <div className="text-3xl font-black text-accent">
                                {evolutionData.length > 0
                                    ? Math.round(evolutionData.reduce((acc, curr) => acc + curr.Vainqueur, 0) / evolutionData.length) + '%'
                                    : '-'}
                            </div>
                            <div className="text-[10px] uppercase text-slate-400">Vainqueur</div>
                        </div>
                        <div className="text-center px-4 border-r border-white/10">
                            <div className="text-3xl font-black text-blue-400">
                                {evolutionData.length > 0
                                    ? Math.round(evolutionData.reduce((acc, curr) => acc + curr["Score Exact"], 0) / evolutionData.length) + '%'
                                    : '-'}
                            </div>
                            <div className="text-[10px] uppercase text-slate-400">Score Exact</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. EVOLUTION CHART */}
            <div className="card glass-panel p-6">
                <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest">
                    📈 Fiabilité dans le temps (Source: J{selectedSourceId})
                </h3>
                <div className="w-full" style={{ height: 300, minHeight: 300 }}>
                    {evolutionData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={evolutionData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid vertical={false} stroke="#ffffff10" strokeDasharray="3 3" />
                                <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0F1C38', borderColor: '#ffffff20', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Line type="monotone" dataKey="Vainqueur" stroke="#CEF002" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                                <Line type="monotone" dataKey="Score Exact" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
                                <Line type="monotone" dataKey="Buts +/- 2.5" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
                                <Line type="monotone" dataKey="Carton Rouge" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-500 italic">
                            Pas assez de données pour afficher le graphique d'évolution.
                        </div>
                    )}
                </div>
            </div>

            {/* 3. DETAILED BREAKDOWN TABLE */}
            <div className="card glass-panel p-0 overflow-hidden">
                <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                        🔍 Détails par Journée
                    </h3>

                    <select
                        value={selectedTargetWeek}
                        onChange={(e) => setSelectedTargetWeek(parseInt(e.target.value))}
                        className="bg-slate-900 text-xs text-white p-2 rounded-lg border border-white/10 outline-none"
                    >
                        {snapshot?.predictions
                            .map(p => p.week)
                            .filter((value, index, self) => self.indexOf(value) === index) // Unique
                            .sort((a, b) => a - b)
                            .map(w => (
                                <option key={w} value={w}>Voir Journée {w}</option>
                            ))
                        }
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-[10px] uppercase text-secondary font-bold tracking-widest bg-black/20">
                                <th className="p-4">Match</th>
                                <th className="p-4 text-center">Prédiction</th>
                                <th className="p-4 text-center">Score Réel</th>
                                <th className="p-4 text-center text-accent">Vainqueur</th>
                                <th className="p-4 text-center text-blue-400">Score Exact</th>
                                <th className="p-4 text-center text-green-400">Buts +/-</th>
                                <th className="p-4 text-center text-red-500">Exclusion</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-white/5">
                            {tableData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-white/5 transition-colors">
                                    <td className="p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-end w-[100px] gap-2">
                                                <span className="font-bold text-right hidden md:block">{row.home}</span>
                                                <TeamLogo teamName={row.home} size="sm" />
                                            </div>
                                            <span className="text-xs text-slate-500">vs</span>
                                            <div className="flex items-center w-[100px] gap-2">
                                                <TeamLogo teamName={row.away} size="sm" />
                                                <span className="font-bold hidden md:block">{row.away}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="font-mono font-bold text-white">{row.prediction.score}</span>
                                            <span className="text-[9px] text-slate-400 uppercase">
                                                {row.prediction.years_label || row.prediction.winner}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className="font-mono font-bold text-slate-300">{row.realData.score}</span>
                                    </td>

                                    {/* 4 COLUMNS INDICATORS */}
                                    <td className="p-3 text-center">
                                        <Indicator status={row.comparison.winner} />
                                    </td>
                                    <td className="p-3 text-center">
                                        <Indicator status={row.comparison.score} />
                                    </td>
                                    <td className="p-3 text-center">
                                        <Indicator status={row.comparison.goals} />
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex flex-col items-center">
                                            <Indicator status={row.comparison.red_card} />
                                            {row.realData.red && <span className="text-[8px] text-red-500 font-bold">RED</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-black/40 font-bold text-sm text-secondary border-t border-white/10 uppercase tracking-widest">
                            <tr>
                                <td className="p-4" colSpan="3">Taux de Réussite (J{selectedTargetWeek})</td>
                                <td className="p-4 text-center">
                                    {Math.round((tableData.filter(d => d.comparison.winner === 'correct').length / tableData.length) * 100)}%
                                </td>
                                <td className="p-4 text-center text-blue-400">
                                    {Math.round((tableData.filter(d => d.comparison.score === 'correct').length / tableData.length) * 100)}%
                                </td>
                                <td className="p-4 text-center text-green-400">
                                    {Math.round((tableData.filter(d => d.comparison.goals === 'correct').length / tableData.length) * 100)}%
                                </td>
                                <td className="p-4 text-center text-red-500">
                                    {Math.round((tableData.filter(d => d.comparison.red_card === 'correct').length / tableData.length) * 100)}%
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

const PerformanceCard = ({ title, data, metric, color }) => (
    <div className="card glass-panel p-4 relative overflow-hidden group">
        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
            {/* Optional Icon Background */}
        </div>
        <h3 className={`text-xs font-black uppercase tracking-widest mb-4 border-b border-white/10 pb-2 ${color}`}>
            {title}
        </h3>
        <div className="flex flex-col gap-2">
            {data.map((item, idx) => (
                <div key={item.id} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold text-[10px] w-5 h-5 flex items-center justify-center rounded-full ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500' : idx === 1 ? 'bg-slate-400/20 text-slate-400' : 'bg-orange-700/20 text-orange-700'}`}>
                            {idx + 1}
                        </span>
                        <span className="text-slate-300 font-bold">J{item.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">({item.total} matchs)</span>
                        <span className={`font-mono font-bold ${idx === 0 ? 'text-white' : 'text-slate-400'}`}>
                            {Math.round(item[metric] * 100)}%
                        </span>
                    </div>
                </div>
            ))}
            {data.length === 0 && <span className="text-xs text-slate-600 italic">Pas de données</span>}
        </div>
    </div>
);

const Indicator = ({ status }) => {
    if (status === 'pending') return <span className="text-slate-700">-</span>;
    if (status === 'correct') return <span className="text-green-500 text-lg">✔</span>;
    return <span className="text-red-500/50 text-lg">✘</span>;
};

export default ForecastReview;
