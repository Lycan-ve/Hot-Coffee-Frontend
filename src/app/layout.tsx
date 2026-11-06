import type { Metadata } from "next";
import { Providers } from "@/components/hc/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hot Coffee · 2XKO Ranking",
  description: "Ranking, perfiles y matchmaking de la comunidad Hot Coffee de 2XKO.",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "Hot Coffee · 2XKO Ranking",
    description: "Ranking, perfiles y matchmaking de la comunidad Hot Coffee de 2XKO.",
    images: ["/logo-Hot.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;600&display=swap"
          rel="stylesheet"
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
