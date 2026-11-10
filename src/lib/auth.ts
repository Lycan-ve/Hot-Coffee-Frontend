export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://hot-coffee-backend.onrender.com';

const TOKEN_KEY = 'hc_token';

export interface RankInfo {
  rank: string;
  tier: string;
  displayName: string;
  isRp: boolean;
  lp: number;
  rp: number;
  points: number;
  lpToNext: number;
  next: string;
  nextIsRp: boolean;
  divisionIndex: number;
  progress: number;
  iconPath: string;
  color: string;
}

export interface ProfileCharacter {
  id: string;
  name: string;
}

export interface ProfileTeam {
  point: ProfileCharacter;
  assist: ProfileCharacter;
  fuse: ProfileCharacter;
}

export interface ProfileFight {
  id: number;
  playedAt: string;
  result: 'WIN' | 'LOSS';
  scoreFor: number;
  scoreAgainst: number;
  targetFT: number;
  opponentTag: string;
  opponentAvatar: string;
  opponentDiscordId: string;
  playerTeam: ProfileTeam;
  opponentTeam: ProfileTeam;
}

export interface ProfileTournament {
  eventId: number;
  name: string;
  slug: string;
  /** Ícono del torneo en Start.gg (lo llena el backend; puede venir vacío). */
  image?: string;
  points: number;
  placement: number;
  placementLabel: string;
  isWinner: boolean;
}

export interface MeResponse {
  user: {
    discordId: string;
    username: string;
    globalName: string;
    guildNickname: string;
    avatarUrl: string;
  };
  stats: {
    points: number;
    wins: number;
    losses: number;
    rankingPosition: number;
    /** Puntos acumulados en el ranking de TORNEOS (lo llena el backend). */
    tournamentPoints?: number;
    /** Posición en la tabla de TORNEOS (lo llena el backend). */
    tournamentPosition?: number;
  };
  rank: RankInfo;
  fights?: ProfileFight[];
  tournaments?: ProfileTournament[];
  /** Equipo principal (mains) del jugador, si lo configuró en la web. */
  mains?: ProfileTeam;
}

/**
 * Devuelve el token guardado. Además, absorbe el #token=... que llega
 * tras volver del callback de Discord (solo llamar en el cliente).
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (window.location.hash.startsWith('#token=')) {
    const t = decodeURIComponent(window.location.hash.slice('#token='.length));
    localStorage.setItem(TOKEN_KEY, t);
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function loginUrl(): string {
  return `${API_URL}/api/auth/discord/login`;
}

export async function fetchMe(): Promise<MeResponse | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      clearToken();
      return null;
    }
    return (await res.json()) as MeResponse;
  } catch {
    return null;
  }
}

/**
 * Perfil público de cualquier jugador por su ID de Discord
 * (GET /api/users/profile/{discordId}, sin autenticación).
 */
export async function fetchUserProfile(discordId: string): Promise<MeResponse | null> {
  try {
    const res = await fetch(
      API_URL + '/api/users/profile/' + encodeURIComponent(discordId),
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    return (await res.json()) as MeResponse;
  } catch {
    return null;
  }
}

/**
 * Guarda el equipo principal (mains) del jugador autenticado.
 * POST /api/auth/mains { char1, char2, fuse } → null si OK, mensaje de error si falla.
 */
export async function saveMains(char1: string, char2: string, fuse: string): Promise<string | null> {
  const token = getToken();
  if (!token) return 'Inicia sesión de nuevo para guardar tu equipo.';
  try {
    const res = await fetch(`${API_URL}/api/auth/mains`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ char1, char2, fuse }),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.message || 'No se pudo guardar tu equipo. Intenta de nuevo.';
  } catch {
    return 'No se pudo conectar con el servidor.';
  }
}

/** URL del ícono de rango, con fallback a GitHub raw si el backend no sirve /Rangos. */
export function rankIconUrl(iconPath: string): string {
  return `${API_URL}/${iconPath}`;
}

export function rankIconFallbackUrl(iconPath: string): string {
  return `https://raw.githubusercontent.com/Lycan-ve/Hot-Coffee-Backend/main/${iconPath}`;
}

/** Icono de fuse servido por el backend desde sus assets de 2XKO. */
export function fuseIconUrl(fuseId: string): string {
  return `${API_URL}/Fusion/file_${encodeURIComponent(fuseId)}V.png`;
}
