import { redirect } from "next/navigation";

// F1 : pas de dashboard. La racine redirige vers la liste des tickets
// (AuthGuard renverra vers /login si aucune session).
export default function Home() {
  redirect("/tickets");
}
