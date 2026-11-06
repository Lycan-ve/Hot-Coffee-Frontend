'use client';

import Link from "next/link";
import "./hotcoffee-ui.css";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DiscordLogin } from "./DiscordLogin";
import { rankIconFallbackUrl, rankIconUrl, type RankInfo } from "@/lib/auth";

export const A = "/assets";

function Brand() {
  return (
    <Link href="/" className="brand">
      <div className="brand-mark">
        <img src={`${A}/5fb79.svg`} alt="" />
      </div>
      <div>
        <strong>HOT COFFEE</strong>
        <span>2XKO RANKING</span>
      </div>
    </Link>
  );
}

function Header() {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <Brand />
      <nav aria-label="Navegación principal">
        <Link href="/" className={`nav-item${pathname === "/" ? " active" : ""}`}>
          <small>01</small> Ranking
        </Link>
        <Link href="/perfil" className={`nav-item${pathname.startsWith("/perfil") ? " active" : ""}`}>
          <small>02</small> Mi perfil
        </Link>
        <Link href="/matchmaking" className={`nav-item${pathname.startsWith("/matchmaking") ? " active" : ""}`}>
          <small>03</small> Matchmaking
        </Link>
      </nav>
      <div className="top-actions">
        <span>Competitivo · Comunidad</span>
        <DiscordLogin />
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Header />
      {children}
      <footer>
        <span>Organizado por Baneado Sensei / Dev: Lycan</span>
        <strong>HECHO EN COMUNIDAD. JUGADO CON CARÁCTER.</strong>
        <span>Comunidad independiente · 2XKO de Riot Games</span>
        <a
          className="footer-link"
          href="https://discord.gg/8NbFuJcSCH"
          target="_blank"
          rel="noopener noreferrer"
        >
          Únete al Discord
        </a>
      </footer>
    </div>
  );
}

export function SectionTitle({ eyebrow, title, copy, note }: { eyebrow: string; title: string; copy: string; note?: string | undefined }) {
  return (
    <div className="section-title">
      <div className="eyebrow">
        <i /> {eyebrow} {note ? <span>— {note}</span> : null}
      </div>
      <h1>{title}</h1>
      <p>{copy}</p>
    </div>
  );
}

export function RankBadge({ small = false, rank }: { small?: boolean; rank?: RankInfo }) {
  return (
    <div className={`rank-badge ${small ? "small" : ""}`}>
      <span className="rank-glow" />
      {rank ? (
        <img
          src={rankIconUrl(rank.iconPath)}
          alt={`Insignia de rango ${rank.displayName}`}
          onError={(e) => {
            const fb = rankIconFallbackUrl(rank.iconPath);
            if (e.currentTarget.src !== fb) e.currentTarget.src = fb;
          }}
        />
      ) : (
        <img src={`${A}/34087.png`} alt="Insignia de rango" />
      )}
    </div>
  );
}

export function PageNotice({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <section className="panel hc-notice">
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </section>
  );
}

export function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className="stat-card">
      <span className={`stat-icon ${tone ?? ""}`}>◆</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </div>
  );
}
