"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { homeFor } from "@/lib/home";
import { Spinner } from "@/components/ui";

// Racine : redirige vers l'espace du rôle connecté, ou vers /login sans session.
export default function Home() {
  const { ready, token, user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (ready) router.replace(token && user ? homeFor(user) : "/login");
  }, [ready, token, user, router]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner label="Chargement…" />
    </div>
  );
}
