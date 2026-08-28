const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../src/data/player_positions_tm.json');

function normalize(str) {
    return str?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "").trim() || "";
}

function deduplicate() {
    console.log("Reading data...");
    const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(rawData);

    const cleanData = {};
    const stats = { kept: 0, merged: 0, removed: 0 };

    // Group entries by a normalized key (lastname + normalized name check)
    // Actually, simply iterating and checking if we already have a "better" version is tricky because the keys vary wildly.
    // Better strategy:
    // 1. Create a map of "Last Name" -> [List of Entries]
    // 2. For each group, determine if they are the same player.
    //    - Same team? (We don't have team in this json, sadly, only in the CSV/source list)
    //    - But we can check name similarity. "Balerdi L." and "Leonardo Balerdi" share "balerdi".

    // Simpler approach for the specific issue observed (Keys like "Balerdi L." vs "Leonardo Balerdi"):
    // We want to keep the "Full Name" key if possible, OR just merge content.

    // Let's iterate all keys.
    const entries = Object.entries(data);

    // Helper to extract last name roughly
    const getLastName = (name) => {
        const parts = name.split(' ');
        if (parts.length > 1 && parts[1].length === 2 && parts[1].endsWith('.')) return parts[0]; // "Balerdi L." -> "Balerdi"
        if (parts.length > 1 && parts[0].length === 2 && parts[0].endsWith('.')) return parts[1]; // "L. Balerdi" -> "Balerdi" (rare)
        return parts[parts.length - 1]; // "Leonardo Balerdi" -> "Balerdi"
    };

    // We need to be careful not to merge "Lucas A." and "Lucas B." if they are different.
    // But duplicate keys like "Balerdi L." and "balerdi l" are definitely mergeable.

    // 1. Normalize Keys Map
    const normalizedMap = {};

    entries.forEach(([key, val]) => {
        const normKey = normalize(key);
        if (!normalizedMap[normKey]) normalizedMap[normKey] = [];
        normalizedMap[normKey].push({ originalKey: key, data: val });
    });

    // 2. Merge strict duplicates (case insensitive)
    for (const normKey in normalizedMap) {
        const group = normalizedMap[normKey];

        // Pick the "best" key (longest, usually means full name or proper casing)
        // Sort by length desc, then alphabetically
        group.sort((a, b) => b.originalKey.length - a.originalKey.length || a.originalKey.localeCompare(b.originalKey));

        const bestEntry = group[0];
        const mergedData = bestEntry.data;

        // Merge info from others if missing in best
        for (let i = 1; i < group.length; i++) {
            const other = group[i];
            if (!mergedData.birthDate && other.data.birthDate) mergedData.birthDate = other.data.birthDate;
            if ((!mergedData.main || mergedData.error) && other.data.main && !other.data.error) {
                mergedData.main = other.data.main;
                mergedData.other = other.data.other;
            }
            if (!mergedData.image && other.data.image) mergedData.image = other.data.image;
        }

        cleanData[bestEntry.originalKey] = mergedData;
    }

    // 3. (Optional but requested) Merge "Balerdi L." into "Leonardo Balerdi"
    // This requires cross-referencing.
    // A heuristic: if we have "Name L." and "Firstname Name", and "Name" matches...
    // Let's just create a list of known "Lastname Initial" keys to verify against full names.

    const finalData = {};
    const distinctKeys = Object.keys(cleanData);

    distinctKeys.forEach(key => {
        // If this key is already processed/merged into another, skip?
        // No, we build a new object.

        // Check if this key looks like "Name I."
        const isAbbrev = /^[A-Z][a-z]+ [A-Z]\.$/.test(key) || /^[A-Z]\. [A-Z][a-z]+$/.test(key);

        if (isAbbrev) {
            // Check if there's a full name version in the dataset
            const namePart = key.split(' ')[0]; // "Balerdi" from "Balerdi L."
            const candidates = distinctKeys.filter(k => k.includes(namePart) && k !== key && k.length > key.length);

            if (candidates.length === 1) {
                // High confidence match? e.g. "Balerdi L." vs "Leonardo Balerdi"
                const fullKey = candidates[0];
                console.log(`Merging ${key} into ${fullKey}`);

                // Merge data
                const target = cleanData[fullKey];
                const source = cleanData[key];
                if (!target.birthDate && source.birthDate) target.birthDate = source.birthDate;
                if (!target.image && source.image) target.image = source.image;

                // Skip adding 'key' to finalData, logic handled by 'fullKey' being present
                return;
            }
        }

        // If we didn't merge it away, add it
        finalData[key] = cleanData[key];
    });

    // Re-add the full keys (since we iterated and maybe missed updating the 'fullKey' in finalData if it came before the abbrev)
    // Actually, pure iteration is unsafe for One-Pass merging.
    // Better: Two passes. 
    // Pass 1: Identification of merges.
    // Pass 2: Construction.

    // Revised logic:
    // Just keep the cleaned strict duplicate merge for now.
    // The user specifically mentioned "doublons" (duplicates).
    // The grep showed "Leonardo Balerdi", "Balerdi L.", "balerdi l".
    // "balerdi l" will be merged into "Balerdi L." by step 2.
    // "Balerdi L." vs "Leonardo Balerdi" is the tricky one.

    // Let's refine Step 2 to also handle the "Lastname I." merge if we find a robust match.

    const keys2 = Object.keys(cleanData);
    const toRemove = new Set();

    keys2.forEach(shortKey => {
        const parts = shortKey.split(' ');
        if (parts.length === 2 && parts[1].length === 2 && parts[1].endsWith('.')) {
            // It's "Lastname I." (e.g. "Silva B.")
            const lastname = parts[0];
            const initial = parts[1].charAt(0).toLowerCase();
            // Find "Firstname Lastname" where Firstname starts with initial
            const match = keys2.find(k => {
                if (k === shortKey || k.length <= shortKey.length) return false;
                const kParts = k.split(' ');
                const kLastName = kParts[kParts.length - 1];
                const kFirstName = kParts[0];
                return kLastName.toLowerCase() === lastname.toLowerCase() && kFirstName.toLowerCase().startsWith(initial);
            });
            if (match) {
                console.log(`Detected duplicate: ${shortKey} -> ${match}`);
                // Merge data into the long key
                const src = cleanData[shortKey];
                const dest = cleanData[match];

                if (!dest.birthDate && src.birthDate) dest.birthDate = src.birthDate;
                if ((!dest.main || dest.error) && src.main && !src.error) {
                    dest.main = src.main;
                    dest.other = src.other;
                }
                if (!dest.image && src.image) dest.image = src.image;

                toRemove.add(shortKey);
            }
        }
    });

    const finalCleanData = {};
    for (const k in cleanData) {
        if (!toRemove.has(k)) {
            finalCleanData[k] = cleanData[k];
        }
    }

    console.log(`Initial entries: ${entries.length}`);
    console.log(`Final entries: ${Object.keys(finalCleanData).length}`);

    fs.writeFileSync(DATA_FILE, JSON.stringify(finalCleanData, null, 2));
    console.log("Done.");
}

deduplicate();
