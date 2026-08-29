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

export default function PlayerAvatar({
  name,
  clubName = '',
  photoUrl = null,
  size = 44,
  className = '',
  border = true,
  borderColor = 'var(--gold-border)'
}) {
  // Ignore broken legacy URLs from third-party CDNs
  const isValidPhotoUrl = photoUrl && 
    typeof photoUrl === 'string' && 
    !photoUrl.includes('images.fotmob.com') && 
    !photoUrl.includes('api-sports.io');

  const resolvedUrl = (isValidPhotoUrl ? photoUrl : null) || getPlayerPhoto(clubName, name) || defaultFallback;

  const [currentSrc, setCurrentSrc] = useState(resolvedUrl);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(resolvedUrl);
    setHasFailed(false);
  }, [name, clubName, photoUrl, resolvedUrl]);

  const handleError = () => {
    if (!hasFailed) {
      setHasFailed(true);
      // Try getPlayerPhoto fallback first if not already tried, otherwise UI initials avatar
      const fallback = getPlayerPhoto(clubName, name);
      if (fallback && fallback !== currentSrc) {
        setCurrentSrc(fallback);
      } else {
        setCurrentSrc(defaultFallback);
      }
    }
  };

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
    </div>
  );
}
