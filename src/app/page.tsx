import RankingBoard from "@/components/hc/RankingBoard";

// Portada: ranking de TORNEOS (el de matchmaking vive en /ranking-matchmaking).
export default function HomePage() {
  return <RankingBoard mode="torneos" />;
}
