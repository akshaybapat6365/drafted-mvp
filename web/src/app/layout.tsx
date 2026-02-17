import type { Metadata } from "next";
import { Barlow, Cinzel } from "next/font/google";
import "./globals.css";

const body = Barlow({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const heading = Cinzel({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const themeInitScript = `(function(){try{var saved=localStorage.getItem("drafted-theme");var system=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";var theme=(saved==="light"||saved==="dark")?saved:system;document.documentElement.dataset.theme=theme;}catch(e){document.documentElement.dataset.theme="dark";}})();`;

export const metadata: Metadata = {
  title: "Drafted Blueprint Studio",
  description:
    "Prompt-to-plan architecture studio with deterministic geometry, staged generation, and exportable design artifacts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${body.variable} ${heading.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
