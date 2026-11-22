import { Inter } from "next/font/google";
import { getSharedReport } from "@/lib/supabase/public";
import "../../globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic", "cyrillic-ext"], variable: "--font-inter" });

/**
 * Root layout for public parent pages (/p/<token>). Separate from the app: no login,
 * no top bar, no navigation, and the page language is the parent's language.
 */
export default async function SharedReportLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getSharedReport(token);

  return (
    <html lang={report?.language ?? "kk"} className={inter.variable}>
      <body className="min-h-dvh bg-muted/40 font-sans antialiased">{children}</body>
    </html>
  );
}
