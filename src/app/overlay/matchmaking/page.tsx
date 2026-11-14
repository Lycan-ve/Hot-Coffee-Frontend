'use client';

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Coffee } from "lucide-react";
import {
  fetchMe,
  fetchUserProfile,
  fuseIconUrl,
  getToken,
  loginUrl,
  rankIconFallbackUrl,
  rankIconUrl,
} from "@/lib/auth";
import { FitText } from "@/components/overlay-fit";
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
  // En navegador (no OBS) con sesión: preparamos las URL listas para OBS.
  // TODO se calcula tras montar (nunca durante el render) para no romper el
  // prerender/hidratación ni fallar si localStorage está bloqueado.
  const isOBS = typeof navigator !== "undefined" && /OBS/i.test(navigator.userAgent);
  const [setup, setSetup] = useState<{ cardUrl: string; partidaUrl: string; checked: boolean } | null>(null);
  // Verificación de sesión re-ejecutable (botón Reintentar / volver a la pestaña).
  const check = useCallback(() => {
    if (isOBS) return;
    (async () => {
      try {
        const base = window.location.origin;
        const token = getToken();
        const m = await fetchMe();
        setSetup({
          cardUrl: m ? `${base}/overlay/matchmaking?id=${m.user.discordId}` : "",
          partidaUrl: token ? `${base}/overlay/partida?token=${encodeURIComponent(token)}` : "",
          checked: true,
        });
      } catch {
        setSetup({ cardUrl: "", partidaUrl: "", checked: true });
      }
    })();
  }, [isOBS]);
  useEffect(() => {
    check();
    // Si inicia sesión en otra pestaña, al volver aquí se re-verifica solo.
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [check]);

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
    const cardUrl = setup?.cardUrl || null;
    const partidaUrl = setup?.partidaUrl || null;
    return (
      <div className="ov-hint">
        <Coffee />
        {cardUrl ? (
          <div className="ov-setup">
            <b>TUS URL PARA OBS (fuente Navegador):</b>
            <small>Tarjeta de jugador:</small>
            <code>{cardUrl}</code>
            {partidaUrl && (
              <>
                <small>Overlay de partida (1920×1080):</small>
                <code>{partidaUrl}</code>
              </>
            )}
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText([cardUrl, partidaUrl].filter(Boolean).join("\n")).catch(() => {})}
            >
              Copiar
            </button>
            <small>La URL de partida lleva tu token de sesión: no la compartas ni la pegues en chats.</small>
          </div>
        ) : (
          <div className="ov-setup">
            <p>
              Overlay de matchmaking de Hot Coffee. Añade <b>?id=tuIdDeDiscord</b> a la URL
              (y opcionalmente <b>&amp;bg=dark</b>, <b>&amp;scale=1.25</b>, <b>&amp;flag=🇻🇪</b>).
            </p>
            {setup?.checked && !isOBS && (
              <>
                <p>Inicia sesión con Discord y esta página te da tu URL lista para OBS:</p>
                <div className="ov-setup-actions">
                  <a className="ov-btn" href={loginUrl()}>☕ INICIAR SESIÓN</a>
                  <button type="button" className="ov-btn" onClick={check}>Reintentar</button>
                </div>
                <small>Tras iniciar sesión, vuelve a esta pestaña: la URL aparece sola.</small>
              </>
            )}
          </div>
        )}
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
          <span key={`placing-${played}`} className="ov-pill ov-placing">EN CLASIFICACIÓN {played}/5 PARTIDAS</span>
        ) : (
          <span key="classified" className="ov-pill ov-brand"><Coffee /> HOT COFFEE · 2XKO</span>
        )}
        {last && (
          <span key={`${last.id}-${last.scoreFor}-${last.scoreAgainst}`} className="ov-pill ov-opponent" title={`Set a ${last.targetFT}`}>
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
            <FitText as="strong" min={16} watch={name + flag}>{name}{flag ? <span className="ov-flag">{flag}</span> : null}</FitText>
            {p.mains && (
              <small key={`${p.mains.point.id}-${p.mains.assist.id}-${p.mains.fuse?.id ?? ""}`} className="ov-mains">
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
          {/* Sin rango (clasificando): insignia genérica, nunca una división. */}
          <img
            key={p.rank.iconPath}
            className="ov-badge"
            src={p.rank.iconPath ? rankIconUrl(p.rank.iconPath) : "/assets/Aspirant_icon.png"}
            alt={p.rank.displayName}
            onError={(e) => {
              if (!p.rank.iconPath) return;
              const fb = rankIconFallbackUrl(p.rank.iconPath);
              if (e.currentTarget.src !== fb) e.currentTarget.src = fb;
            }}
          />
          <div key={`${p.rank.displayName}-${points}`} className="ov-rank-txt">
            <strong style={{ color: p.rank.color || "#fff" }}>{p.rank.displayName}</strong>
            <small key={placing ? "clasificando" : points}>{placing ? "CLASIFICANDO" : `${fmt(points)} PTS`}</small>
          </div>
        </div>

        <div className="ov-record">
          <b key={`${p.stats.wins}-${p.stats.losses}`}>{p.stats.wins ?? 0}<i>V</i> — {p.stats.losses ?? 0}<i>D</i></b>
          <div className="ov-sets">
            {fights.slice(0, 5).map((f) => (
              <em key={f.id} className={f.result === "WIN" ? "w" : "l"} title={`${f.scoreFor}-${f.scoreAgainst} vs ${f.opponentTag}`}>
                {f.result === "WIN" ? "V" : "D"}
              </em>
            ))}
          </div>
          <small key={p.stats.rankingPosition}>#{p.stats.rankingPosition ?? "—"} DE LA LIGA</small>
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