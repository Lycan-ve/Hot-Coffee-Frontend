export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

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
  };
  rank: RankInfo;
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

/** URL del ícono de rango, con fallback a GitHub raw si el backend no sirve /Rangos. */
export function rankIconUrl(iconPath: string): string {
  return `${API_URL}/${iconPath}`;
}

export function rankIconFallbackUrl(iconPath: string): string {
  return `https://raw.githubusercontent.com/Lycan-ve/Hot-Coffee-Backend/main/${iconPath}`;
}