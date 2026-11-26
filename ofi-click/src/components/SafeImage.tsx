import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel,
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F5F1E8] to-[#EAE3D6] dark:from-[#222825] dark:to-[#1C211E] text-[#73766F] dark:text-[#A3A89F] p-4 text-center ${className}`}
      >
        <ImageIcon className="w-6 h-6 opacity-60 mb-1.5" aria-hidden="true" />
        <span className="text-xs font-medium leading-tight max-w-[16ch] truncate">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
