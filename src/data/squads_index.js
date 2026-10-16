// Auto-generated Squads Manifest & Dynamic Loader
import manifest from './squads_manifest.json';
import { resolveTeam, normalizeEntityKey } from '../utils/entityResolver';

const squadModules = import.meta.glob('./squads/*.json', { eager: true });

export const SQUADS_MANIFEST = manifest;

export const getClubSquad = (clubNameOrSlug, season = '2026-2027') => {
  if (!clubNameOrSlug) return null;
  const cleanName = String(clubNameOrSlug).trim().toLowerCase();
  const normInput = normalizeEntityKey(clubNameOrSlug);
  const resolved = resolveTeam(clubNameOrSlug);
  const resolvedSlug = resolved?.slug?.toLowerCase();
  const resolvedCanonical = resolved?.canonical_name ? normalizeEntityKey(resolved.canonical_name) : '';
  const resolvedShort = resolved?.short_name ? normalizeEntityKey(resolved.short_name) : '';

  // 1. Exact or canonical match in manifest
  let clubMeta = manifest.clubs.find(c => {
    const cSlug = c.slug.toLowerCase();
    const cName = normalizeEntityKey(c.club_name);
    return (
      cSlug === cleanName ||
      cName === normInput ||
      (resolvedSlug && cSlug === resolvedSlug) ||
      (resolvedCanonical && (cName === resolvedCanonical || cSlug === resolvedCanonical.replace(/\s+/g, '-'))) ||
      (resolvedShort && (cName === resolvedShort || cSlug === resolvedShort.replace(/\s+/g, '-')))
    );
  });

  // 2. Safe fallback substring match (only for tokens >= 4 chars)
  if (!clubMeta && normInput.length >= 4) {
    clubMeta = manifest.clubs.find(c => {
      const cSlug = c.slug.toLowerCase();
      const cName = normalizeEntityKey(c.club_name);
      return cName.includes(normInput) || normInput.includes(cName) || cSlug.includes(cleanName);
    });
  }

  const slug = clubMeta ? clubMeta.slug : (resolvedSlug || cleanName.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  const key = `./squads/${slug}.json`;
  const clubData = squadModules[key]?.default || squadModules[key];
  if (!clubData) return null;
  if (!season || season === 'ALL') return clubData;
  return {
    ...clubData,
    players: clubData.seasons?.[season] || []
  };
};

export default SQUADS_MANIFEST;
