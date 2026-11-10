'use client';

import { useEffect, useState } from "react";
import { AppShell, PageNotice } from "@/components/hc/shared";
import { LoginLink } from "@/components/hc/DiscordLogin";
import { PlayerProfile } from "@/components/hc/PlayerProfile";
import { fetchMe, getToken, type MeResponse } from "@/lib/auth";

const ERRORS: Record<string, string> = {
  no_miembro: "Necesitas ser miembro del servidor de Discord Hot Coffee 2XKO para iniciar sesión. Únete y vuelve a intentarlo.",
  estado_invalido: "La sesión de login expiró. Vuelve a intentarlo.",
  token: "Discord no autorizó el acceso. Vuelve a intentarlo.",
  usuario: "No se pudo obtener tu usuario de Discord. Vuelve a intentarlo.",
  servidor: "Error interno del servidor. Vuelve a intentarlo en un momento.",
};

export default function PerfilPage() {
  const [status, setStatus] = useState<"loading" | "anon" | "error" | "ok">("loading");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("error");
    setErr(e);
    if (!getToken()) {
      setStatus(e ? "error" : "anon");
      return;
    }
    fetchMe().then((d) => {
      if (d) {
        setMe(d);
        setStatus("ok");
      } else setStatus(e ? "error" : "anon");
    });
  }, []);

  // Refresco en vivo del estado de Discord (presencia) cada 30 s.
  useEffect(() => {
    if (status !== "ok") return;
    const id = setInterval(async () => {
      const d = await fetchMe();
      if (d) setMe(d);
    }, 30_000);
    return () => clearInterval(id);
  }, [status]);

  return (
    <AppShell>
      {status === "ok" && me ? (
        <PlayerProfile me={me} own />
      ) : (
        <main className="page">
          {status === "loading" && <PageNotice title="CARGANDO TU FICHA…" message="Un momento, estamos consultando tu perfil." />}
          {status === "anon" && (
            <PageNotice
              title="TU PRÓXIMA PARTIDA EMPIEZA AQUÍ."
              message="Conecta tu cuenta de Discord para consultar tu rango, tu historial de peleas y tus resultados en torneos."
              action={<LoginLink />}
            />
          )}
          {status === "error" && (
            <PageNotice
              title="NO PUDIMOS CARGAR TU FICHA."
              message={ERRORS[err ?? ""] ?? "Ocurrió un error inesperado. Vuelve a intentarlo."}
              action={<LoginLink label="Reintentar con Discord" />}
            />
          )}
        </main>
      )}
    </AppShell>
  );
}
