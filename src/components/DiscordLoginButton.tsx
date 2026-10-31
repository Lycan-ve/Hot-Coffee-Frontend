'use client';

import { useCallback, useEffect, useState } from 'react';
import { clearToken, fetchMe, loginUrl, MeResponse } from '@/lib/auth';

export default function DiscordLoginButton() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setMe(await fetchMe());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return null;

  if (!me) {
    return (
      <a
        href={loginUrl()}
        className="inline-flex items-center gap-2 rounded border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/10"
        title="Debes ser miembro del servidor Hot Coffee 2XKO"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.4c1.7.4 2.5 1 3.3 1.7A16 16 0 0 0 12 4a16 16 0 0 0-6.5 1.1c.8-.7 1.7-1.4 3.3-1.7L8.6 3a19.8 19.8 0 0 0-4.9 1.4C1.6 8.4 1 12.4 1.3 16.3a20 20 0 0 0 6 3l.8-1.3c-1.1-.4-2.1-1-3-1.7l.7-.5a14.3 14.3 0 0 0 12.4 0l.7.5c-.9.7-1.9 1.3-3 1.7l.8 1.3a20 20 0 0 0 6-3c.4-4.5-.7-8.4-3.8-11.9ZM8.7 14.2c-1.2 0-2.2-1.1-2.2-2.4S7.5 9.4 8.7 9.4s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm6.6 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
        </svg>
        Iniciar sesión con Discord
      </a>
    );
  }

  const name = me.user.guildNickname || me.user.globalName || me.user.username;

  return (
    <div className="flex items-center gap-3">
      <a
        href="/perfil"
        className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-4 transition hover:border-white/30"
        title="Ver mi perfil"
      >
        <img
          src={me.user.avatarUrl}
          alt={name}
          className="h-8 w-8 rounded-full object-cover"
        />
        <span className="max-w-32 truncate text-sm font-semibold text-white/85">
          {name}
        </span>
      </a>
      <button
        onClick={() => {
          clearToken();
          setMe(null);
        }}
        className="text-xs font-semibold uppercase tracking-wide text-white/40 transition hover:text-white/70"
      >
        Salir
      </button>
    </div>
  );
}