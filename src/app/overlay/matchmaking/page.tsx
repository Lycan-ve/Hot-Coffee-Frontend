'use client';

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Coffee } from "lucide-react";
import {
  API_URL,
  fetchUserProfile,
  fuseIconUrl,
  rankIconFallbackUrl,
  rankIconUrl,
} from "@/lib/auth";
import "../../../hotcoffee-overlay.css";

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Overlay para OBS (browser source). Parámetros de la URL:
//   ?id=<discordId>   jugador a mostrar (obligatorio para OBS)
//   ?bg=dark          fondo sólido en vez de transparente (para probar fuera de OBS)
//   ?scale=1.25       zoom del overlay
//   ?flag=🇻🇪          emoji/texto de bandera junto al nombre
// Se actualiza solo cada 15 s: el stream nunca ve datos viejos.

function OverlayInner() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const bg = params.get("bg") ?? "transparent";
  const scale = Number(params.get("scale")) || 1;
  const flag = params.get("flag") ?? "";

  // Fondo transparente para el browser source de OBS. Se aplica inline (y se
  // restaura al salir) para no tocar el fondo del resto de la web.
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    return () => {
      document.documentElement.style.background = "";
      document.body.style.background = "";
    };
  }, []);

  const { data: p, isLoading } = useQuery({
    queryKey: ["overlay", id],
    queryFn: () => fetchUserProfile(id),
    enabled: !!id,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });

  if (!id) {
    return (
      <div className="ov-hint">
        <Coffee />
        <p>
          Overlay de matchmaking de Hot Coffee. Añade <b>?id=tuIdDeDiscord</b> a la URL
          (y opcionalmente <b>&amp;bg=dark</b>, <b>&amp;scale=1.25</b>, <b>&amp;flag=🇻🇪</b>).
        </p>
      </div>
    );
  }

  if (isLoading) return <div className="ov-bar ov-skeleton" />;

  if (!p) {
    return (
      <div className="ov-hint">
        <Coffee />
        <p>No se encontró al jugador. Revisa el ?id= de Discord.</p>
      </div>
    );
  }

  const name = p.user.globalName || p.user.guildNickname || p.user.username;
  const placing = p.rank.placed === false;
  // Partidas de clasificación jugadas: total de sets (nunca pasa de 5 mientras clasifica).
  const played = Math.min((p.stats.wins ?? 0) + (p.stats.losses ?? 0), 5);
  const fights = p.fights ?? [];
  const last = fights[0];
  const points = p.rank.points ?? p.stats.points ?? 0;

  return (
    <div className={`ov-wrap ${bg === "dark" ? "ov-dark" : ""}`} style={{ zoom: scale }}>
      {/* Píldoras superiores: estado de clasificación / último rival */}
      <div className="ov-pills">
        {placing ? (
          <span className="ov-pill ov-placing">EN CLASIFICACIÓN {played}/5 PARTIDAS</span>
        ) : (
          <span className="ov-pill ov-brand"><Coffee /> HOT COFFEE · 2XKO</span>
        )}
        {last && (
          <span className="ov-pill ov-opponent" title={`Set a ${last.targetFT}`}>
            ÚLTIMO RIVAL · <b>{last.opponentTag}</b> {last.scoreFor}–{last.scoreAgainst}
          </span>
        )}
      </div>

      {/* Barra principal */}
      <div className="ov-bar">
        <div className="ov-player">
          <span className={`ov-dot ${p.presence?.status ?? "offline"}`} title={p.presence?.status ?? "offline"} />
          {p.user.avatarUrl ? (
            <img className="ov-avatar" src={p.user.avatarUrl} alt="" />
          ) : (
            <span className="ov-avatar ov-avatar-fb">{name.charAt(0).toUpperCase()}</span>
          )}
          <div className="ov-id">
            <strong>{name}{flag ? <span className="ov-flag">{flag}</span> : null}</strong>
            {p.mains && (
              <small className="ov-mains">
                <span><img src={`/fighters/${encodeURIComponent(p.mains.point.id)}.png`} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />{p.mains.point.name}</span>
                <i>/</i>
                <span><img src={`/fighters/${encodeURIComponent(p.mains.assist.id)}.png`} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />{p.mains.assist.name}</span>
                {p.mains.fuse?.id && (
                  <span className="ov-fuse" title={`Fuse: ${p.mains.fuse.name}`}>
                    <img src={fuseIconUrl(p.mains.fuse.id)} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
                  </span>
                )}
              </small>
            )}
          </div>
        </div>

        <div className="ov-rank">
          <img
            className="ov-badge"
            src={rankIconUrl(p.rank.iconPath)}
            alt={p.rank.displayName}
            onError={(e) => {
              const fb = rankIconFallbackUrl(p.rank.iconPath);
              if (e.currentTarget.src !== fb) e.currentTarget.src = fb;
            }}
          />
          <div className="ov-rank-txt">
            <strong style={{ color: p.rank.color || "#fff" }}>{p.rank.displayName}</strong>
            <small>{fmt(points)} PTS</small>
          </div>
        </div>

        <div className="ov-record">
          <b>{p.stats.wins ?? 0}<i>V</i> — {p.stats.losses ?? 0}<i>D</i></b>
          <div className="ov-sets">
            {fights.slice(0, 5).map((f) => (
              <em key={f.id} className={f.result === "WIN" ? "w" : "l"} title={`${f.scoreFor}-${f.scoreAgainst} vs ${f.opponentTag}`}>
                {f.result === "WIN" ? "V" : "D"}
              </em>
            ))}
          </div>
          <small>#{p.stats.rankingPosition ?? "—"} DE LA LIGA</small>
        </div>
      </div>
    </div>
  );
}

export default function OverlayPage() {
  return (
    <Suspense fallback={null}>
      <OverlayInner />
    </Suspense>
  );
}
