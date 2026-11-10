'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearToken, fetchMe, loginUrl, type MeResponse } from "@/lib/auth";
import { A } from "./shared";

export function displayName(me: MeResponse) {
  return me.user.guildNickname || me.user.globalName || me.user.username;
}

export function LoginLink({ label = "Iniciar sesión con Discord", className = "discord" }: { label?: string; className?: string }) {
  return (
    <>
      <a href={loginUrl()} className={className} title="Inicia sesión con Discord. Debes ser miembro del servidor Hot Coffee 2XKO">
        <img src={`${A}/3508d.svg`} alt="" /> {label}
      </a>
      <a
        className="hc-join"
        href="https://discord.gg/8NbFuJcSCH"
        target="_blank"
        rel="noopener noreferrer"
        title="¿Aún no eres miembro? Únete al servidor Hot Coffee 2XKO"
      >
        <img src={`${A}/3508d.svg`} alt="" /> Únete al Discord
      </a>
    </>
  );
}

export function DiscordLogin() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetchMe().then((d) => {
      setMe(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <span className="hc-auth-skeleton" aria-label="Cargando sesión" />;
  if (!me) return <LoginLink />;

  return (
    <div className="hc-user">
      <Link href="/perfil" title="Ver mi perfil">
        {me.user.avatarUrl ? <img src={me.user.avatarUrl} alt="" /> : <span className="ini">{displayName(me)[0]}</span>}
        <span>{displayName(me)}</span>
      </Link>
      <button
        type="button"
        className={loggingOut ? "busy" : undefined}
        disabled={loggingOut}
        onClick={() => {
          if (loggingOut) return;
          setLoggingOut(true);
          // Pausa deliberada: que cerrar sesión se sienta como un proceso
          // (revocar token, cerrar sesión) y no un parpadeo instantáneo.
          setTimeout(() => {
            clearToken();
            setMe(null);
            setLoggingOut(false);
          }, 900);
        }}
      >
        {loggingOut ? "CERRANDO SESIÓN…" : "Salir"}
      </button>
    </div>
  );
}
