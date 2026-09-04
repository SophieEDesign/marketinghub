import type { Metadata, Viewport } from "next";
import { Archivo, League_Spartan } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-sans",
});

const leagueSpartan = League_Spartan({
  subsets: ["latin"],
  variable: "--font-display",
});

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "http://localhost:3001";

const title = "Peters & May Marketing Hub";
const description =
  "Internal marketing hub for events, content, media, and partnerships.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: `%s | ${title}`,
  },
  description,
  applicationName: title,
  icons: {
    icon: "/pm-group-logo.png",
    apple: "/pm-group-logo.png",
  },
  openGraph: {
    type: "website",
    siteName: title,
    title,
    description,
    url: siteUrl,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#0B2545",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${archivo.variable} ${leagueSpartan.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
