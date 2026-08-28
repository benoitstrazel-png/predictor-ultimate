
import React, { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { analyzeClubEvents, getChartData } from '../utils/clubAnalysis';
import { calculateClusters } from '../utils/clustering';
import TeamLogo from './ui/TeamLogo';

// Import Data (Ideally this comes from a merged source)
import historical from '../data/matches_history_detailed.json';
import matchStats from '../data/match_stats_2025_2026.json';
import rosterData from '../data/real_players.json';
import ClubDistributionCharts from './ClubDistributionCharts';
import PitchMap from './PitchMap';
import TeamMatchStats from './TeamMatchStats';

import APP_DATA from '../data/app_data.json';

const ClubAnalysis = ({ teams, teamStats = {}, schedule = [], playerData = [] }) => {
    const [selectedTeam, setSelectedTeam] = useState('PSG');
    const [venueFilter, setVenueFilter] = useState('all');
    const [metricFilter, setMetricFilter] = useState('all');
    const [clusterFilter, setClusterFilter] = useState('all');
    const [allMatches, setAllMatches] = useState(historical);
    const [showSquad, setShowSquad] = useState(false);

    // 1. Calculate Clusters Dynamically
    const clusters = useMemo(() => {
        return calculateClusters(teams, [], teamStats, playerData, schedule);
    }, [teams, teamStats, playerData, schedule]);

    // 2. Derive Filters & Cluster Map
    const { clusterMap, availableClusters } = useMemo(() => {
        const map = {};
        const set = new Set();
        clusters.forEach(c => {
            map[c.name] = c.cluster;
            set.add(c.cluster); // e.g. "👑 Élites"
        });

        // Custom order for clusters based on GPS/Logic if needed, or just alphabetical/pre-defined order
        // Let's try to order them logically if we can, searching for known emojis
        const ordered = Array.from(set).sort((a, b) => {
            // Very basic sort or just keep as is
            return a.localeCompare(b);
        });

        return { clusterMap: map, availableClusters: ordered };
    }, [clusters]);

    const filteredMatches = useMemo(() => {
        let matches = allMatches;

        // Venue Filter
        if (venueFilter !== 'all') {
            matches = matches.filter(m => {
                const isHome = m.homeTeam === selectedTeam;
                return venueFilter === 'home' ? isHome : !isHome;
            });
        }

        // Cluster Filter
        if (clusterFilter !== 'all') {
            matches = matches.filter(m => {
                const isHome = m.homeTeam === selectedTeam;
                const opponent = isHome ? m.awayTeam : m.homeTeam;

                // Check opponent's cluster
                const oppCluster = clusterMap[opponent];
                // Match if opponent's cluster starts with the filter (handle simplified names if needed)
                // The filter value will be the full cluster name from the button
                return oppCluster === clusterFilter;
            });
        }

        // Ensure we filter for the selected team involved match
        return matches.filter(m => m.homeTeam === selectedTeam || m.awayTeam === selectedTeam);
    }, [allMatches, venueFilter, clusterFilter, selectedTeam, clusterMap]);

    const stats = useMemo(() => {
        return analyzeClubEvents(selectedTeam, filteredMatches);
    }, [selectedTeam, filteredMatches]);

    const chartData = useMemo(() => getChartData(stats), [stats]);

    return (
        <div className="flex flex-col gap-8">
            {/* HEADER / SELECTOR */}
            <div className="card bg-[#0B1426] p-6 border-b-4 border-accent flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <TeamLogo teamName={selectedTeam} size="lg" />
                    <div>
                        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">{selectedTeam}</h2>
                        <p className="text-secondary text-sm font-bold tracking-widest uppercase">Analyse Détaillée</p>
                        <p className="text-xs text-slate-500 mt-1">{filteredMatches.length} Matchs analysés</p>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                    {/* Venue Filter */}
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-secondary tracking-widest mr-2">Terrain:</span>
                            <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
                                {['all', 'home', 'away'].map(v => (
                                    <button
                                        key={v}
                                        onClick={() => setVenueFilter(v)}
                                        className={`px-3 py-1 text-[10px] uppercase font-bold rounded transition-colors ${venueFilter === v
                                            ? 'bg-accent text-[#0B1426]'
                                            : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        {v === 'all' ? 'Tout' : v === 'home' ? 'Dom.' : 'Ext.'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Cluster Filter */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-secondary tracking-widest mr-2">Adversaire:</span>
                            <div className="flex bg-slate-800 rounded-lg p-1 gap-1 flex-wrap justify-end max-w-[400px]">
                                <button
                                    onClick={() => setClusterFilter('all')}
                                    className={`px-3 py-1 text-[10px] uppercase font-bold rounded transition-colors ${clusterFilter === 'all'
                                        ? 'bg-purple-500 text-white'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    Tout
                                </button>
                                {availableClusters.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setClusterFilter(c)}
                                        className={`px-3 py-1 text-[10px] uppercase font-bold rounded transition-colors ${clusterFilter === c
                                            ? 'bg-purple-500 text-white'
                                            : 'text-slate-400 hover:text-white'
                                            }`}
                                        title={c}
                                    >
                                        {/* Shorten name for UI if needed, e.g. remove emoji or take first word */}
                                        {c.split(' ').slice(1).join(' ')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-[10px] uppercase font-bold text-secondary tracking-widest whitespace-nowrap">
                            Club:
                        </label>
                        <select
                            value={selectedTeam}
                            onChange={(e) => setSelectedTeam(e.target.value)}
                            className="bg-slate-800 text-white p-2 rounded-lg border border-white/10 outline-none focus:border-accent font-bold min-w-[150px] text-sm"
                        >
                            {teams.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* ERROR / EMPTY STATE */}
            {filteredMatches.length === 0 ? (
                <div className="card bg-[#0B1426] p-12 text-center border border-white/5">
                    <h3 className="text-xl font-bold text-white mb-2">Aucune donnée disponible</h3>
                    <p className="text-slate-400">Le scraping est peut-être en cours ou ce club n'a pas joué de match correspondant aux filtres.</p>
                </div>
            ) : (
                <>
                    {/* NEW FEATURES */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {console.log("Rendering PitchMap for:", selectedTeam, "Roster:", rosterData[selectedTeam])}
                        <PitchMap
                            clubName={selectedTeam}
                            roster={rosterData[selectedTeam] || []}
                            stats={stats.players}
                            schedule={APP_DATA.fullSchedule}
                            currentWeek={APP_DATA.currentWeek}
                            matchHistory={allMatches}
                            showFullSquad={showSquad}
                        />
                        <div className="flex justify-end p-2">
                            <button
                                onClick={() => setShowSquad(!showSquad)}
                                className="text-xs font-bold text-accent uppercase hover:text-white transition-colors border border-accent/30 px-3 py-1 rounded bg-accent/5 backdrop-blur-sm"
                            >
                                {showSquad ? 'Masquer l\'effectif' : 'Voir l\'effectif complet'}
                            </button>
                        </div>
                        <div className="min-h-[300px]">
                            <ClubDistributionCharts players={stats.players} />
                        </div>
                    </div>

                    {/* GRIDS */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* 1. GOAL TIMING */}
                        <div className="card col-span-1 lg:col-span-2 min-h-[400px]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    ⏱️ Distribution (15 min)
                                </h3>
                                <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
                                    {[{ id: 'all', l: 'Tout' }, { id: 'goals', l: 'Buts' }, { id: 'cards', l: 'Sanctions' }].map(m => (
                                        <button key={m.id} onClick={() => setMetricFilter(m.id)} className={`px-3 py-1 text-[10px] uppercase font-bold rounded transition-colors ${metricFilter === m.id ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>{m.l}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="w-full" style={{ height: 300 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Legend />
                                        {(metricFilter === 'all' || metricFilter === 'goals') ? <Bar dataKey="scored" fill="#CEF002" radius={[4, 4, 0, 0]} name="Buts Marqués" /> : null}
                                        {(metricFilter === 'all' || metricFilter === 'goals') ? <Bar dataKey="conceded" fill="#ef4444" radius={[4, 4, 0, 0]} name="Buts Encaissés" /> : null}
                                        {(metricFilter === 'all' || metricFilter === 'cards') ? <Bar dataKey="cards" fill="#facc15" radius={[4, 4, 0, 0]} name="Cartons (J/R)" /> : null}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 2. KEY STATS */}
                        <div className="flex flex-col gap-6">
                            {/* Discipline */}
                            <div className="card bg-white/5 border-l-4 border-yellow-400">
                                <h4 className="text-secondary text-xs uppercase font-bold mb-2">Discipline</h4>
                                <div className="flex justify-between items-end">
                                    <div className="flex gap-4">
                                        <div className="text-center">
                                            <span className="block text-2xl font-black text-yellow-400">{stats.discipline.yellow}</span>
                                            <span className="text-[10px] text-white/50 uppercase">Jaunes</span>
                                        </div>
                                        <div className="text-center">
                                            <span className="block text-2xl font-black text-red-500">{stats.discipline.red}</span>
                                            <span className="text-[10px] text-white/50 uppercase">Rouges</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs text-slate-400">Total Fautes (est.)</span>
                                        <span className="block text-lg font-bold text-white">{stats.discipline.total * 4}</span> {/* Est. 4 fouls per card-worthy foul approximately */}
                                    </div>
                                </div>
                            </div>

                            {/* Penalties */}
                            <div className="card bg-white/5 border-l-4 border-purple-500">
                                <h4 className="text-secondary text-xs uppercase font-bold mb-2">Pénaltys</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
                                    <div className="flex justify-between">
                                        <span>Obtenus:</span>
                                        <span className="font-bold text-white">{stats.penalties.awarded}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Marqués:</span>
                                        <span className="font-bold text-green-400">{stats.penalties.scored}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Concédés:</span>
                                        <span className="font-bold text-white">{stats.penalties.conceded}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Encaissés:</span>
                                        <span className="font-bold text-red-400">{stats.penalties.conceded_scored}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Resilience KPI */}
                            <div className="card bg-white/5 border-l-4 border-blue-400">
                                <h4 className="text-secondary text-xs uppercase font-bold mb-2">Mental & Scénario</h4>
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-300">Clean Sheets</span>
                                        <span className="badge bg-green-500/20 text-green-400 border border-green-500/50 px-2 py-0.5 rounded text-xs font-bold">{stats.scenarios.cleanSheets}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-300">Remontadas (Gagné après mené)</span>
                                        <span className="font-mono font-bold text-white">{stats.scenarios.comebacks}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-300">Points perdus (Menait au score)</span>
                                        <span className="font-mono font-bold text-red-400">{stats.scenarios.droppedPoints}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TEAM MATCH ANALYSIS (New Section) */}
                    <TeamMatchStats
                        selectedTeam={selectedTeam}
                        filteredMatches={filteredMatches}
                        matchStats={matchStats}
                    />

                </>
            )
            }

            <div className="text-center text-[10px] text-slate-600 italic mt-4">
                *Données mises à jour en temps réel (Historique complet inclus).
            </div>
        </div >
    );
};

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-center">
                    <h2 className="text-xl font-bold text-red-500">Something went wrong.</h2>
                    <pre className="text-left bg-slate-900 p-4 rounded text-xs text-secondary mt-4 overflow-auto">
                        {this.state.error && this.state.error.toString()}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}

const ClubAnalysisWithErrorBoundary = (props) => (
    <ErrorBoundary>
        <ClubAnalysis {...props} />
    </ErrorBoundary>
);

export default ClubAnalysisWithErrorBoundary;

