import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrowdSec Dashboard",
  description: "Internal single-administrator dashboard for CrowdSec (cscli-only source of truth).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        <div id="app-root">{children}</div>
      </body>
    </html>
  );
}
