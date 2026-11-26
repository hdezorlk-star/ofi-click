import React, { useState } from 'react';

interface UserAvatarProps {
  src?: string;
  name: string;
  sizeClass?: string;
  roundedClass?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  sizeClass = 'w-10 h-10',
  roundedClass = 'rounded-full',
}) => {
  const [failed, setFailed] = useState(false);

  const initials = (name || 'OC')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase() || 'OC';

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={`${sizeClass} ${roundedClass} object-cover shrink-0 border border-[#DBD4C6] dark:border-white/15 bg-[#F7F3EA]`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`${sizeClass} ${roundedClass} bg-[#214438] dark:bg-[#2E5D4C] text-[#FFFDFA] dark:text-[#FFFDFA] font-semibold text-xs flex items-center justify-center shrink-0 select-none border border-[#214438]/20 dark:border-white/15`}
    >
      {initials}
    </div>
  );
};
