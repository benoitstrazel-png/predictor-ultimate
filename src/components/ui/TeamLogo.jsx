import React, { useState, useEffect } from 'react';
import { getTeamLogo } from '../../utils/logos';

const TeamLogo = ({ teamName, size = 'md', className = '' }) => {
  const logoUrl = getTeamLogo(teamName);
  const [hasError, setHasError] = useState(false);

  // Réinitialise l'état d'erreur dès que l'équipe ou l'URL change
  useEffect(() => {
    setHasError(false);
  }, [teamName, logoUrl]);

  const pixelSize = {
    xs: 20,
    sm: 26,
    md: 38,
    lg: 56,
    xl: 84
  };

  const s = pixelSize[size] || 38;
  const initials = teamName ? teamName.substring(0, 2).toUpperCase() : 'FC';

  if (hasError || !logoUrl) {
    return (
      <div
        className={`flex items-center justify-center shrink-0 ${className}`}
        style={{
          width: `${s}px`,
          height: `${s}px`,
          minWidth: `${s}px`,
          minHeight: `${s}px`,
          borderRadius: `${Math.max(6, s * 0.25)}px`,
          background: 'linear-gradient(135deg, rgba(201, 169, 110, 0.25), rgba(139, 106, 60, 0.15))',
          border: '1px solid var(--gold-border)',
          color: 'var(--gold)',
          fontWeight: 800,
          fontSize: `${s * 0.40}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-ui)',
          userSelect: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
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
        src={logoUrl}
        alt={teamName}
        loading="lazy"
        crossOrigin="anonymous"
        style={{
          width: `${s}px`,
          height: `${s}px`,
          objectFit: 'contain',
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))',
        }}
        onError={() => setHasError(true)}
      />
    </div>
  );
};

export default TeamLogo;
