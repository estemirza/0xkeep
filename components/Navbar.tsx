import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import Logo from "./Logo";

export default function Navbar() {
  return (
    <nav className="w-full border-b border-white/5 bg-[#030305]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
        
        {/* LOGO AREA */}
        <Link href="/" className="flex items-center gap-3 group shrink-0">
            <Logo className="w-8 h-8 md:w-9 md:h-9 transition-transform group-hover:scale-110 duration-300" />
            <span className="font-chakra font-bold text-2xl md:text-3xl tracking-wide text-white group-hover:text-purple-400 transition-colors">
              0xKeep
            </span>
        </Link>
        
        {/* NAVIGATION & CONNECT - Flex wrap on very small screens, or hide text */}
        <div className="flex items-center gap-4 md:gap-8">
            <Link 
              href="/" 
              className="hidden md:block font-mono text-xs uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            
            <Link 
              href="/create" 
              className="hidden md:block font-mono text-xs uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
            >
              Create
            </Link>
            
            <div className="hidden md:block h-6 w-px bg-white/10 mx-2" />
            
            {/* Show Create Icon on Mobile if text hidden? Or just keep Connect Button */}
            <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
        </div>
      </div>
    </nav>
  );
}