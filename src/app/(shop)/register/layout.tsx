import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/session-token";

export default async function RegisterLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user?.status === "ACTIVE") redirect(ROLE_HOME[user.role]);
  return children;
}
