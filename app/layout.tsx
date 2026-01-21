import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import Providers from "./providers";
import { DEFAULT_LANG, type Lang } from "@/lib/i18n/messages";

export const metadata: Metadata = {
  title: "OpenStock",
  description:
    "OpenStock is an open-source alternative to expensive market platforms. Track real-time prices, set personalized alerts, and explore detailed company insights — built openly, for everyone, forever free.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const stored = cookieStore.get("openstock_locale")?.value;
  const initialLang: Lang = stored === "zh" || stored === "en" ? stored : DEFAULT_LANG;

  return (
    <html lang={initialLang} suppressHydrationWarning>
      <body className="antialiased">
        <Providers initialLang={initialLang}>{children}</Providers>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
