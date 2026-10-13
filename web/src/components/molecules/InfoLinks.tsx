// src/components/molecules/InfoLinks.tsx
// About · FAQ · Contact us · Terms · Privacy, under the sign-in forms, in Settings and on the info pages.

import React from 'react';
import { Link } from 'react-router-dom';
import { INFO_PAGES } from '../../content/infoPages';

const InfoLinks: React.FC<{ className?: string; current?: string }> = ({ className = '', current }) => (
  <nav aria-label="About ShareEven" className={`flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs ${className}`}>
    {INFO_PAGES.map((page) => (
      <Link key={page.slug} to={`/${page.slug}`} aria-current={current === page.slug ? 'page' : undefined}
        className={current === page.slug ? 'font-bold text-primary-700' : 'text-muted-500 hover:text-primary-700 hover:underline'}>
        {page.label}
      </Link>
    ))}
  </nav>
);

export default InfoLinks;
