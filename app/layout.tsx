import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Archivo_Black, Cinzel, Montserrat, Playfair_Display, Space_Mono } from "next/font/google";
import { getMessages } from "@/src/lib/messages";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });
const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo-black",
});
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

const t = getMessages();

export const metadata: Metadata = {
  title: t.site.name,
  description: t.site.tagline,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3EDE2" },
    { media: "(prefers-color-scheme: dark)", color: "#0D0D0D" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fonts = [playfair, archivoBlack, cinzel, montserrat, spaceMono]
    .map((f) => f.variable)
    .join(" ");
  return (
    <html lang="en" className={fonts}>
      <body className="flex flex-col">
        <main className="flex-1">{children}</main>
        {/* The privacy notice is linked from every page (brief §6). */}
        <footer className="border-t border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
          <nav className="mx-auto flex max-w-3xl gap-6">
            <Link href="/privacy" className="underline">
              {t.legal.privacy}
            </Link>
            <Link href="/rules" className="underline">
              {t.legal.rules}
            </Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
