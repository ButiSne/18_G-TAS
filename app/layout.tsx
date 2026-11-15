import type { Metadata, Viewport } from "next";
import { Archivo_Black, Cinzel, Montserrat, Playfair_Display, Space_Mono } from "next/font/google";
import { RefKeeper } from "@/src/components/ref-keeper";
import { SiteFooter } from "@/src/components/site-footer";
import { getMessages } from "@/src/lib/messages";
import { SHARE_OPEN_GRAPH, SHARE_TWITTER } from "@/src/lib/share-meta";
import { SITE_URL } from "@/src/lib/site";
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
  title: { default: t.site.title, template: `%s · ${t.site.name}` },
  description: t.site.tagline,
  metadataBase: new URL(SITE_URL),
  // Link previews (WhatsApp, Facebook, X): every page shares the same brand card
  // (src/lib/share-meta.ts). Absolute URLs come from metadataBase.
  openGraph: SHARE_OPEN_GRAPH,
  twitter: SHARE_TWITTER,
};

// Onyx in both themes: the phone's browser bar blends into the dark hero and footer.
export const viewport: Viewport = { themeColor: "#0D0D0D" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fonts = [playfair, archivoBlack, cinzel, montserrat, spaceMono]
    .map((f) => f.variable)
    .join(" ");
  return (
    <html lang="en" className={fonts}>
      <body className="flex flex-col">
        <main className="flex-1">{children}</main>
        {/* Privacy, terms and copyright are linked from every page (brief §6). */}
        <SiteFooter />
        <RefKeeper />
      </body>
    </html>
  );
}
