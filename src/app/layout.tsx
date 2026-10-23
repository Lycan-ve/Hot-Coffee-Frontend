import type { Metadata } from 'next';
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: '🎉 ¡Feliz Cumpleaños Chill Fever! | Hot Coffee 2XKO',
  description: 'Ranking Oficial de Hot Coffee 2XKO - ¡Celebrando el cumpleaños de Chill Fever!',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: '🎉 ¡Feliz Cumpleaños Chill Fever! | Hot Coffee 2XKO',
    description: 'Ranking Oficial de Hot Coffee 2XKO Discord',
    images: ['/logo-Hot.jpg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}