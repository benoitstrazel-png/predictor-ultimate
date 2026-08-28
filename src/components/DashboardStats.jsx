import React from 'react';
import SeasonGoalsChart from './SeasonGoalsChart';
import { Info } from 'lucide-react';

const StatCard = ({ title, value, trend, trendLabel, description, colorClass, shadowColor }) => (
    <div className="glass-card relative overflow-hidden w-full h-full flex flex-col p-2 px-3">
        {/* Background Blur Effect */}
        <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl transition-all opacity-10 ${colorClass}`}></div>

        {/* Header: Title & Info */}
        <div className="flex justify-between items-center z-10 mb-1">
            <h3 className="text-white text-[10px] font-bold uppercase tracking-wider">{title}</h3>
            <div className="relative group">
                <Info size={12} className="text-secondary cursor-help" />
                <div className="tooltip-content tooltip-left">
                    <p className="text-[10px] text-secondary leading-tight font-normal lowercase">{description}</p>
                </div>
            </div>
        </div>

        {/* Content: Value & Trend */}
        <div className="flex-1 flex flex-row items-baseline justify-between gap-1 z-10">
            <p className={`text-2xl font-black tracking-tighter text-white filter drop-shadow-[0_0_10px_${shadowColor}]`}>
                {value}
            </p>
            {trend && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${trend}`}>
                    {trendLabel}
                </span>
            )}
        </div>
    </div>
);

const DashboardStats = ({ stats = {}, schedule = [], currentWeek = 1, teamStats }) => {
    const totalGoals = stats?.totalGoals ?? (schedule && schedule.length > 0 ? schedule.reduce((acc, m) => acc + (m.homeScore ?? 0) + (m.awayScore ?? 0), 0) : 142);
    const goalsPerDay = stats?.goalsPerDay ?? '2.84';
    const goalsPerMatch = stats?.goalsPerMatch ?? '2.65';

    return (
        <div className="flex flex-col gap-8">
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-20 h-20 max-w-4xl mx-auto mb-12">
                <StatCard
                    title="Buts Total Saison"
                    value={totalGoals}
                    trend="text-accent bg-accent/10 border-accent/20"
                    trendLabel="+12%"
                    description="Somme des buts marqués par toutes les équipes depuis le début de la saison."
                    colorClass="bg-accent"
                    shadowColor="rgba(255,255,255,0.2)"
                />
                <StatCard
                    title="Moyenne Buts/Jr"
                    value={goalsPerDay}
                    trend="text-blue-400 bg-blue-400/10 border-blue-400/20"
                    trendLabel="Stable"
                    description="Moyenne des buts marqués par journée de championnat."
                    colorClass="bg-blue-500"
                    shadowColor="rgba(59,130,246,0.3)"
                />
                <StatCard
                    title="Moyenne Buts/Match"
                    value={goalsPerMatch}
                    trend="text-pink-400 bg-pink-400/10 border-pink-400/20"
                    trendLabel="Top 5 EU"
                    description="Ratio moyen de buts par match joué."
                    colorClass="bg-pink-500"
                    shadowColor="rgba(236,72,153,0.3)"
                />
            </div>

            {/* Charts Section */}
            <div className="w-full">
                {/* Main Graph: Real vs Projected */}
                <div className="card w-full bg-[#0F1C38] border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h3 className="text-lg font-bold text-white">Évolution des Buts / Journée</h3>
                            <p className="text-secondary text-xs">Comparatif Réel vs Simulation IA</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-1 bg-white rounded-full"></div>
                                <span className="text-white">RÉEL</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-1 border-t-2 border-dashed border-accent"></div>
                                <span className="text-accent">PROJETÉ</span>
                            </div>
                        </div>
                    </div>
                    <SeasonGoalsChart schedule={schedule} currentWeek={currentWeek} teamStats={teamStats} />
                </div>
            </div>
        </div>
    );
};

export default DashboardStats;
