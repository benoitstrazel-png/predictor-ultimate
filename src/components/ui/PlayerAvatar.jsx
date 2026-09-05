/**
 * src/components/ui/PlayerAvatar.jsx
 * ─────────────────────────────────────────────────────────────
 * Composant universel d'avatar joueur assurant :
 * 1. Gestion des erreurs HTTP (404/403/CORS) avec fallback automatique
 * 2. Zéro affichage de bulle noire ou masquage intempestif
 * 3. Réactivité instantanée lors du changement de joueur
 */

import React, { useState, useEffect } from 'react';
import { getPlayerPhoto } from '../../utils/playerPhotos';

const DEFAULT_AVATAR = '/assets/players/defaults/m_default.webp';

export default function PlayerAvatar({
  name,
  clubName = '',
  photoUrl = null,
  role = 'M',
  size = 44,
  className = '',
  border = true,
  borderColor = 'var(--gold-border)'
}) {
  const roleCode = String(role || 'M').charAt(0).toLowerCase();
  const roleFallback = ['g', 'd', 'm', 'a'].includes(roleCode) 
    ? `/assets/players/defaults/${roleCode}_default.webp` 
    : DEFAULT_AVATAR;

  // Filtrer les URLs externes réputées fragiles ou soumises à CORS/403
  const isValidPhotoUrl = photoUrl && 
    typeof photoUrl === 'string' && 
    photoUrl.trim().length > 0 &&
    !photoUrl.includes('images.fotmob.com') && 
    !photoUrl.includes('api-sports.io');

  const initialSrc = (isValidPhotoUrl ? photoUrl : null) || getPlayerPhoto(clubName, name) || roleFallback;

  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [useInitials, setUseInitials] = useState(false);

  useEffect(() => {
    setCurrentSrc(initialSrc);
    setUseInitials(false);
  }, [name, clubName, photoUrl, initialSrc]);

  const handleError = () => {
    if (currentSrc !== roleFallback && currentSrc !== DEFAULT_AVATAR) {
      setCurrentSrc(roleFallback);
    } else {
      setUseInitials(true);
    }
  };

  const initials = name
    ? name
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .map(w => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'J';

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        border: border ? `1px solid ${borderColor}` : 'none',
        background: 'var(--obsidian-3, #0d1220)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      title={name}
    >
      {useInitials ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(20,20,20,0.8) 100%)',
            color: 'var(--gold, #d4af37)',
            fontWeight: 700,
            fontSize: `${Math.round(size * 0.4)}px`,
            fontFamily: 'var(--font-ui, -apple-system, sans-serif)',
            userSelect: 'none',
          }}
        >
          {initials}
        </div>
      ) : (
        <img
          src={currentSrc}
          alt={name || 'Player'}
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top center',
          }}
          onError={handleError}
        />
      )}
    </div>
  );
}
