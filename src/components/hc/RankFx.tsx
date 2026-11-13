'use client';

import "./rank-fx.css";
import type { CSSProperties } from "react";

/**
 * Auras animadas por rango (Iron → Challenger).
 * Cada nivel suma capas sobre el anterior: más brillo, más velocidad, más partículas.
 * Todo es CSS puro (ver rank-fx.css); este componente solo pinta las capas.
 */
export const RANK_ORDER = [
  "iron",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "emerald",
  "diamond",
  "master",
  "grandmaster",
  "challenger",
] as const;

export type RankKey = (typeof RANK_ORDER)[number];

type RankLike = { rank?: string; displayName?: string } | string | null | undefined;

/** "Gold II", { rank: "Gold" }, "GRANDMASTER" → "gold" / "grandmaster". */
export function rankKey(rank: RankLike): RankKey | null {
  const raw = typeof rank === "string" ? rank : rank?.rank || rank?.displayName || "";
  const first = raw.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return (RANK_ORDER as readonly string[]).includes(first) ? (first as RankKey) : null;
}

/** 0 = Iron … 9 = Challenger. */
export function rankLevel(key: RankKey): number {
  return RANK_ORDER.indexOf(key);
}

// Cuántas partículas / destellos lleva cada nivel (índice = nivel).
const PARTICLES = [0, 0, 0, 3, 5, 8, 10, 13, 16, 22];
const STARS = [0, 0, 0, 0, 2, 3, 5, 6, 7, 9];
const EMBERS = [0, 0, 0, 0, 0, 6, 8, 12, 18, 26];

// Pseudo-aleatorio determinista (entero, sin Math.sin): idéntico en servidor y cliente,
// así no hay "hydration mismatch" en SSR.
const rnd = (i: number, seed: number) => {
  let h = (i * 374761393 + seed * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) % 1000) / 1000;
};

const vars = (v: Record<string, string>) => v as CSSProperties;

function Particles({ count, seed, cls }: { count: number; seed: number; cls: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cls}
          style={vars({
            "--x": `${8 + rnd(i, seed) * 84}%`,
            "--y": `${10 + rnd(i, seed + 7) * 80}%`,
            "--s": `${2 + rnd(i, seed + 1) * 3}px`,
            "--d": `${1.6 + rnd(i, seed + 2) * 2.2}s`,
            "--delay": `-${rnd(i, seed + 3) * 4}s`,
            "--drift": `${(rnd(i, seed + 4) - 0.5) * 40}px`,
          })}
        />
      ))}
    </>
  );
}

type Props = {
  rank: RankLike;
  /**
   * badge: alrededor de la insignia grande (usar layer back + front).
   * mini: para el icono pequeño junto al nombre.
   * card: fondo/borde de una tarjeta de jugador completa.
   */
  variant?: "badge" | "mini" | "card";
  /** Solo para variant="badge": "back" va antes del <img>, "front" después. */
  layer?: "back" | "front";
};

export function RankFx({ rank, variant = "badge", layer = "back" }: Props) {
  const key = rankKey(rank);
  if (!key) return null;
  const lvl = rankLevel(key);

  if (variant === "mini") {
    return (
      <span className="rfx rfx--mini" data-rfx={key} aria-hidden="true">
        <span className="rfx-glow" />
        {lvl >= 3 && <span className="rfx-rays" />}
        {lvl >= 5 && <span className="rfx-orbit" />}
        {lvl >= 7 && <span className="rfx-flame" />}
      </span>
    );
  }

  if (variant === "card") {
    return (
      <span className="rfx rfx--card" data-rfx={key} data-lvl={lvl} aria-hidden="true">
        <span className="rfx-tint" />
        {lvl >= 2 && <span className="rfx-sweep" />}
        {lvl >= 4 && <span className="rfx-border" />}
        {lvl >= 6 && <span className="rfx-floor" />}
        <Particles count={EMBERS[lvl] ?? 0} seed={lvl * 3 + 11} cls="rfx-ember" />
        {lvl >= 9 && (
          <>
            <span className="rfx-beam" />
            <span className="rfx-bolt rfx-bolt--a" />
            <span className="rfx-bolt rfx-bolt--b" />
          </>
        )}
      </span>
    );
  }

  if (layer === "back") {
    return (
      <span className="rfx rfx--back" data-rfx={key} aria-hidden="true">
        <span className="rfx-glow" />
        {lvl >= 1 && <span className="rfx-ring" />}
        {lvl >= 6 && <span className="rfx-ring rfx-ring--2" />}
        {lvl >= 8 && <span className="rfx-ring rfx-ring--3" />}
        {lvl >= 3 && <span className="rfx-rays" />}
        {lvl >= 9 && <span className="rfx-rays rfx-rays--rev" />}
        {lvl >= 7 && <span className="rfx-flame" />}
        {lvl >= 4 && <span className="rfx-orbit" />}
        {lvl >= 5 && <span className="rfx-orbit rfx-orbit--2" />}
      </span>
    );
  }

  return (
    <span className="rfx rfx--front" data-rfx={key} aria-hidden="true">
      {lvl >= 2 && <span className="rfx-shine" />}
      <Particles count={PARTICLES[lvl] ?? 0} seed={lvl + 1} cls="rfx-p" />
      <Particles count={STARS[lvl] ?? 0} seed={lvl + 40} cls="rfx-star" />
      {lvl >= 9 && (
        <>
          <span className="rfx-crown" />
          <span className="rfx-bolt rfx-bolt--a" />
          <span className="rfx-bolt rfx-bolt--b" />
        </>
      )}
    </span>
  );
}
