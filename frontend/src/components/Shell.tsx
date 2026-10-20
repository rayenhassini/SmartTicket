"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

// F1 : seul le module Tickets est actif. Les autres entrées sont visibles mais désactivées
// (pages prévues en F2/F3). Pas de masquage par rôle en V1 : tout utilisateur authentifié voit tout.
const NAV: { label: string; href: string; enabled: boolean; roles?: string[] }[] = [
  { label: "Tickets", href: "/tickets", enabled: true },
  // Phase 2 : les équipes sont réservées au PMO (le backend refuse les autres rôles en 403).
  { label: "Équipes", href: "/teams", enabled: true, roles: ["pmo"] },
  { label: "Utilisateurs", href: "/users", enabled: false },
  { label: "Solutions", href: "/solutions", enabled: false },
  { label: "Contrats", href: "/contracts", enabled: false },
  { label: "Équipements", href: "/equipment", enabled: false },
  { label: "Logiciels", href: "/equipment-softs", enabled: false },
  { label: "Sites", href: "/sites", enabled: false },
  { label: "Types de support", href: "/type-supports", enabled: false },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
        <Link href="/tickets" className="text-lg font-bold text-brand-700">
          SmartTicket
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-slate-600 sm:inline">
            {user?.firstName} {user?.lastName}
            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{user?.authority}</span>
          </span>
          <button onClick={handleLogout} className="btn-secondary !px-3 !py-1.5">
            Déconnexion
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white p-3 md:block">
          <nav className="space-y-1" aria-label="Navigation principale">
            {NAV.filter((item) => !item.roles || (user && item.roles.includes(user.authority))).map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              if (!item.enabled) {
                return (
                  <span
                    key={item.href}
                    className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-slate-400"
                    title="Disponible dans une prochaine phase"
                  >
                    {item.label}
                    <span className="text-[10px] uppercase tracking-wide">bientôt</span>
                  </span>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm font-medium ${
                    active ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
