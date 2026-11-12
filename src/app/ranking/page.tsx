import RankingBoard from "@/components/hc/RankingBoard";

// Ranking de TORNEOS (la home de presentación vive en /; el de matchmaking
// sigue en /ranking-matchmaking).
export default function RankingPage() {
  return <RankingBoard mode="torneos" />;
}
