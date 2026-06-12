import { cookies } from "next/headers";
import { safeAuth } from "./auth";
import { demoActive, DEMO_USER } from "./demo";

export type CurrentUser = { email: string; name: string; demo: boolean };

export const DEMO_SESSION_COOKIE = "demo-session";

/** The signed-in user — real Google session first, demo session as fallback. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await safeAuth();
  if (session?.user?.email) {
    return {
      email: session.user.email,
      name: session.user.name ?? session.user.email,
      demo: false,
    };
  }
  if (demoActive) {
    const jar = await cookies();
    if (jar.get(DEMO_SESSION_COOKIE)?.value === "1") return DEMO_USER;
  }
  return null;
}
