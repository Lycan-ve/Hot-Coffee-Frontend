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
    <a href={loginUrl()} className={className} title="Debes ser miembro del servidor Hot Coffee 2XKO">
      <img src={`${A}/3508d.svg`} alt="" /> {label}
    </a>
  );
}

export function DiscordLogin() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
        onClick={() => {
          clearToken();
          setMe(null);
        }}
      >
        Salir
      </button>
    </div>
  );
}
