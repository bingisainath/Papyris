// src/pages/Info/index.tsx
// The public pages: /about, /faq, /contact, /terms and /privacy (content in src/content/infoPages.ts).
// Readable without signing in; the Android app opens these too.

import React, { useEffect } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BrandMark } from '../../components/organisms/AuthLayout';
import InfoLinks from '../../components/molecules/InfoLinks';
import { LAST_UPDATED, infoPage } from '../../content/infoPages';
import type { Block } from '../../content/infoPages';

const EMAIL = /([\w.+-]+@[\w-]+\.[\w.]+)/g;

/** Text with email addresses as mailto links. */
const Linked: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(EMAIL).map((part, i) => (i % 2 === 1
      ? <a key={i} href={`mailto:${part}`} className="font-semibold text-primary-700 hover:underline">{part}</a>
      : <React.Fragment key={i}>{part}</React.Fragment>))}
  </>
);

const BlockView: React.FC<{ block: Block }> = ({ block }) => (Array.isArray(block)
  ? <ul className="list-disc pl-5 space-y-1.5">{block.map((item) => <li key={item}><Linked text={item} /></li>)}</ul>
  : <p><Linked text={block} /></p>);

const InfoPageView: React.FC = () => {
  const slug = useLocation().pathname.replace(/^\/+|\/+$/g, '');
  const page = infoPage(slug);

  useEffect(() => {
    if (page) document.title = `${page.title} · ShareEven`;
    window.scrollTo(0, 0);
    return () => { document.title = 'ShareEven'; };
  }, [page]);

  if (!page) return <Navigate to="/about" replace />;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-muted-100">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <Link to="/" aria-label="ShareEven home"><BrandMark /></Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-700 hover:underline">
            <ArrowLeft size={16} /> Open ShareEven
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="font-display text-[clamp(28px,5vw,40px)] font-semibold tracking-[-0.03em] text-muted-900">{page.title}</h1>
        {page.dated && <p className="mt-2 text-sm text-muted-500">Last updated {LAST_UPDATED}</p>}
        {page.intro && <p className="mt-4 text-lg leading-relaxed text-muted-700"><Linked text={page.intro} /></p>}

        <div className="mt-8 space-y-8">
          {page.sections.map((section, i) => (
            <section key={section.heading || i}>
              {section.heading && <h2 className="mb-2.5 text-lg font-semibold text-muted-900">{section.heading}</h2>}
              <div className="space-y-3 leading-relaxed text-muted-700">
                {section.body.map((block, j) => <BlockView key={j} block={block} />)}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-muted-100 py-6">
        <InfoLinks current={page.slug} />
        <p className="mt-3 text-center text-xs text-muted-400">© {new Date().getFullYear()} ShareEven</p>
      </footer>
    </div>
  );
};

export default InfoPageView;
