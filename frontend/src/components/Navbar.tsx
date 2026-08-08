"use client";

import {ConnectButton} from "@rainbow-me/rainbowkit";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useAccount} from "wagmi";
import {anvilLocal} from "@/config/wagmi";

const NAV_LINKS = [
  {href: "/workspaces", label: "Workspaces"},
  {href: "/expenses", label: "Expenses"},
  {href: "/attestations", label: "Attestations"},
] as const;

export function Navbar() {
  const pathname = usePathname();
  const {chainId} = useAccount();
  const isLocalChain = chainId === anvilLocal.id;

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/workspaces" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400 text-sm font-bold text-zinc-950">
              CP
            </span>
            <span className="text-sm font-semibold tracking-tight text-zinc-100">Co-Op Protocol</span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((link) => {
              const active = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {chainId ? (
            <span
              className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide sm:inline-flex ${
                isLocalChain
                  ? "border-amber-800 bg-amber-950/40 text-amber-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isLocalChain ? "bg-amber-400" : "bg-emerald-400"}`} />
              {isLocalChain ? "Anvil Local" : `Chain ${chainId}`}
            </span>
          ) : null}
          <ConnectButton showBalance={false} chainStatus="icon" />
        </div>
      </div>

      <nav className="flex items-center gap-1 border-t border-zinc-800 px-4 py-2 sm:hidden">
        {NAV_LINKS.map((link) => {
          const active = pathname?.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
