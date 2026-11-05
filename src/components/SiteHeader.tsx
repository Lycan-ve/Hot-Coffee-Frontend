'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DiscordLoginButton from '@/components/DiscordLoginButton';

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: '/', label: 'Ranking' },
  { href: '/perfil', label: 'Mi perfil' },
  { href: '/matchmaking', label: 'Matchmaking' },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1e1610]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <img
            src="/logo-Hot.jpg"
            alt="Hot Coffee 2XKO"
            className="h-10 w-10 shrink-0 rounded-lg border border-[#d0ca53]/40 bg-[#191008] object-contain"
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="font-condensed text-lg font-bold uppercase tracking-[0.08em] text-white">
              Hot Coffee
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d0ca53]">
              2XKO · Ranking oficial
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={
                  'flex items-center whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] transition ' +
                  (active
                    ? 'bg-[#5865F2]/20 text-[#aab2ff]'
                    : 'text-white/55 hover:bg-white/5 hover:text-white')
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <DiscordLoginButton />
      </div>
    </header>
  );
}