/**
 * Utility function to extract or format match kickoff time.
 * Supports:
 * - kickoffUtc (ISO String e.g. "2026-08-15T17:30:00Z" -> "19:30")
 * - date / matchDate formatted with time (e.g. "25.01. 20:45", "2026-08-15 20:45", "20:45")
 * - kickoff attribute on match object
 */
export const formatMatchTime = (match) => {
  if (!match) return '';

  // 1. Explicit kickoffUtc (ISO 8601 string)
  const kickoffUtc = match.kickoffUtc || match.kickoff_utc;
  if (kickoffUtc) {
    try {
      const d = new Date(kickoffUtc);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }
    } catch (e) {
      // fallback
    }
  }

  // 2. Direct kickoff property (string like "20:45" or ISO)
  if (match.kickoff) {
    if (/^\d{1,2}:\d{2}$/.test(match.kickoff.trim())) {
      return match.kickoff.trim();
    }
    try {
      const d = new Date(match.kickoff);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }
    } catch (e) {
      // fallback
    }
  }

  // 3. Inspect date or matchDate fields
  const dateStr = match.date || match.matchDate;
  if (dateStr && typeof dateStr === 'string') {
    // Standard format with HH:MM (e.g. "25.01. 20:45" or "2026-08-15 20:45")
    const timeMatch = dateStr.match(/\b(\d{1,2}:\d{2})\b/);
    if (timeMatch) {
      return timeMatch[1];
    }
    // Check if full ISO string in dateStr
    if (dateStr.includes('T')) {
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        }
      } catch (e) {
        // fallback
      }
    }
  }

  // 4. Fallback default time for fixtures without explicit time
  return '20:45';
};
