import React, { useState, useEffect } from 'react';
import { getTeamLogo, getTeamColors } from '../../utils/logos';

const TeamLogo = ({ teamName, size = 'md', className = '', priority = false }) => {
  const resolvedLogo = getTeamLogo(teamName);
  const colors = getTeamColors(teamName);
  
  const [currentSrc, setCurrentSrc] = useState(resolvedLogo);
  const [hasError, setHasError] = useState(!resolvedLogo);

  // Réinitialise dès que l'équipe ou le logo résolu change
  useEffect(() => {
    setCurrentSrc(resolvedLogo);
    setHasError(!resolvedLogo);
  }, [teamName, resolvedLogo]);

  const pixelSize = {
    xs: 20,
    sm: 26,
    md: 38,
    lg: 56,
    xl: 84,
    '2xl': 120
  };

  const s = pixelSize[size] || 38;
  const initials = teamName
    ? teamName
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .substring(0, 3)
        .toUpperCase()
    : 'FC';

  const handleImageError = () => {
    if (!currentSrc) {
      setHasError(true);
      return;
    }
    
    // Cascade de secours douce : .svg -> .webp -> .png -> initiales
    if (currentSrc.endsWith('.svg')) {
      setCurrentSrc(currentSrc.replace(/\.svg$/, '.webp'));
    } else if (currentSrc.endsWith('.webp')) {
      setCurrentSrc(currentSrc.replace(/\.webp$/, '.png'));
    } else {
      setHasError(true);
    }
  };

  if (hasError || !currentSrc) {
    return (
      <div
        className={`flex items-center justify-center shrink-0 ${className}`}
        style={{
          width: `${s}px`,
          height: `${s}px`,
          minWidth: `${s}px`,
          minHeight: `${s}px`,
          borderRadius: `${Math.max(6, s * 0.25)}px`,
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: '#FFFFFF',
          fontWeight: 800,
          fontSize: `${s * 0.38}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-ui, -apple-system, sans-serif)',
          userSelect: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          textShadow: '0 1px 3px rgba(0,0,0,0.7)',
        }}
        title={teamName}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center shrink-0 ${className}`}
      style={{
        width: `${s + 4}px`,
        height: `${s + 4}px`,
        minWidth: `${s + 4}px`,
        minHeight: `${s + 4}px`,
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: `${Math.max(8, s * 0.25)}px`,
        padding: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      title={teamName}
    >
      <img
        src={currentSrc}
        alt={teamName}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        style={{
          width: `${s}px`,
          height: `${s}px`,
          objectFit: 'contain',
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))',
        }}
        onError={handleImageError}
      />
    </div>
  );
};

export default TeamLogo;
