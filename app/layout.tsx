import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Chakra_Petch } from "next/font/google";
import "./globals.css";
import '@rainbow-me/rainbowkit/styles.css';
import { Providers } from "./providers"; // We will create this next
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const chakra = Chakra_Petch({ weight: "700", subsets: ["latin"], variable: "--font-chakra" });

export const metadata: Metadata = {
  title: "0xKeep | Trustless Liquidity Locker",
  description: "Write Once, Run Forever.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrains.variable} ${chakra.variable} bg-[#030305] text-white min-h-screen selection:bg-purple-500/30`}>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}