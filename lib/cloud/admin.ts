import { useSession } from './auth';

/**
 * The one admin (ADR-35): Xaviel's account. The same predicate as the SQL in
 * sql/021_feedback.sql — `lower(auth.jwt() ->> 'email') = '…'` — so the app
 * shows "Comentarios recibidos" exactly when the server would answer it.
 * This is a convenience for the UI only; the server is what enforces it.
 */
export const ADMIN_EMAIL = 'tecnologia@constructorasd.com';

export function isAdminEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.toLowerCase() === ADMIN_EMAIL;
}

/** True while the signed-in Car Guy session is the admin's. */
export function useIsAdmin(): boolean {
  const { session } = useSession();
  return isAdminEmail(session?.user.email);
}
