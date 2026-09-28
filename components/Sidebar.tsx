'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Lock, Archive, PieChart, FileText, ShieldAlert, ShieldCheck } from "lucide-react";
import Logo from "./Logo";

// Shared by the desktop sidebar and the mobile menu (Navbar).
export const NAV_ITEMS = [
  { href: "/", label: "My Vaults", icon: LayoutGrid },
  { href: "/create", label: "Create Vault", icon: Lock },
  { href: "/tokenomics", label: "Token Audit", icon: PieChart },
  { href: "/archive", label: "Archived Vaults", icon: Archive },
];

export const FOOTER_LINKS = [
  { href: "https://0x-keep.xyz/docs.html", label: "Documentation", icon: FileText },
  { href: "https://0x-keep.xyz/terms.html", label: "Terms of Service", icon: ShieldAlert },
  { href: "https://0x-keep.xyz/privacy.html", label: "Privacy Policy", icon: ShieldCheck },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isPublicPage = pathname.startsWith('/lock') || pathname.startsWith('/vesting') || pathname.startsWith('/embed');
  if (isPublicPage) return null;

  return (
    // md–lg: slim icon rail · lg+: full sidebar
    <aside className="w-[76px] lg:w-64 h-screen hidden md:flex flex-col sticky top-0 border-r border-white/[0.06] bg-[#08080c]/60">

      {/* HEADER */}
      <div className="h-20 flex items-center justify-center lg:justify-start lg:px-7 shrink-0">
        <Link href="/" className="flex items-center gap-3 group">
          <Logo className="w-7 h-7 transition-transform group-hover:scale-105 duration-300" />
          <span className="hidden lg:inline font-chakra font-bold text-2xl tracking-wide text-white">0xKeep</span>
        </Link>
      </div>

      {/* MAIN NAVIGATION */}
      <nav className="flex-1 py-4 px-3 lg:px-4 flex flex-col gap-1.5 overflow-visible lg:overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`group/nav relative flex items-center justify-center lg:justify-start gap-3.5 h-11 lg:px-4 rounded-xl text-xs font-mono uppercase tracking-widest transition-all duration-200 ${active ? 'sidebar-active' : 'text-zinc-500 hover:text-white hover:bg-white/[0.04]'}`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="hidden lg:inline">{label}</span>
              {/* tooltip on the icon rail */}
              <span className="lg:hidden pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/[0.16] bg-[#0e0e14] px-2.5 py-1.5 text-[11px] normal-case tracking-normal font-sans text-white opacity-0 group-hover/nav:opacity-100 transition-opacity z-30">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* FOOTER LINKS (Pushed to bottom) */}
      <div className="px-3 lg:px-7 py-6 border-t border-white/[0.06] mt-auto shrink-0">
        <div className="flex flex-col items-center lg:items-stretch gap-4">
          {FOOTER_LINKS.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              title={label}
              className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
            >
              <Icon size={12} /> <span className="hidden lg:inline">{label}</span>
            </a>
          ))}
        </div>

        <div className="hidden lg:block mt-7 text-[9px] font-mono uppercase tracking-widest text-zinc-600">
          © 0xKeep Protocol
        </div>
      </div>

    </aside>
  );
}
