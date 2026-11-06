'use client';

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageNotice } from "@/components/hc/shared";
import { PlayerProfile } from "@/components/hc/PlayerProfile";
import { fetchUserProfile } from "@/lib/auth";

export default function PublicProfile() {
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? String(rawId[0]) : typeof rawId === "string" ? rawId : "";
  const { data, isLoading } = useQuery({ queryKey: ["profile", id], queryFn: () => fetchUserProfile(id) });
  return (
    <AppShell>
      {data ? (
        <PlayerProfile me={data} own={false} />
      ) : (
        <main className="page">
          {isLoading ? (
            <PageNotice title="CARGANDO FICHA…" message="Consultando el perfil del jugador." />
          ) : (
            <PageNotice
              title="NO ENCONTRAMOS ESTA FICHA."
              message="El jugador no existe o todavía no tiene un perfil público en Hot Coffee 2XKO."
              action={<Link href="/" className="discord">Volver al ranking</Link>}
            />
          )}
        </main>
      )}
    </AppShell>
  );
}
