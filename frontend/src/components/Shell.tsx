"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { homeFor } from "@/lib/home";
import { useAuth } from "@/context/auth-context";
import { listTickets } from "@/lib/api/tickets";
import { listTeams } from "@/lib/api/teams";
import { listInvitations } from "@/lib/api/invitations";
import { usersApi, sitesApi, contractsApi } from "@/lib/api/admin";

// Au survol / focus d'un lien du menu, on lance déjà le GET de la page (rempli dans le cache 15 s, déduplié).
const WARM: Record<string, () => Promise<unknown>> = {
  "/tickets": listTickets,
  "/teams": listTeams,
  "/invitations": listInvitations,
  "/users": usersApi.list,
  "/sites": sitesApi.list,
  "/contracts": contractsApi.list,
};
const warm = (href: string) => {
  WARM[href]?.().catch(() => undefined);
};

// Icônes (SVG inline, trait 24x24) : pas de dépendance supplémentaire.
const ICONS: Record<string, string> = {
  ticket: "M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3zM13 6v12",
  team: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  mail: "M4 4h16v16H4zM4 6l8 7 8-7",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5V15h8v-1.5A6 6 0 0 0 12 3z",
  doc: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h8",
  chip: "M9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3M5 5h14v14H5z",
  disk: "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  pin: "M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  tag: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
};

function Icon({ name }: { name: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d={ICONS[name] ?? ICONS.doc} />
    </svg>
  );
}

// Phase A : Sites, Contrats, Équipements et Logiciels sont actifs (PMO). `group` ne sert qu'à l'affichage.
const NAV: { label: string; href: string; enabled: boolean; roles?: string[]; icon: string; group: string }[] = [
  { label: "Tickets", href: "/tickets", enabled: true, roles: ["pmo"], icon: "ticket", group: "Support" },
  // Espace technicien (Phase 3b) : tickets de son équipe et membres.
  { label: "Mes tickets", href: "/my/tickets", enabled: true, roles: ["technician"], icon: "ticket", group: "Mon espace" },
  { label: "Mon équipe", href: "/my/team", enabled: true, roles: ["technician"], icon: "team", group: "Mon espace" },
  // Espace client (Phase 4) : lecture seule de SES tickets.
  { label: "Mes tickets", href: "/client/tickets", enabled: true, roles: ["client"], icon: "ticket", group: "Mon espace" },
  // Phase 2 : les équipes sont réservées au PMO (le backend refuse les autres rôles en 403).
  { label: "Équipes", href: "/teams", enabled: true, roles: ["pmo"], icon: "team", group: "Support" },
  // Phase 3 : invitations de techniciens (PMO uniquement ; le backend refuse les autres en 403).
  { label: "Invitations", href: "/invitations", enabled: true, roles: ["pmo"], icon: "mail", group: "Accès" },
  // Phase 4 : invitations de clients (page séparée, PMO uniquement).
  { label: "Invitations clients", href: "/client-invitations", enabled: true, roles: ["pmo"], icon: "mail", group: "Accès" },
  { label: "Utilisateurs", roles: ["pmo"], href: "/users", enabled: true, icon: "user", group: "Accès" },
  { label: "Solutions", roles: ["pmo"], href: "/solutions", enabled: true, icon: "bulb", group: "Référentiels" },
  { label: "Contrats", roles: ["pmo"], href: "/contracts", enabled: true, icon: "doc", group: "Référentiels" },
  { label: "Équipements", roles: ["pmo"], href: "/equipment", enabled: true, icon: "chip", group: "Référentiels" },
  { label: "Logiciels", roles: ["pmo"], href: "/equipment-softs", enabled: true, icon: "disk", group: "Référentiels" },
  { label: "Sites", roles: ["pmo"], href: "/sites", enabled: true, icon: "pin", group: "Référentiels" },
  { label: "Types de support", roles: ["pmo"], href: "/type-supports", enabled: true, icon: "tag", group: "Référentiels" },
  // Phase B+ : configuration d'envoi des emails (Gmail + mot de passe d'application), PMO uniquement.
  { label: "Paramètres mail", roles: ["pmo"], href: "/settings/mail", enabled: true, icon: "gear", group: "Configuration" },
];

const ROLE_LABELS: Record<string, string> = { pmo: "PMO", technician: "Technicien", client: "Client" };

export default function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false); // tiroir de navigation (tablette / mobile)

  // Le tiroir se referme à chaque changement de page.
  useEffect(() => setOpen(false), [pathname]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  const items = NAV.filter((item) => !item.roles || (user && item.roles.includes(user.authority)));
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "?";

  const nav = (
    <nav aria-label="Navigation principale" className="px-3 pb-4">
      {items.map((item, i) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const newGroup = i === 0 || items[i - 1].group !== item.group;
        return (
          <div key={item.href}>
            {newGroup && <div className="st-nav-section">{item.group}</div>}
            <Link href={item.href} className={`st-nav-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} onMouseEnter={() => warm(item.href)} onFocus={() => warm(item.href)}>
              <Icon name={item.icon} />
              {item.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Barre latérale (≥ md) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto md:flex" style={{ background: "var(--st-sidebar)" }}>
        <Link href={homeFor(user)} className="flex h-16 items-center gap-2 px-5 text-lg font-bold text-white no-underline">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-sm">ST</span>
          SmartTicket
        </Link>
        {nav}
      </aside>

      {/* Tiroir (< md) */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 overflow-y-auto" style={{ background: "var(--st-sidebar)" }}>
            <div className="flex h-16 items-center px-5 text-lg font-bold text-white">SmartTicket</div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="btn btn-outline-secondary !px-2.5 md:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700" aria-hidden="true">{initials}</span>
              <span className="hidden leading-tight sm:block">
                <span className="block font-medium text-slate-800">{user?.firstName} {user?.lastName}</span>
                <span className="block text-xs text-slate-500">{ROLE_LABELS[user?.authority ?? ""] ?? user?.authority}</span>
              </span>
            </div>
            <button onClick={handleLogout} className="btn btn-outline-secondary !px-3 !py-1.5">
              Déconnexion
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
