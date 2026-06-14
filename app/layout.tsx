import type { Metadata, Viewport } from "next";
import { Anton, Archivo, Inter } from "next/font/google";
import "./globals.css";

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
  title: "FUTBATTLE",
  description: "Convoque lendas, comande sua seleção e conquiste a Copa.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "FUTBATTLE" },
  formatDetection: { telephone: false },
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
      </body>
    </html>
  );
}
