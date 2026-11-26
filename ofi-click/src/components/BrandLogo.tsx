import React from 'react';

export type BrandLogoVariant = 'horizontal' | 'compact' | 'mono' | 'icon';

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'horizontal',
  className = '',
  size = 'md',
}) => {
  const slotDims =
    size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-11 h-11' : 'w-8 h-8';
  const textSize =
    size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';
  const slotLabelSize = size === 'sm' ? 'text-[8px]' : size === 'lg' ? 'text-[10px]' : 'text-[9px]';

  const isMono = variant === 'mono';

  // Espacio neutro reservado para insertar el logotipo definitivo de OFI CLICK (SVG/PNG)
  const logoSlot = (
    <span
      data-logo-slot="ofi-click-official"
      title="Espacio reservado para el logo oficial de OFI CLICK"
      aria-hidden="true"
      className={`${slotDims} shrink-0 rounded-lg border border-dashed flex items-center justify-center font-mono-num font-bold tracking-tighter select-none transition-colors ${
        isMono
          ? 'border-current/40 bg-current/5 text-current'
          : 'border-[#B96F50]/75 bg-[#304B3E]/8 dark:bg-white/5 text-[#304B3E] dark:text-[#EAE3D6]'
      }`}
    >
      <span className={slotLabelSize}>LOGO</span>
    </span>
  );

  if (variant === 'icon') {
    return <span className={`inline-flex items-center ${className}`}>{logoSlot}</span>;
  }

  return (
    <span
      className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}
    >
      {logoSlot}
      <span
        className={`font-display font-bold tracking-tight ${textSize} text-[#252A27] dark:text-[#F5F1E8]`}
      >
        OFI CLICK
      </span>
    </span>
  );
};
