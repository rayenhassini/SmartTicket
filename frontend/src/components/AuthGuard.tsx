"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Spinner } from "./ui";

// Protège les routes authentifiées. Le token étant en localStorage (invisible côté serveur),
// la protection est faite côté client plutôt que par middleware Next.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { ready, token, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && (!token || !user)) router.replace("/login");
  }, [ready, token, user, router]);

  if (!ready || !token || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Chargement…" />
      </div>
    );
  }

  return <>{children}</>;
}
