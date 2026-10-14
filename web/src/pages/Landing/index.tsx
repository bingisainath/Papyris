// src/pages/Landing/index.tsx
// The public homepage (shareeven.com/) for people who aren't signed in: what ShareEven does, how it
// works, privacy, pricing and the FAQ. Signed-in people go straight to their chats.

import React, { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, CheckCircle2, Coins, Lock, MessageCircle, Receipt, ScanLine, ShieldCheck,
  Smartphone, Split, Users, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';
import { BrandMark } from '../../components/organisms/AuthLayout';
import InfoLinks from '../../components/molecules/InfoLinks';

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Lock, title: 'Private by design', text: 'Messages, photos, voice notes and files are end-to-end encrypted. Only your devices can read them, not us.' },
  { icon: Split, title: 'Split any way', text: 'Equally, by exact amounts, by shares, or item by item. Group trips, flatmates, couples, dinners.' },
  { icon: ScanLine, title: 'Scan the receipt', text: 'Photograph a bill and AI reads every item, discount and the total. You just tap who had what.' },
  { icon: Coins, title: 'Any currency', text: 'Each expense keeps the currency it was paid in. See balances per currency, or converted at today\'s rate.' },
  { icon: Wallet, title: 'Settle up in a tap', text: 'Pay buttons open UPI, Revolut or PayPal with the amount filled in. ShareEven never holds your money.' },
  { icon: Users, title: 'Chat and money together', text: 'Expenses live inside the chat they belong to, so "who paid for the taxi?" is answered right there.' },
];

const STEPS = [
  { title: 'Start a chat or a group', text: 'Invite the people you share costs with: your flat, your trip, your partner.' },
  { title: 'Add expenses as they happen', text: 'Type an amount or scan the receipt. Everyone sees the same balances instantly.' },
  { title: 'Settle up', text: 'ShareEven works out the fewest payments. Pay through your usual app and mark it done.' },
];

const FAQ_PREVIEW = [
  { q: 'Can ShareEven read my messages?', a: 'No. They are end-to-end encrypted: only the devices you and the people in the chat have linked can open them.' },
  { q: 'Does ShareEven move money?', a: 'No. It keeps track of who owes whom; you pay each other with the apps you already use.' },
  { q: 'Is it free?', a: 'Chats, groups and expenses are free. Receipt scanning includes a free monthly allowance.' },
];

const Landing: React.FC = () => {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    document.title = 'ShareEven: chat privately, split fairly';
    return () => { document.title = 'ShareEven'; };
  }, []);

  if (isLoading) return <div className="min-h-screen bg-white" />;
  if (user) return <Navigate to="/chat" replace />;

  return (
    <div className="min-h-screen bg-white text-muted-900">
      {/* ---------------------------------------------------------------- header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-muted-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" aria-label="ShareEven home"><BrandMark /></Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-muted-600" aria-label="Sections">
            <a href="#features" className="hover:text-primary-700">Features</a>
            <a href="#how" className="hover:text-primary-700">How it works</a>
            <a href="#privacy" className="hover:text-primary-700">Privacy</a>
            <a href="#pricing" className="hover:text-primary-700">Pricing</a>
            <Link to="/faq" className="hover:text-primary-700">FAQ</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="h-10 px-3 sm:px-4 inline-flex items-center rounded-[11px] text-sm font-bold text-primary-700 hover:bg-primary-50">Log in</Link>
            <Link to="/signup" className="h-10 px-3 sm:px-4 inline-flex items-center gap-1.5 rounded-[11px] text-sm font-bold text-white bg-primary-700 hover:bg-primary-800">
              Get started <ArrowRight size={16} className="hidden sm:block" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---------------------------------------------------------------- hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#433263] to-[#624b8a] text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24 grid md:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            <div>
              <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-primary-100">
                <ShieldCheck size={14} /> End-to-end encrypted
              </p>
              <h1 className="mt-5 font-display text-[clamp(40px,6vw,68px)] leading-[1.04] tracking-[-0.045em] font-semibold">
                Chat privately.<br />Split fairly.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-primary-100">
                One app for your conversations and your shared money. Talk with your flat, your trip or your partner,
                add expenses as they happen, and settle up without the awkward maths.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/signup" className="h-12 px-6 inline-flex items-center gap-2 rounded-xl bg-white text-primary-800 font-bold shadow-[0_8px_24px_rgba(20,10,40,0.25)] hover:bg-primary-50">
                  Create a free account <ArrowRight size={18} />
                </Link>
                <Link to="/login" className="h-12 px-6 inline-flex items-center rounded-xl border border-white/30 text-white font-bold hover:bg-white/10">
                  Log in
                </Link>
              </div>
              <p className="mt-5 flex items-center gap-2 text-sm text-primary-100">
                <Smartphone size={16} /> Works in your browser and on Android. iPhone app coming later.
              </p>
            </div>
            <HeroVisual />
          </div>
        </section>

        {/* ---------------------------------------------------------------- features */}
        <section id="features" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <SectionHeading eyebrow="Features" title="Everything a shared life needs" text="Built for the money conversations friends actually have." />
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card p-6">
                <span className="w-11 h-11 rounded-xl bg-primary-50 text-primary-700 grid place-items-center"><Icon size={22} strokeWidth={1.8} /></span>
                <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-600">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- how it works */}
        <section id="how" className="scroll-mt-20 bg-muted-50 border-y border-muted-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
            <SectionHeading eyebrow="How it works" title="From dinner to settled in three steps" />
            <ol className="mt-12 grid md:grid-cols-3 gap-5">
              {STEPS.map((step, i) => (
                <li key={step.title} className="card p-6">
                  <span className="w-9 h-9 rounded-full bg-primary-700 text-white font-display font-bold grid place-items-center">{i + 1}</span>
                  <h3 className="mt-4 font-display text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-600">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------------------- privacy */}
        <section id="privacy" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <SectionHeading eyebrow="Privacy" title="We can't read your chats. That's the point." align="left" />
            <ul className="mt-8 space-y-4">
              {[
                'Messages and media are encrypted on your device; our servers only pass on locked copies.',
                'No ads, no selling your data, no tracking you across other apps.',
                'Download everything we hold about you, or delete your account, any time from Settings.',
                'Block and report anyone. Reports go to a real person.',
              ].map((line) => (
                <li key={line} className="flex gap-3 text-muted-700">
                  <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0 text-primary-700" /> <span>{line}</span>
                </li>
              ))}
            </ul>
            <Link to="/privacy" className="mt-8 inline-flex items-center gap-1.5 text-sm font-bold text-primary-700 hover:underline">
              Read the privacy policy <ArrowRight size={16} />
            </Link>
          </div>
          <div className="card p-8 bg-gradient-to-br from-primary-50 to-white">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-primary-700 text-white grid place-items-center"><Lock size={24} /></span>
              <div>
                <p className="font-display font-semibold">End-to-end encrypted</p>
                <p className="text-sm text-muted-500">Only the devices you link can read your chats</p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <MockBubble side="left" text="Dinner was €84, I'll add it" />
              <MockBubble side="right" text="Thanks! Splitting 4 ways?" />
              <div className="flex items-center gap-2 text-xs text-muted-500"><Lock size={12} /> What the server sees: <code className="px-1.5 py-0.5 rounded bg-muted-100 text-muted-600">x7Gq…9fKw</code></div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- pricing */}
        <section id="pricing" className="scroll-mt-20 bg-muted-50 border-y border-muted-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
            <SectionHeading eyebrow="Pricing" title="Free for everyday use" text="Pay only if you scan a lot of receipts." />
            <div className="mt-12 grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
              <PlanCard
                name="Free" price="€0" note="forever"
                points={['Unlimited chats and groups', 'Unlimited expenses and balances', 'Multi-currency and settle-up links', 'A monthly allowance of AI receipt scans']}
                cta={<Link to="/signup" className="h-11 w-full inline-flex items-center justify-center rounded-xl bg-primary-700 text-white font-bold hover:bg-primary-800">Create a free account</Link>}
              />
              <PlanCard
                name="ShareEven Plus" price="Coming soon" note="" highlight
                points={['Everything in Free', 'Many more receipt scans every month', 'Support the people building ShareEven']}
                cta={<span className="h-11 w-full inline-flex items-center justify-center rounded-xl border border-primary-200 text-primary-700 font-bold">Available later this year</span>}
              />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- FAQ preview */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
          <SectionHeading eyebrow="Questions" title="Good to know" />
          <div className="mt-10 divide-y divide-muted-100 border-y border-muted-100">
            {FAQ_PREVIEW.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display font-semibold">
                  {item.q}
                  <span className="text-primary-700 transition-transform group-open:rotate-45 text-2xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-muted-600 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-center">
            <Link to="/faq" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-700 hover:underline">All questions <ArrowRight size={16} /></Link>
          </p>
        </section>

        {/* ---------------------------------------------------------------- final call to action */}
        <section className="px-4 sm:px-6 pb-20">
          <div className="max-w-6xl mx-auto rounded-[28px] bg-gradient-to-br from-[#433263] to-[#624b8a] text-white px-6 py-14 text-center">
            <h2 className="font-display text-[clamp(28px,4vw,44px)] font-semibold tracking-[-0.03em]">Ready to stop doing the maths?</h2>
            <p className="mt-3 text-primary-100">Create your account in a minute. Your friends can join with theirs.</p>
            <Link to="/signup" className="mt-8 h-12 px-6 inline-flex items-center gap-2 rounded-xl bg-white text-primary-800 font-bold hover:bg-primary-50">
              Get started free <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-muted-100 py-8">
        <InfoLinks />
        <p className="mt-3 text-center text-xs text-muted-400">© {new Date().getFullYear()} ShareEven</p>
      </footer>
    </div>
  );
};

const SectionHeading: React.FC<{ eyebrow: string; title: string; text?: string; align?: 'center' | 'left' }> = ({ eyebrow, title, text, align = 'center' }) => (
  <div className={align === 'center' ? 'text-center max-w-2xl mx-auto' : ''}>
    <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-500">{eyebrow}</p>
    <h2 className="mt-2 font-display text-[clamp(28px,4vw,40px)] leading-tight font-semibold tracking-[-0.03em]">{title}</h2>
    {text && <p className="mt-3 text-lg text-muted-500">{text}</p>}
  </div>
);

const PlanCard: React.FC<{ name: string; price: string; note: string; points: string[]; cta: React.ReactNode; highlight?: boolean }> = ({ name, price, note, points, cta, highlight }) => (
  <div className={`card p-7 flex flex-col ${highlight ? 'border-primary-300 ring-4 ring-primary-50' : ''}`}>
    <p className="font-display font-semibold text-muted-700">{name}</p>
    <p className="mt-2"><span className="font-display text-4xl font-semibold tracking-tight">{price}</span>{note && <span className="ml-2 text-muted-500">{note}</span>}</p>
    <ul className="mt-6 mb-8 space-y-3 flex-1">
      {points.map((p) => (
        <li key={p} className="flex gap-2.5 text-sm text-muted-700"><BadgeCheck size={18} className="flex-shrink-0 text-primary-700" /> {p}</li>
      ))}
    </ul>
    {cta}
  </div>
);

const MockBubble: React.FC<{ side: 'left' | 'right'; text: string }> = ({ side, text }) => (
  <div className={`flex ${side === 'right' ? 'justify-end' : ''}`}>
    <p className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${side === 'right' ? 'bg-primary-700 text-white rounded-br-md' : 'bg-white border border-muted-200 rounded-bl-md'}`}>{text}</p>
  </div>
);

/** A phone-shaped preview of a group chat with an expense and a scanned receipt (drawn, not a screenshot). */
const HeroVisual: React.FC = () => (
  <div className="relative mx-auto w-full max-w-[340px]" aria-hidden>
    <div className="rounded-[36px] bg-white p-3 shadow-[0_30px_60px_rgba(20,10,40,0.35)]">
      <div className="rounded-[28px] bg-[#f7f6fa] overflow-hidden text-muted-900">
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-muted-100">
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7964a6] to-[#4b376e] text-white text-sm font-bold grid place-items-center">G</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Weekend in Galway</p>
            <p className="text-[11px] text-muted-500 flex items-center gap-1"><Lock size={10} /> 4 members</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <MockBubble side="left" text="Who paid for the B&B?" />
          <MockBubble side="right" text="Me! Adding it now" />
          <div className="rounded-2xl bg-white border border-muted-200 p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 grid place-items-center"><Receipt size={16} /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">B&B, 2 nights</p>
                <p className="text-[11px] text-muted-500">Split 4 ways</p>
              </div>
              <p className="text-sm font-bold">€240</p>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-muted-100 overflow-hidden"><div className="h-full w-3/4 bg-primary-600 rounded-full" /></div>
            <p className="mt-1.5 text-[11px] text-muted-500">You're owed €180</p>
          </div>
          <div className="rounded-2xl bg-white border border-muted-200 p-3.5 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-success-50 text-success-700 grid place-items-center"><ScanLine size={16} /></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Receipt read</p>
              <p className="text-[11px] text-muted-500">14 items · total matches</p>
            </div>
            <CheckCircle2 size={18} className="text-success-600" />
          </div>
        </div>
        <div className="mx-4 mb-4 flex items-center gap-2 rounded-full bg-white border border-muted-200 px-4 py-2.5 text-xs text-muted-400">
          <MessageCircle size={14} /> Message
        </div>
      </div>
    </div>
  </div>
);

export default Landing;
