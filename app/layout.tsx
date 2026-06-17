import type { Metadata, Viewport } from "next";
import { Anton, Archivo, Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SITE_URL } from "@/lib/site";

const anton = Anton({
  weight: "400",
  variable: "--font-anton",
  subsets: ["latin"],
});

const archivo = Archivo({
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-archivo",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "CONVOCADOS — convoque lendas e conquiste a Copa",
  description: "Convoque lendas reais de todas as Copas, comande sua seleção e vença o mundial. Jogo de futebol de técnico, grátis no navegador.",
  applicationName: "CONVOCADOS",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CONVOCADOS" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "CONVOCADOS",
    title: "CONVOCADOS — convoque lendas e conquiste a Copa",
    description: "Convoque lendas reais, comande sua seleção e vença o mundial. Grátis no navegador.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CONVOCADOS",
    description: "Convoque lendas reais, comande sua seleção e vença o mundial.",
  },
};

// Mobile-first viewport: fill the notch (viewport-fit cover), no surprise
// zoom on input focus, but keep pinch-zoom for accessibility.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#141512",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${anton.variable} ${archivo.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div className="stadium-bg" aria-hidden />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
