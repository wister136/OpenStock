'use client';

import React, { ReactNode, useCallback } from 'react';

type ExternalOpenOverlayProps = {
  url: string;
  children: ReactNode;
  className?: string;
};

/**
 * Wrap an embedded widget (usually iframe) and make click open `url` in a new tab.
 * It keeps the current page unchanged.
 *
 * NOTE: This overlay blocks interactions inside the embedded widget.
 */
export default function ExternalOpenOverlay({
  url,
  children,
  className,
}: ExternalOpenOverlayProps) {
  const handleOpen = useCallback(() => {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // ignore
    }
  }, [url]);

  return (
    <div className={`relative ${className ?? ''}`}>
      {children}
      <div
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={handleOpen}
        aria-hidden="true"
      />
    </div>
  );
}
