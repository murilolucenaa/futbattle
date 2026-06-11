import type { Metadata } from "next";
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
