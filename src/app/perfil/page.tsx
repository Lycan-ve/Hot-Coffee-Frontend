'use client';

import { useEffect, useState } from 'react';
import {
  fetchMe,
  getToken,
  loginUrl,
  MeResponse,
  rankIconFallbackUrl,
  rankIconUrl,
} from '@/lib/auth';

type Status = 'loading' | 'anon' | 'error' | 'ok';

const ERROR_MESSAGES: Record<string, string> = {
  no_miembro:
    'Necesitas ser miembro del servidor de Discord Hot Coffee 2XKO para iniciar sesión. Únete y vuelve a intentarlo.',
  estado_invalido: 'La sesión de login expiró. Vuelve a intentarlo.',
  token: 'Discord no autorizó el acceso. Vuelve a intentarlo.',
  usuario: 'No se pudo obtener tu usuario de Discord. Vuelve a intentarlo.',
  servidor: 'Error interno del servidor. Vuelve a intentarlo en un momento.',
};

export default function PerfilPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    // ¿vino con ?error=... desde el callback del backend?
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) setErrorCode(err);

    if (!getToken()) {
      setStatus(err ? 'error' : 'anon');
      return;
    }
    fetchMe().then((data) => {
      if (!data) {
        setStatus(err ? 'error' : 'anon');
        return;
      }
      setMe(data);
      setStatus('ok');
    });
  }, []);

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#121212] text-white/50">
        Cargando perfil...
      </main>
    );
  }

  if (status === 'anon') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#121212] px-4 text-center">
        <h1 className="font-display text-4xl text-white">HOT COFFEE 2XKO</h1>
        <p className="max-w-md text-white/60">
          Inicia sesión con Discord para ver tu perfil, tu rango y tus
          estadísticas de matchmaking.
        </p>
        <a
          href={loginUrl()}
          className="rounded border border-white/15 bg-white/5 px-6 py-3 font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/10"
        >
          Iniciar sesión con Discord
        </a>
      </main>
    );
  }

  if (status === 'error' || !me) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#121212] px-4 text-center">
        <h1 className="font-display text-4xl text-[#f07070]">UPS...</h1>
        <p className="max-w-md text-white/70">
          {ERROR_MESSAGES[errorCode ?? ''] ??
            'Ocurrió un error inesperado. Vuelve a intentarlo.'}
        </p>
        <a
          href={loginUrl()}
          className="rounded border border-white/15 bg-white/5 px-6 py-3 font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/10"
        >
          Reintentar
        </a>
      </main>
    );
  }

  const { user, stats, rank } = me;
  const games = stats.wins + stats.losses;
  const winrate = games > 0 ? (stats.wins / games) * 100 : null;
  const name = user.guildNickname || user.globalName || user.username;

  return (
    <main className="min-h-screen bg-[#121212] px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        {/* Encabezado */}
        <a href="/" className="mb-6 block text-sm text-white/40 hover:text-white/70">
          ← Volver al ranking
        </a>

        {/* Tarjeta de perfil */}
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#1c1c1c]">
          {/* Datos del jugador */}
          <div className="flex items-center gap-4 border-b border-white/10 p-5">
            <img
              src={user.avatarUrl}
              alt={name}
              className="h-16 w-16 rounded-full border border-white/15 object-cover"
            />
            <div className="min-w-0">
              <h1 className="truncate font-condensed text-3xl font-bold text-white">
                {name}
              </h1>
              <p className="text-xs uppercase tracking-widest text-white/40">
                Miembro de Hot Coffee 2XKO
              </p>
            </div>
          </div>

          {/* Rank display */}
          <div className="flex items-center gap-5 p-6">
            <img
              src={rankIconUrl(rank.iconPath)}
              alt={rank.displayName}
              className="h-24 w-24 shrink-0 object-contain"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = rankIconFallbackUrl(rank.iconPath);
              }}
            />
            <div className="min-w-0 flex-1">
              <h2
                className="font-display text-4xl leading-none"
                style={{ color: rank.color }}
              >
                {rank.displayName.toUpperCase()}
              </h2>

              {rank.isRp ? (
                /* Grandmaster / Challenger: van por RP, sin barra */
                <div className="mt-3">
                  <p className="font-condensed text-2xl text-white/90">
                    {rank.rp} RP
                  </p>
                  {rank.next ? (
                    <p className="mt-1 text-xs text-white/50">
                      Faltan {rank.lpToNext} RP para {rank.next}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-[#ffe787]">
                      ¡Máximo rango alcanzado!
                    </p>
                  )}
                </div>
              ) : (
                /* Rangos con tier I-III: barra de LP 0-100 */
                <div className="mt-3">
                  <div className="flex items-baseline justify-between">
                    <p className="font-condensed text-2xl text-white/90">
                      {rank.lp} <span className="text-sm text-white/50">LP</span>
                    </p>
                    <p className="text-xs text-white/50">100 LP para subir</p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${rank.progress}%`, background: rank.color }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/50">
                    Faltan{' '}
                    <span className="font-semibold" style={{ color: rank.color }}>
                      {rank.lpToNext} LP
                    </span>{' '}
                    para subir a {rank.next}
                    {rank.nextIsRp ? ' (RP)' : ''}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-5 divide-x divide-white/10 border-t border-white/10">
            <Stat label="Puntos" value={String(stats.points)} />
            <Stat label="Victorias" value={String(stats.wins)} color="#50d484" />
            <Stat label="Derrotas" value={String(stats.losses)} color="#f07070" />
            <Stat
              label="Winrate"
              value={winrate !== null ? `${winrate.toFixed(1)}%` : '—'}
              color={rank.color}
            />
            <Stat
              label="Posición"
              value={stats.rankingPosition > 0 ? `#${stats.rankingPosition}` : '—'}
            />
          </div>
        </div>

        {games === 0 && (
          <p className="mt-4 text-center text-xs text-white/40">
            Todavía no has jugado sets de matchmaking. Usa <b>/ft</b> en el
            servidor de Discord para empezar a subir de rango.
          </p>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 py-4">
      <span
        className="font-condensed text-2xl font-bold"
        style={{ color: color ?? '#ffffff' }}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-widest text-white/40">
        {label}
      </span>
    </div>
  );
}