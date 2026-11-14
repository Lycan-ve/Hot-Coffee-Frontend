'use client';

// Utilidades compartidas por los overlays de OBS: ajuste automático para
// que nada se corte ni se salga de su sitio.
//
// - FitText baja la letra hasta que el texto cabe (con un mínimo).
// - ChipRow turna las etiquetas en grupos (con animación) cuando no caben
//   todas en su hueco.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export const whenFontsReady = (fn: () => void) => {
  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  if (!fonts || fonts.status === "loaded") fn();
  else void fonts.ready.then(fn);
};

export function FitText({
  as = "div",
  className,
  min = 14,
  watch,
  children,
  ...rest
}: {
  as?: "div" | "strong" | "span";
  className?: string;
  min?: number;
  /** Valor que, al cambiar, vuelve a medir (por defecto el propio texto). */
  watch?: unknown;
  children: ReactNode;
  [data: `data-${string}`]: string | undefined;
}) {
  const ref = useRef<HTMLElement>(null);
  const key = watch ?? (typeof children === "string" || typeof children === "number" ? children : undefined);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const fit = () => {
      if (!alive) return;
      el.style.fontSize = "";
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth + 1 && size > min) {
        size = Math.max(min, size - 1);
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    whenFontsReady(fit);
    return () => {
      alive = false;
    };
  }, [key, min]);

  const Tag = as as "div";
  return (
    <Tag ref={ref as never} className={className} {...rest}>
      {children}
    </Tag>
  );
}

export type ChipData = { text: string; tone?: "ok" | "wait" | "fuse1" | "fuse2"; icon?: ReactNode };

type Layout = { sig: string; pages: number[][]; fs: Record<number, number> };

export function ChipRow({ className, chips, every = 4000 }: { className: string; chips: ChipData[]; every?: number }) {
  const sig = chips.map((c) => `${c.tone ?? ""}:${c.text}`).join("|");
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [page, setPage] = useState(0);
  const measuring = !layout || layout.sig !== sig;

  useIsoLayoutEffect(() => {
    if (!measuring) return;
    let alive = true;
    whenFontsReady(() => {
      const box = ref.current;
      if (!alive || !box) return;
      const cw = box.clientWidth;
      const gap = parseFloat(getComputedStyle(box).columnGap) || 0;
      const fs: Record<number, number> = {};
      const widths = [...box.children].map((node, i) => {
        const el = node as HTMLElement;
        const w = el.offsetWidth;
        if (w <= cw) return w;
        // Una sola etiqueta más ancha que el hueco: letra más pequeña.
        const base = parseFloat(getComputedStyle(el).fontSize);
        fs[i] = Math.max(14, Math.floor((base * cw) / w));
        return cw;
      });
      const pages: number[][] = [];
      let cur: number[] = [];
      let used = 0;
      widths.forEach((w, i) => {
        const need = cur.length ? used + gap + w : w;
        if (cur.length && need > cw) {
          pages.push(cur);
          cur = [i];
          used = w;
        } else {
          cur.push(i);
          used = need;
        }
      });
      if (cur.length) pages.push(cur);
      setLayout({ sig, pages, fs });
      setPage(0);
    });
    return () => {
      alive = false;
    };
  }, [sig, measuring]);

  const pageCount = layout && !measuring ? layout.pages.length : 1;
  useEffect(() => {
    if (pageCount < 2) return;
    const id = window.setInterval(() => setPage((n) => n + 1), every);
    return () => window.clearInterval(id);
  }, [pageCount, every]);

  const current = measuring || !layout ? chips.map((_, i) => i) : (layout.pages[page % pageCount] ?? []);
  const paged = !measuring && pageCount > 1;

  return (
    <div ref={ref} className={className} data-measuring={measuring ? "" : undefined}>
      {current.map((i, n) => {
        const c = chips[i];
        if (!c) return null;
        const style = { "--i": n, fontSize: !measuring ? layout?.fs[i] : undefined } as CSSProperties;
        return (
          <span
            key={paged ? `p${page % pageCount}:${i}:${c.text}` : `${i}:${c.tone ?? ""}:${c.text}`}
            className={`tsh-chip ${c.tone ? `tsh-chip-${c.tone}` : ""}`}
            style={style}
          >
            {c.icon}
            <span className="tsh-chip-txt">{c.text}</span>
          </span>
        );
      })}
    </div>
  );
}