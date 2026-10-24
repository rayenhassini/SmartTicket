"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { homeFor } from "@/lib/home";
import { useAuth } from "@/context/auth-context";
import { Spinner } from "./ui";

// Protège les routes authentifiées. Le token étant en localStorage (invisible côté serveur),
// la protection est faite côté client plutôt que par middleware Next.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { ready, token, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Aiguillage par rôle (confort de navigation uniquement : l'API refuse de toute façon hors périmètre).
  const home = user ? homeFor(user) : null;
  const inTechSpace = pathname === "/my" || pathname.startsWith("/my/");
  const misplaced =
    !!user && ((user.authority === "technician" && !inTechSpace) || (user.authority === "pmo" && inTechSpace));

  useEffect(() => {
    if (ready && (!token || !user)) router.replace("/login");
    else if (ready && misplaced && home) router.replace(home);
  }, [ready, token, user, misplaced, home, router]);

  if (!ready || !token || !user || misplaced) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Chargement…" />
      </div>
    );
  }

  return <>{children}</>;
}
