"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

import { Button } from "@/components/ui";
import { apiJson } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebaseClient";

export default function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    if (firebaseAuth) {
      try {
        await signOut(firebaseAuth);
      } catch {
        // Continue; backend cookie logout still needs to run.
      }
    }
    await apiJson<{ ok: boolean }>("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <Button type="button" variant="plate" size="sm" onClick={onLogout}>
      Log out
    </Button>
  );
}
