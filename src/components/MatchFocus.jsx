import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPlayerPhoto } from '../utils/playerPhotos';
import CALCULATED_STATS from '../data/player_stats_calculated.json';
import TM_POSITIONS from '../data/player_positions_tm.json'; // Import Positions
import { Check, ChevronRight, RefreshCw, Trophy, Users, X } from 'lucide-react';

// --- CONFIGURATION ---
const FORMATIONS = {
    "4-3-3": {
        label: "4-3-3 Classique",
        slots: [
            { id: 'GK', x: 50, y: 90, role: 'G', label: 'G' },
            { id: 'LB', x: 15, y: 70, role: 'D', label: 'DG' },
            { id: 'LCB', x: 38, y: 75, role: 'D', label: 'DC' },
            { id: 'RCB', x: 62, y: 75, role: 'D', label: 'DC' },
            { id: 'RB', x: 85, y: 70, role: 'D', label: 'DD' },
            { id: 'CDM', x: 50, y: 55, role: 'M', label: 'MDF' },
            { id: 'LCM', x: 30, y: 45, role: 'M', label: 'MC' },
            { id: 'RCM', x: 70, y: 45, role: 'M', label: 'MC' },
            { id: 'LW', x: 15, y: 20, role: 'A', label: 'AVG' },
            { id: 'ST', x: 50, y: 15, role: 'A', label: 'BU' },
            { id: 'RW', x: 85, y: 20, role: 'A', label: 'AVD' },
        ]
    },
    "4-4-2": {
        label: "4-4-2 À Plat",
        slots: [
            { id: 'GK', x: 50, y: 90, role: 'G', label: 'G' },
            { id: 'LB', x: 15, y: 70, role: 'D', label: 'DG' },
            { id: 'LCB', x: 38, y: 75, role: 'D', label: 'DC' },
            { id: 'RCB', x: 62, y: 75, role: 'D', label: 'DC' },
            { id: 'RB', x: 85, y: 70, role: 'D', label: 'DD' },
            { id: 'LM', x: 15, y: 45, role: 'M', label: 'MG' },
            { id: 'LCM', x: 38, y: 50, role: 'M', label: 'MC' },
            { id: 'RCM', x: 62, y: 50, role: 'M', label: 'MC' },
            { id: 'RM', x: 85, y: 45, role: 'M', label: 'MD' },
            { id: 'LST', x: 35, y: 20, role: 'A', label: 'BU' },
            { id: 'RST', x: 65, y: 20, role: 'A', label: 'BU' },
        ]
    },
    "4-2-3-1": {
        label: "4-2-3-1 Moderne",
        slots: [
            { id: 'GK', x: 50, y: 90, role: 'G', label: 'G' },
            { id: 'LB', x: 15, y: 70, role: 'D', label: 'DG' },
            { id: 'LCB', x: 38, y: 75, role: 'D', label: 'DC' },
            { id: 'RCB', x: 62, y: 75, role: 'D', label: 'DC' },
            { id: 'RB', x: 85, y: 70, role: 'D', label: 'DD' },
            { id: 'LDM', x: 35, y: 55, role: 'M', label: 'MDF' },
            { id: 'RDM', x: 65, y: 55, role: 'M', label: 'MDF' },
            { id: 'LM', x: 15, y: 35, role: 'M', label: 'MG' },
            { id: 'CAM', x: 50, y: 35, role: 'M', label: 'MOC' },
            { id: 'RM', x: 85, y: 35, role: 'M', label: 'MD' },
            { id: 'ST', x: 50, y: 15, role: 'A', label: 'BU' },
        ]
    },
    "3-5-2": {
        label: "3-5-2 Offensif",
        slots: [
            { id: 'GK', x: 50, y: 90, role: 'G', label: 'G' },
            { id: 'LCB', x: 25, y: 75, role: 'D', label: 'DC' },
            { id: 'CB', x: 50, y: 75, role: 'D', label: 'DC' },
            { id: 'RCB', x: 75, y: 75, role: 'D', label: 'DC' },
            { id: 'LWB', x: 10, y: 50, role: 'D', label: 'Piston' },
            { id: 'LCM', x: 35, y: 50, role: 'M', label: 'MC' },
            { id: 'CDM', x: 50, y: 60, role: 'M', label: 'MDF' },
            { id: 'RCM', x: 65, y: 50, role: 'M', label: 'MC' },
            { id: 'RWB', x: 90, y: 50, role: 'D', label: 'Piston' },
            { id: 'LST', x: 35, y: 20, role: 'A', label: 'BU' },
            { id: 'RST', x: 65, y: 20, role: 'A', label: 'BU' },
        ]
    }
};

// Colors for roles
const ROLE_COLORS = {
    'G': 'bg-yellow-500',
    'D': 'bg-blue-500',
    'M': 'bg-green-500',
    'A': 'bg-red-500'
};

// Helper: Get Role from TM Data
const getPlayerRole = (name) => {
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
        const m = found.main.toLowerCase();
        if (m.includes('gardien')) return 'G';
        if (m.includes('défens')) return 'D'; // Défenseur, Défense
        if (m.includes('milieu')) return 'M';
        if (m.includes('attaquant') || m.includes('ailier')) return 'A';
    }

    return null;
};

// Helper: Get Display Position
const getDisplayPosition = (name) => {
    const norm = (str) => {
        if (typeof str !== 'string') return "";
        return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "").trim();
    };
    const n = norm(name);
    for (const [key, val] of Object.entries(TM_POSITIONS || {})) {
        if (norm(key) === n) { return val.main; }
    }
    return "Joueur";
}

// --- SUB-COMPONENTS ---

const TacticalBoard = ({ side, formation, lineup, onSlotClick }) => {
    const slots = FORMATIONS[formation].slots;

    return (
        <div className="relative w-full aspect-[3/4] bg-[#1a4f1a] rounded-xl border-4 border-white/10 shadow-2xl overflow-hidden mx-auto max-w-[400px]">
            {/* Field Markings */}
            <div className="absolute inset-4 border-2 border-white/20 opacity-50"></div>
            <div className="absolute top-0 left-[25%] right-[25%] h-16 border-b-2 border-x-2 border-white/20 opacity-50"></div>
            <div className="absolute bottom-0 left-[25%] right-[25%] h-16 border-t-2 border-x-2 border-white/20 opacity-50"></div>
            <div className="absolute top-[50%] w-full h-0.5 bg-white/20 opacity-50"></div>
            <div className="absolute top-[50%] left-[50%] w-24 h-24 border-2 border-white/20 rounded-full transform -translate-x-1/2 -translate-y-1/2 opacity-50"></div>

            {/* Header */}
            <div className="absolute top-2 left-0 right-0 text-center pointer-events-none">
                <span className="bg-black/40 px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-widest backdrop-blur-sm">
                    {side === 'home' ? 'Domicile' : 'Extérieur'}
                </span>
            </div>

            {/* Slots */}
            {slots.map((slot) => {
                const player = lineup[slot.id];
                const isFilled = !!player;

                // Flip Y coords for visual perspective if needed, but standard top-down view is usually fine.
                // Let's keep it simple: Top is Attack for Home? No, usually Bottom is GK for layout.
                // Standard tactics board: GK at bottom.

                return (
                    <motion.div
                        key={slot.id}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                        style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onSlotClick(slot.id, slot.role)}
                    >
                        {isFilled ? (
                            <div className="flex flex-col items-center">
                                <div
                                    className={`rounded-full border-2 ${side === 'home' ? 'border-accent' : 'border-red-400'} overflow-hidden bg-slate-900 shadow-lg relative`}
                                    style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
                                >
                                    <img
                                        src={getPlayerPhoto(player.team, player.name)}
                                        alt={player.name}
                                        className="w-full h-full object-cover"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    {/* Remove Button on Hover */}
                                    {/* <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                         <X size={16} className="text-white" />
                                     </div> */}
                                </div>
                                <div className="mt-1 bg-black/80 px-1.5 py-0.5 rounded text-[8px] font-bold text-white whitespace-nowrap border border-white/10">
                                    {player.name.split(' ').pop()}
                                </div>
                            </div>
                        ) : (
                            <div className={`w-8 h-8 rounded-full border-2 border-white/20 bg-black/20 flex items-center justify-center hover:bg-white/10 transition-colors ${ROLE_COLORS[slot.role].replace('bg-', 'text-')} `}>
                                <span className="text-[9px] font-bold opacity-70">{slot.label}</span>
                            </div>
                        )}
                    </motion.div>
                );
            })}
        </div>
    );
};

const PlayerPicker = ({ isOpen, onClose, team, roleFilter, onSelect, currentLineup }) => {
    const [search, setSearch] = useState("");
    const roster = CALCULATED_STATS[team] || [];

    // Filter Logic
    const filteredPlayers = roster.filter(p => {
        // 1. Exclude already selected
        if (Object.values(currentLineup).some(sel => sel.name === p.name)) return false;

        // 2. Name Search
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;

        // 3. Role Suggestion from JSON
        const detectedRole = getPlayerRole(p.name);

        if (search) return true; // Show all matches if searching

        if (roleFilter) {
            if (detectedRole) return detectedRole === roleFilter;
            if (p.position) return p.position === roleFilter;
            return false;
        }

        return true;
    });

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#0f172a] border-l border-white/10 z-50 shadow-2xl flex flex-col"
                    >
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#020617]">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Users size={18} className="text-accent" />
                                Sélectionner Joueur ({roleFilter})
                            </h3>
                            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4">
                            <input
                                type="text"
                                placeholder="Rechercher un joueur..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-slate-800 text-white p-3 rounded-xl border border-white/10 focus:border-accent outline-none font-bold"
                            />
                            <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${roleFilter === 'G' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500' : 'bg-slate-800 text-slate-400'}`}>Gardiens</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${roleFilter === 'D' ? 'bg-blue-500/20 text-blue-500 border border-blue-500' : 'bg-slate-800 text-slate-400'}`}>Défenseurs</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${roleFilter === 'M' ? 'bg-green-500/20 text-green-500 border border-green-500' : 'bg-slate-800 text-slate-400'}`}>Milieux</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${roleFilter === 'A' ? 'bg-red-500/20 text-red-500 border border-red-500' : 'bg-slate-800 text-slate-400'}`}>Attaquants</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {filteredPlayers.map(p => (
                                <div
                                    key={p.name}
                                    onClick={() => onSelect(p)}
                                    className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-accent cursor-pointer transition-all group"
                                >
                                    <div
                                        className="w-12 h-12 rounded-full bg-slate-800 overflow-hidden border border-white/10 group-hover:scale-110 transition-transform shrink-0"
                                        style={{ width: '48px', height: '48px', minWidth: '48px' }}
                                    >
                                        <img src={getPlayerPhoto(team, p.name)} alt={p.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-white text-sm">{p.name}</div>
                                        <div className="text-xs text-secondary">{getDisplayPosition(p.name)}</div>
                                    </div>
                                    <div className="text-accent">
                                        <ChevronRight size={16} />
                                    </div>
                                </div>
                            ))}
                            {filteredPlayers.length === 0 && (
                                <div className="text-center text-slate-500 py-10">
                                    Aucun joueur trouvé pour ce poste.
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};


// --- MAIN COMPONENT ---

const MatchFocus = ({ teams }) => {
    // Selection State
    const [homeTeam, setHomeTeam] = useState(teams[0] || 'PSG');
    const [awayTeam, setAwayTeam] = useState(teams[1] || 'Marseille');
    const [homeFormation, setHomeFormation] = useState("4-3-3");
    const [awayFormation, setAwayFormation] = useState("4-3-3");

    // Lineup State: { GK: player, LB: player ... }
    const [homeLineup, setHomeLineup] = useState({});
    const [awayLineup, setAwayLineup] = useState({});

    // Picker State
    const [pickerState, setPickerState] = useState({ isOpen: false, side: null, slotId: null, role: null });

    // Simulation State
    const [simState, setSimState] = useState('IDLE'); // IDLE, PLAYING, FINISHED
    const [matchTime, setMatchTime] = useState(0);
    const [score, setScore] = useState({ home: 0, away: 0 });
    const [events, setEvents] = useState([]);

    // Reset when teams change
    useEffect(() => {
        setHomeLineup({});
        setSimState('IDLE');
    }, [homeTeam, homeFormation]);

    useEffect(() => {
        setAwayLineup({});
        setSimState('IDLE');
    }, [awayTeam, awayFormation]);

    // HANDLERS
    const openPicker = (side, slotId, role) => {
        setPickerState({ isOpen: true, side, slotId, role });
    };

    const handlePlayerSelect = (player) => {
        const { side, slotId } = pickerState;
        if (side === 'home') {
            setHomeLineup(prev => ({ ...prev, [slotId]: player }));
        } else {
            setAwayLineup(prev => ({ ...prev, [slotId]: player }));
        }
        setPickerState({ isOpen: false, side: null, slotId: null, role: null });
    };

    // SIMULATION LOGIC (Simplified from before)
    const isReady =
        Object.keys(homeLineup).length === FORMATIONS[homeFormation].slots.length &&
        Object.keys(awayLineup).length === FORMATIONS[awayFormation].slots.length;

    const startMatch = () => {
        if (!isReady) return;

        // Generate Scenario
        const hPlayers = Object.values(homeLineup);
        const aPlayers = Object.values(awayLineup);

        // Simple goals calc
        const hGoals = Math.floor(Math.random() * 4); // 0-3
        const aGoals = Math.floor(Math.random() * 3); // 0-2

        const newEvents = [];
        for (let i = 0; i < hGoals; i++) {
            newEvents.push({ type: 'goal', side: 'home', minute: Math.floor(Math.random() * 85) + 1, player: hPlayers[Math.floor(Math.random() * 10)].name });
        }
        for (let i = 0; i < aGoals; i++) {
            newEvents.push({ type: 'goal', side: 'away', minute: Math.floor(Math.random() * 85) + 1, player: aPlayers[Math.floor(Math.random() * 10)].name });
        }
        newEvents.sort((a, b) => a.minute - b.minute);

        setEvents(newEvents);
        setSimState('PLAYING');
        setMatchTime(0);
        setScore({ home: 0, away: 0 });
    };

    // Timer Loop
    useEffect(() => {
        let interval;
        if (simState === 'PLAYING') {
            interval = setInterval(() => {
                setMatchTime(t => {
                    const next = t + 1;
                    if (next >= 90) setSimState('FINISHED');
                    return next;
                });
            }, 100); // 100ms per minute = 9 seconds match
        }
        return () => clearInterval(interval);
    }, [simState]);

    // Live Score Update
    useEffect(() => {
        if (simState !== 'PLAYING') return;
        const currentEvents = events.filter(e => e.minute === matchTime);
        if (currentEvents.length > 0) {
            currentEvents.forEach(e => {
                if (e.type === 'goal') {
                    setScore(prev => ({
                        ...prev,
                        [e.side]: prev[e.side] + 1
                    }));
                }
            });
        }
    }, [matchTime, simState, events]);


    return (
        <div className="flex flex-col gap-8 min-h-screen pb-20 fade-in">
            {/* --- HEADER CONTROLS --- */}
            <div className="card glass-panel p-6 border-b-4 border-accent sticky top-0 z-30 bg-[#0f172a]/90 backdrop-blur-md">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">

                    {/* HOME */}
                    <div className="flex items-center gap-4 flex-1">
                        <div className="flex flex-col items-end flex-1">
                            <select
                                value={homeTeam}
                                onChange={(e) => setHomeTeam(e.target.value)}
                                className="bg-transparent text-white font-black text-2xl outline-none text-right appearance-none cursor-pointer hover:text-accent transition-colors"
                            >
                                {teams.map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
                            </select>
                            <select
                                value={homeFormation}
                                onChange={(e) => setHomeFormation(e.target.value)}
                                className="text-secondary text-sm bg-transparent outline-none text-right cursor-pointer"
                            >
                                {Object.keys(FORMATIONS).map(f => <option key={f} value={f} className="bg-slate-900">{FORMATIONS[f].label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* SCOREBOARD / TIMER */}
                    <div className="flex flex-col items-center justify-center w-64">
                        {simState === 'IDLE' ? (
                            <button
                                onClick={startMatch}
                                disabled={!isReady}
                                className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest transition-all ${isReady ? 'bg-accent text-slate-900 hover:scale-105 shadow-[0_0_20px_rgba(206,240,2,0.4)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                            >
                                {isReady ? "Coup d'Envoi" : "Incomplet"}
                            </button>
                        ) : (
                            <div className="flex flex-col items-center animate-fadeIn">
                                <div className="text-5xl font-black text-white leading-none flex items-center gap-4">
                                    <span>{score.home}</span>
                                    <span className="text-accent text-3xl">:</span>
                                    <span>{score.away}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                    <span className="font-mono font-bold text-red-500">{matchTime}'</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* AWAY */}
                    <div className="flex items-center gap-4 flex-1 flex-row-reverse">
                        <div className="flex flex-col items-start flex-1">
                            <select
                                value={awayTeam}
                                onChange={(e) => setAwayTeam(e.target.value)}
                                className="bg-transparent text-white font-black text-2xl outline-none text-left appearance-none cursor-pointer hover:text-accent transition-colors"
                            >
                                {teams.map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
                            </select>
                            <select
                                value={awayFormation}
                                onChange={(e) => setAwayFormation(e.target.value)}
                                className="text-secondary text-sm bg-transparent outline-none text-left cursor-pointer"
                            >
                                {Object.keys(FORMATIONS).map(f => <option key={f} value={f} className="bg-slate-900">{FORMATIONS[f].label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- WORKSPACE --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4 max-w-7xl mx-auto w-full">

                {/* HOME BOARD */}
                <div className="flex flex-col gap-4">
                    <TacticalBoard
                        side="home"
                        formation={homeFormation}
                        lineup={homeLineup}
                        onSlotClick={(id, role) => openPicker('home', id, role)}
                    />
                    <div className="text-center text-xs text-secondary font-mono">
                        {Object.keys(homeLineup).length} / 11 Joueurs
                    </div>
                </div>

                {/* AWAY BOARD */}
                <div className="flex flex-col gap-4">
                    <TacticalBoard
                        side="away"
                        formation={awayFormation}
                        lineup={awayLineup}
                        onSlotClick={(id, role) => openPicker('away', id, role)}
                    />
                    <div className="text-center text-xs text-secondary font-mono">
                        {Object.keys(awayLineup).length} / 11 Joueurs
                    </div>
                </div>

            </div>

            {/* --- EVENT TICKER --- */}
            {simState !== 'IDLE' && (
                <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 border-t border-accent/20 p-4 backdrop-blur-md z-40">
                    <div className="max-w-4xl mx-auto flex items-center gap-4 overflow-hidden">
                        <span className="text-accent font-black uppercase text-xs tracking-widest whitespace-nowrap">Direct Live</span>
                        <div className="flex-1 overflow-x-auto flex gap-6 custom-scrollbar pb-1">
                            {events.filter(e => e.minute <= matchTime).reverse().map((e, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-white whitespace-nowrap animate-slideIn">
                                    <span className="font-mono text-slate-400">{e.minute}'</span>
                                    {e.type === 'goal' && <span className="text-accent font-bold">BUT!</span>}
                                    <span className="font-bold">{e.player}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* --- PLAYER PICKER DRAWER --- */}
            <PlayerPicker
                isOpen={pickerState.isOpen}
                onClose={() => setPickerState(prev => ({ ...prev, isOpen: false }))}
                team={pickerState.side === 'home' ? homeTeam : awayTeam}
                roleFilter={pickerState.role}
                currentLineup={pickerState.side === 'home' ? homeLineup : awayLineup}
                onSelect={handlePlayerSelect}
            />

        </div>
    );
};

export default MatchFocus;
