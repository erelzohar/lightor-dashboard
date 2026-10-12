import React from 'react';

/** LT-253: Lighty's face where the dashboard puts an icon (the sidebar). */
const LightyIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <img src="/lighty-avatar.webp" alt="" aria-hidden="true" draggable={false} className={`${className} rounded-full object-contain scale-125`} />
);

export default LightyIcon;
