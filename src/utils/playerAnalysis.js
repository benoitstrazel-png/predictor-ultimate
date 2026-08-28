
/**
 * Utility to analyze player performance from detailed match history
 */

const normalize = (name) => {
    if (!name) return "";
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9]/g, ""); // Remove non-alphanumeric
};

/**
 * Normalizes club names to handle discrepancies between FBref and Flashscore
 */
const normalizeClub = (club) => {
    if (!club) return "";
    const norm = normalize(club);

    // Map common variations
    const map = {
        'parissg': 'psg',
        'psg': 'psg',
        'paris': 'psg',
        'asmonaco': 'monaco',
        'monacofc': 'monaco',
        'om': 'marseille',
        'ol': 'lyon',
        'stetienne': 'stetienne',
        'assaintetienne': 'stetienne',
        'montpellierherault': 'montpellier',
        'rcstrasbourg': 'strasbourg',
        'ogcnice': 'nice',
        'losc': 'lille',
        'losclille': 'lille',
        'staderennais': 'rennes',
        'fcmetz': 'metz',
        'fcnantes': 'nantes',
        'fclorient': 'lorient',
        'ajauxerre': 'auxerre',
        'angerssco': 'angers'
    };

    return map[norm] || norm;
};

/**
 * Matches a full name (FBref style) with a short name (Flashscore style)
 */
const isPlayerMatch = (fullName, shortName) => {
    if (!fullName || !shortName) return false;

    const normFull = normalize(fullName);
    const normShort = normalize(shortName);

    // 1. Exact match
    if (normFull === normShort) return true;

    // 2. Simple contains for common cases
    if (normFull.includes(normShort) && normShort.length >= 5) return true;

    // 3. Flashscore format "Surname I." or "Surname"
    const parts = shortName.split(' ').map(p => p.trim()).filter(p => p);
    if (parts.length === 0) return false;

    const surname = normalize(parts[0]);
    if (surname.length < 3) return false;

    const fullNameParts = fullName.split(' ').map(p => normalize(p));

    if (fullNameParts.includes(surname)) {
        if (parts.length > 1) {
            const initialPart = parts[parts.length - 1];
            if (initialPart.length <= 2) {
                const initial = normalize(initialPart)[0];
                if (initial) {
                    return fullNameParts.some(p => p[0] === initial && p !== surname);
                }
            }
        }
        return true;
    }

    return false;
};

export const getPlayerGoalStats = (playerFull, clubName, allMatches) => {
    const distribution = {
        '0-15': 0, '16-30': 0, '31-45': 0,
        '46-60': 0, '61-75': 0, '76-90+': 0
    };

    let totalGoals = 0;
    const targetClub = normalizeClub(clubName);

    allMatches.forEach(match => {
        const home = normalizeClub(match.homeTeam);
        const away = normalizeClub(match.awayTeam);

        if (home !== targetClub && away !== targetClub) return;

        const rawGoals = match.goals || (match.events || []).filter(e => e.type === 'Goal');
        
        rawGoals.forEach(e => {
            if (isPlayerMatch(playerFull, e.player)) {
                totalGoals++;

                const minStr = String(e.time || '45').replace("'", "");
                const minute = parseInt(minStr) || 0;

                let bucket = '76-90+';
                if (minute <= 15) bucket = '0-15';
                else if (minute <= 30) bucket = '16-30';
                else if (minute <= 45) bucket = '31-45';
                else if (minute <= 60) bucket = '46-60';
                else if (minute <= 75) bucket = '61-75';

                distribution[bucket]++;
            }
        });
    });

    // Format for Recharts
    const chartData = Object.keys(distribution).map(bucket => ({
        name: bucket,
        goals: distribution[bucket]
    }));

    return { totalGoals, chartData };
};
