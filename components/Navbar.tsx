'use client';

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, FOOTER_LINKS } from "./Sidebar";

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Hide on embed pages
  const isEmbed = pathname.startsWith('/embed');
  if (isEmbed) return null;

  const isPublicPage = pathname.startsWith('/lock') || pathname.startsWith('/vesting');

  return (
    <>
      <nav className="w-full h-16 md:h-20 border-b border-white/[0.06] bg-[#030305]/70 backdrop-blur-xl flex items-center justify-between gap-3 px-4 md:px-10 sticky top-0 z-50">

        <div className={`flex items-center gap-2 ${isPublicPage ? '' : 'md:hidden'}`}>
          {/* Mobile menu button (phones only, app pages only) */}
          {!isPublicPage && (
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="md:hidden w-10 h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-white"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
          {/* Show Logo on Mobile ALWAYS. Show on Desktop ONLY if sidebar is hidden */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <Logo className="w-6 h-6" />
            <span className="font-chakra font-bold text-xl tracking-wide text-white">0xKeep</span>
          </Link>
        </div>

        {/* If logo is hidden on desktop, push Wallet button to the right */}
        <div className={`flex items-center gap-4 ${!isPublicPage ? 'md:w-full justify-end' : ''}`}>
          <ConnectButton showBalance={false} accountStatus={{ smallScreen: 'avatar', largeScreen: 'address' }} chainStatus="icon" />
        </div>
      </nav>

      {/* MOBILE MENU (same links as the desktop sidebar) */}
      {!isPublicPage && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            className={`md:hidden fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          />
          <aside
            className={`md:hidden fixed top-0 bottom-0 left-0 z-[61] w-[min(300px,84vw)] flex flex-col border-r border-white/[0.08] bg-[#0b0b10]/[0.97] px-4 py-5 transition-transform duration-[450ms] ease-[cubic-bezier(.16,1,.3,1)] ${menuOpen ? 'translate-x-0' : '-translate-x-[102%]'}`}
          >
            <Link href="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-2 pb-6">
              <Logo className="w-7 h-7" />
              <span className="font-chakra font-bold text-2xl tracking-wide text-white">0xKeep</span>
            </Link>
            <nav className="flex flex-col gap-1.5">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3.5 h-12 px-4 rounded-xl text-xs font-mono uppercase tracking-widest transition-colors ${pathname === href ? 'sidebar-active' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'}`}
                >
                  <Icon size={16} /> {label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto pt-5 border-t border-white/[0.06] flex flex-col gap-4 px-2">
              {FOOTER_LINKS.map(({ href, label, icon: Icon }) => (
                <a key={href} href={href} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
                  <Icon size={12} /> {label}
                </a>
              ))}
              <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mt-2">© 0xKeep Protocol</div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
