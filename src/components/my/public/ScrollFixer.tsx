// src/components/ScrollFixer.tsx
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ScrollFixer() {
  const pathname = usePathname();

  useEffect(() => {
    const checkScrollEnabled = () => {
      const html = document.documentElement;
      const body = document.body;

      const htmlOverflow = window.getComputedStyle(html).overflow;
      const bodyOverflow = window.getComputedStyle(body).overflow;

      if (htmlOverflow === 'hidden' || bodyOverflow === 'hidden') {
        html.style.overflow = 'auto';
        body.style.overflow = 'auto';
      }
    };

    // petit délai pour laisser le DOM se stabiliser
    setTimeout(checkScrollEnabled, 100);
  }, [pathname]); // se déclenche à chaque changement de page

  return null;
}
