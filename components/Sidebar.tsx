'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Lock, Archive, PieChart } from "lucide-react"; // Import PieChart
import Logo from "./Logo";

export default function Sidebar() {
  const pathname = usePathname();

  const isPublicPage = pathname.startsWith('/lock') || pathname.startsWith('/vesting') || pathname.startsWith('/embed');
  if (isPublicPage) return null;

  return (
    <aside className="w-64 h-screen bg-[#0B0B0F] border-r border-[#1C1C26] hidden md:flex flex-col sticky top-0">
      <div className="h-20 flex items-center px-8 border-b border-[#1C1C26]">
        <Link href="/" className="flex items-center gap-3 group">
          <Logo className="w-7 h-7 transition-transform group-hover:scale-105 duration-300" />
          <span className="font-chakra font-bold text-2xl tracking-wide text-white">0xKeep</span>
        </Link>
      </div>

      <nav className="flex-1 py-8 flex flex-col gap-2">
        <Link href="/" className={`flex items-center gap-4 px-8 py-3 text-xs font-mono uppercase tracking-widest transition-colors ${pathname === '/' ? 'sidebar-active' : 'text-[#555566] hover:text-white border-l-2 border-transparent'}`}>
          <LayoutGrid size={16} /> My Vaults
        </Link>
        <Link href="/create" className={`flex items-center gap-4 px-8 py-3 text-xs font-mono uppercase tracking-widest transition-colors ${pathname === '/create' ? 'sidebar-active' : 'text-[#555566] hover:text-white border-l-2 border-transparent'}`}>
          <Lock size={16} /> Create Vault
        </Link>
        
        {/* NEW TOKENOMICS LINK */}
        <Link href="/tokenomics" className={`flex items-center gap-4 px-8 py-3 text-xs font-mono uppercase tracking-widest transition-colors ${pathname === '/tokenomics' ? 'sidebar-active' : 'text-[#555566] hover:text-white border-l-2 border-transparent'}`}>
          <PieChart size={16} /> Token Audit
        </Link>

        <Link href="/archive" className={`flex items-center gap-4 px-8 py-3 text-xs font-mono uppercase tracking-widest transition-colors ${pathname === '/archive' ? 'sidebar-active' : 'text-[#555566] hover:text-white border-l-2 border-transparent'}`}>
          <Archive size={16} /> Archived Vaults
        </Link>
      </nav>
    </aside>
  );
}