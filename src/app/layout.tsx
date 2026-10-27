import type { Metadata } from 'next';
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: 'Hot Coffee 2XKO',
  description: 'Ranking Oficial de Hot Coffee 2XKO Discord',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Hot Coffee 2XKO',
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