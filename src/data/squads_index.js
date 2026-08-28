// Auto-generated Squads Manifest & Dynamic Loader
import manifest from './squads_manifest.json';

const squadModules = import.meta.glob('./squads/*.json', { eager: true });

export const SQUADS_MANIFEST = manifest;

export const getClubSquad = (clubNameOrSlug, season = '2026-2027') => {
  if (!clubNameOrSlug) return null;
  const cleanName = String(clubNameOrSlug).trim().toLowerCase();
  
  // Search manifest
  const clubMeta = manifest.clubs.find(c =>
    c.club_name.toLowerCase() === cleanName ||
    c.slug.toLowerCase() === cleanName ||
    cleanName.includes(c.slug.toLowerCase()) ||
    c.slug.toLowerCase().includes(cleanName)
  );

  const slug = clubMeta ? clubMeta.slug : cleanName.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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
