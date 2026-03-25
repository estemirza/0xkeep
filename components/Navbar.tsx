'use client';

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import Logo from "./Logo";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  
  // Hide on embed pages
  const isEmbed = pathname.startsWith('/embed');
  if (isEmbed) return null;

  const isPublicPage = pathname.startsWith('/lock') || pathname.startsWith('/vesting');

  return (
    <nav className="w-full h-20 border-b border-[#1C1C26] bg-[#0B0B0F] flex items-center justify-between px-6 md:px-10 sticky top-0 z-50">
      
      {/* Show Logo on Mobile ALWAYS. Show on Desktop ONLY if sidebar is hidden */}
      <Link href="/" className={`flex items-center gap-3 group ${isPublicPage ? '' : 'md:hidden'}`}>
          <Logo className="w-6 h-6" />
          <span className="font-chakra font-bold text-xl tracking-wide text-white">0xKeep</span>
      </Link>
      
      {/* If logo is hidden on desktop, push Wallet button to the right */}
      <div className={`flex items-center gap-4 ${!isPublicPage ? 'w-full justify-end' : ''}`}>
          <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
      </div>
    </nav>
  );
}