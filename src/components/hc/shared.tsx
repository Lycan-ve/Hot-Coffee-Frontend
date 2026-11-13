'use client';

import Link from "next/link";
import "./hotcoffee-ui.css";
import "../../hotcoffee-mobile.css";
import "../../hotcoffee-flags.css";
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
          <small>01</small> Inicio
        </Link>
        <Link href="/matchmaking" className={`nav-item${pathname.startsWith("/matchmaking") ? " active" : ""}`}>
          <small>02</small> Matchmaking
        </Link>
        <Link href="/perfil" className={`nav-item${pathname.startsWith("/perfil") ? " active" : ""}`}>
          <small>03</small> Mi perfil
        </Link>
        <Link href="/ranking" className={`nav-item${pathname === "/ranking" ? " active" : ""}`}>
          <small>04</small> Ranking
        </Link>
        <Link href="/ranking-matchmaking" className={`nav-item${pathname.startsWith("/ranking-matchmaking") ? " active" : ""}`}>
          <small>05</small> Ranking MM
        </Link>
      </nav>
      <div className="top-actions">
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
      </footer>
    </div>
  );
}

export function SectionTitle({ eyebrow, title, accent, copy, note }: { eyebrow: string; title: string; accent?: string; copy: string; note?: string | undefined }) {
  return (
    <div className="section-title">
      <div className="eyebrow">
        <i /> {eyebrow} {note ? <span>— {note}</span> : null}
      </div>
      <h1>
        {title} {accent ? <em>{accent}</em> : null}
      </h1>
      <p>{copy}</p>
    </div>
  );
}

export function RankBadge({ small = false, rank }: { small?: boolean; rank?: RankInfo }) {
  return (
    <div className={`rank-badge ${small ? "small" : ""}`}>
      <span className="rank-glow" />
      {/* Sin rango (clasificación incompleta) el backend no manda iconPath:
          se muestra la insignia genérica y nunca la de una división. */}
      {rank && rank.iconPath ? (
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

/** Bandera emoji de un código ISO 3166-1 alpha-2 (vacío o inválido → null). */
export function flagEmoji(cc?: string): string | null {
  if (!cc) return null;
  const code = cc.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return String.fromCodePoint(...[...code].map((ch) => 127397 + ch.charCodeAt(0)));
}

/** Bandera (imagen) de nacionalidad: país ISO 3166-1 alpha-2 y, opcionalmente,
 *  estado/provincia (ISO 3166-2) con las imágenes de /public/Nacionalidad y
 *  /public/Estados. Código inválido o vacío → no renderiza nada. */
export function PlayerFlag({ country, state, className }: { country?: string; state?: string; className?: string }) {
  const cc = (country ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  const st = (state ?? "").trim().toUpperCase();
  const hasState = /^[A-Z0-9]{1,3}$/.test(st);
  return (
    <span className={`player-flag${className ? ` ${className}` : ""}`}>
      <img src={`/Nacionalidad/${cc.toLowerCase()}.png`} alt={cc} title={cc} loading="lazy" />
      {hasState ? (
        <img className="player-flag-state" src={`/Estados/${cc}/${st}.png`} alt={st} title={st} loading="lazy" />
      ) : null}
    </span>
  );
}
