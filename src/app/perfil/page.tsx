'use client';

import { useEffect, useState } from 'react';
import { fetchMe, getToken, loginUrl, type MeResponse } from '@/lib/auth';
import {
  PlayerProfile,
  ProfileCanvas,
  ProfileLoading,
  ProfileNotice,
} from '@/components/PlayerProfile';

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
      <ProfileCanvas>
        <ProfileLoading />
      </ProfileCanvas>
    );
  }

  if (status === 'anon') {
    return (
      <ProfileCanvas>
        <ProfileNotice
          eyebrow="HOT COFFEE 2XKO / PLAYER CARD"
          title="Tu próxima partida empieza aquí."
          message="Conecta tu cuenta de Discord para consultar tu rango, tu historial de peleas y tus resultados en torneos."
          action="Iniciar sesión con Discord"
          href={loginUrl()}
        />
      </ProfileCanvas>
    );
  }

  if (status === 'error' || !me) {
    return (
      <ProfileCanvas>
        <ProfileNotice
          eyebrow="HOT COFFEE 2XKO / CONEXIÓN"
          title="No pudimos cargar tu ficha."
          message={
            ERROR_MESSAGES[errorCode ?? ''] ??
            'Ocurrió un error inesperado. Vuelve a intentarlo.'
          }
          action="Reintentar con Discord"
          href={loginUrl()}
          error
        />
      </ProfileCanvas>
    );
  }

  return <PlayerProfile me={me} own />;
}
