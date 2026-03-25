import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Chakra_Petch } from "next/font/google";
import "./globals.css";
import '@rainbow-me/rainbowkit/styles.css';
import { Providers } from "./providers";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

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
      <body className={`${inter.variable} ${jetbrains.variable} ${chakra.variable} font-sans bg-[#0B0B0F] text-white selection:bg-purple-500/30 overflow-hidden`}>
        <Providers>
          <div className="flex h-screen w-full">
            {/* Desktop Sidebar */}
            <Sidebar />
            
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
              <Navbar />
              <div className="flex-1 overflow-y-auto bg-[#0B0B0F]">
                {children}
              </div>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}