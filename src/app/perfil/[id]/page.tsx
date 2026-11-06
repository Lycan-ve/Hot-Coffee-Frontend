'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchUserProfile, type MeResponse } from '@/lib/auth';
import {
  PlayerProfile,
  ProfileCanvas,
  ProfileLoading,
  ProfileNotice,
} from '@/components/PlayerProfile';

type Status = 'loading' | 'error' | 'ok';

// Perfil público de cualquier jugador: /perfil/{discordId}.
// No requiere iniciar sesión: usa la ruta pública del backend.
export default function PublicProfilePage() {
  const params = useParams();
  const rawId = params?.id;
  const discordId = Array.isArray(rawId)
    ? String(rawId[0])
    : typeof rawId === 'string'
      ? rawId
      : '';

  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    if (!discordId) {
      setStatus('error');
      return;
    }
    let alive = true;
    fetchUserProfile(discordId).then((data) => {
      if (!alive) return;
      if (data) {
        setProfile(data);
        setStatus('ok');
      } else {
        setStatus('error');
      }
    });
    return () => {
      alive = false;
    };
  }, [discordId]);

  if (status === 'loading') {
    return (
      <ProfileCanvas>
        <ProfileLoading />
      </ProfileCanvas>
    );
  }

  if (status === 'error' || !profile) {
    return (
      <ProfileCanvas>
        <ProfileNotice
          eyebrow="HOT COFFEE 2XKO / PLAYER CARD"
          title="No encontramos esta ficha."
          message="El jugador no existe o todavía no tiene un perfil público en Hot Coffee 2XKO. Vuelve al ranking y elige otro jugador."
          action="Volver al ranking"
          href="/"
          error
        />
      </ProfileCanvas>
    );
  }

  return <PlayerProfile me={profile} own={false} showBackLink />;
}
