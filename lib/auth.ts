import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { Session } from "next-auth";

/** True once the three sign-in env vars are present. */
export const authConfigured = Boolean(
  process.env.AUTH_SECRET &&
    process.env.AUTH_GOOGLE_ID &&
    process.env.AUTH_GOOGLE_SECRET
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  trustHost: true,
});

/** auth() that returns null instead of crashing while sign-in isn't configured yet. */
export async function safeAuth(): Promise<Session | null> {
  if (!authConfigured) return null;
  try {
    return await auth();
  } catch {
    return null;
  }
}
