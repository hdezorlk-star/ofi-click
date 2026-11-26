import React from 'react';
import officialLogo from '../assets/ofi-click-logo.jpg';

export type BrandLogoVariant = 'horizontal' | 'compact' | 'mono' | 'icon';

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'horizontal',
  className = '',
  size = 'md',
}) => {
  const slotDims =
    size === 'sm'
      ? 'w-9 h-9 rounded-lg'
      : size === 'lg'
      ? 'w-14 h-14 rounded-xl'
      : size === 'xl'
      ? 'w-20 h-20 rounded-2xl'
      : 'w-11 h-11 rounded-xl';

  const textSize =
    size === 'sm'
      ? 'text-base'
      : size === 'lg'
      ? 'text-2xl'
      : size === 'xl'
      ? 'text-2xl'
      : 'text-lg';

  const logoMark = (
    <span
      data-logo="ofi-click-official"
      className={`${slotDims} aspect-square shrink-0 bg-[#1D252C] overflow-hidden inline-flex items-center justify-center ring-1 ring-[#2C3640]/25 dark:ring-white/15 shadow-xs`}
    >
      <img
        src={officialLogo}
        alt={variant === 'icon' ? 'OFI CLICK — Portafolio de oficios' : ''}
        aria-hidden={variant !== 'icon'}
        className="w-full h-full object-contain block select-none"
      />
    </span>
  );

  if (variant === 'icon') {
    return (
      <span className={`inline-flex items-center shrink-0 ${className}`}>
        {logoMark}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}
    >
      {logoMark}
      <span
        className={`font-display font-bold tracking-tight ${textSize} text-[#1D252C] dark:text-[#F7F3EA]`}
      >
        OFI CLICK
      </span>
    </span>
  );
};
