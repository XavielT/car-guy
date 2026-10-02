import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';

import { recordError } from '../diagnostics';
import { withDevHint } from '../diagnosticsMode';
import { t } from '../i18n';
import { checkMembership, isKnownMember, rememberMember } from './membership';
import { getSupabase, isCloudConfigured } from './supabase';

/**
 * Sign up, sign in, sign out — and nothing else.
 *
 * Phase 8 gives the account an existence; Phase 9 gives it a purpose. Nothing
 * here reads or writes vehicle data, and signing out leaves every local row
 * exactly where it was (ADR-05): the account is a way to get your history onto
 * a new phone, not the place your history lives.
 */

/** The `app` flag the invite trigger on x-core reads to let Car Guy signups through. */
export const APP_TAG = 'carguy';


export type AuthResult = { ok: true } | { ok: false; message: string };

const MIN_PASSWORD = 8;

function notConfigured(): AuthResult {
  recordError('auth', t.dev.notConfigured);
  return { ok: false, message: withDevHint(t.account.notConfigured, t.dev.notConfigured) };
}

/**
 * Supabase's messages are English and written for developers. These are the
 * ones a person can actually hit, in Spanish, saying what to do next.
 *
 * Matching on message text is fragile — supabase-js does not give stable codes
 * for most auth errors — so anything unrecognised falls through to a generic
 * line rather than being shown raw.
 */
export function translateAuthError(raw: string): string {
  const message = raw.toLowerCase();

  if (message.includes('invalid login credentials')) return t.account.errors.invalidCredentials;
  // x-core has email confirmation off (it is shared with Music Hub), so this
  // should not happen — but if the setting ever changes, say what to do.
  if (message.includes('email not confirmed')) return t.account.errors.emailNotConfirmed;
  if (message.includes('already registered') || message.includes('already been registered')) {
    return t.account.errors.userExists;
  }
  if (message.includes('password should be') || message.includes('weak password')) {
    return t.account.errors.weakPassword;
  }
  if (message.includes('email address') && message.includes('invalid')) {
    return t.account.errors.invalidEmail;
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return t.account.errors.rateLimited;
  }
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('failed to fetch')
  ) {
    return t.account.errors.network;
  }
  // The invite trigger on x-core. A Car Guy signup should never see it — if it
  // does, sql/001 has not been applied: plain to the admin, not to the user.
  if (message.includes('invite-only')) {
    recordError('auth', t.dev.inviteOnly);
    return withDevHint(t.account.errors.inviteOnly, t.dev.inviteOnly);
  }

  return t.account.errors.generic;
}

export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return notConfigured();
  if (password.length < MIN_PASSWORD) {
    return { ok: false, message: t.account.errors.weakPassword };
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      // Read by public.enforce_invite_only() on x-core (sql/001). It only opens
      // signup; it grants nothing, which is why a user-controlled field is fine
      // here.
      data: { app: APP_TAG, display_name: displayName?.trim() || null },
    },
  });

  if (error) return { ok: false, message: translateAuthError(error.message) };
  // The signup trigger has just given it a carguy.profiles row (sql/002).
  if (data.user) await rememberMember(data.user.id);
  // Signed straight in (x-core has e-mail confirmation off): the anonymous profile goes up.
  if (data.user && data.session) afterSignIn(data.user.id);
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) return { ok: false, message: translateAuthError(error.message) };

  // x-core accepts any of its accounts; Car Guy only its own (sql/018).
  const member = await checkMembership(supabase, data.user.id);
  if (member !== true) {
    await supabase.auth.signOut();
    return { ok: false, message: member === false ? t.account.errors.otherApp : t.account.errors.network };
  }
  afterSignIn(data.user.id);
  return { ok: true };
}

/**
 * The profile set up without an account uploads now; a phone with none takes
 * the account's (lib/profile.ts). Fire and forget, imported lazily: signing in
 * must not wait on a photo upload, and auth must not pull the media stack in.
 */
function afterSignIn(userId: string): void {
  void import('../profile')
    .then((profile) => profile.syncProfileOnSignIn(userId))
    .catch((error) => recordError('profile-sign-in', error));
}

/**
 * Signs out. Nothing else.
 *
 * The vehicles, fill-ups and photos stay. Wiping them here would make signing
 * out a destructive act, and the whole point of ADR-05 is that the account is
 * optional — something optional cannot take your data with it when it leaves.
 *
 * It also leaves `auth_user_id` and the pull cursors alone, which is less
 * obvious. That id is how `resetCursorsIfAccountChanged` tells "the same person
 * signed back in" from "someone else signed in here": clearing it would make
 * every sign-in look like a first one, and a *different* account would then
 * inherit the previous account's cursors and never see its own rows. The
 * cursors are only wiped when the account actually changes.
 */
export async function signOut(): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  // sql/039: this phone stops getting the account's junte pushes (needs the session, so before signOut).
  await import('../notifications/push').then((m) => m.unregisterPush()).catch(() => undefined);
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, message: translateAuthError(error.message) };
  // IMP 01102026 Phase 5: the next account must not see this one's follows (the table is cleared with the data).
  const { clearSocialMemory } = await import('../social/store');
  clearSocialMemory();
  return { ok: true };
}

/**
 * Where the reset link lands: `carguy://nueva-contrasena` in the app,
 * `<origin>/nueva-contrasena` on the web. Without `redirectTo` x-core sends the
 * link to its Site URL, which is Music Hub (2.1.2 did exactly that). Both
 * forms are in x-core's redirect allow list.
 */
export function resetRedirectUrl(): string {
  return Linking.createURL('/nueva-contrasena');
}

/**
 * Sends the password-reset email.
 *
 * The template is project-level on x-core and shared with Music Hub, so the
 * wording is whatever that template says. That is reported rather than fixed:
 * changing it would change Music Hub's email. The link itself comes back to
 * Car Guy, and app/nueva-contrasena.tsx refuses an account from another app.
 */
export async function resetPassword(email: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: resetRedirectUrl(),
  });
  if (error) return { ok: false, message: translateAuthError(error.message) };
  return { ok: true };
}

/** Set when any useSession() signs out another app's session; read by the next one. */
let rejectedOtherApp = false;

export type SessionState = {
  session: Session | null;
  /** False until the stored session has been read back from storage. */
  ready: boolean;
  configured: boolean;
  /**
   * A session from another x-core app was just signed out, so Cuenta can say
   * why instead of only showing the sign-in form.
   */
  otherApp: boolean;
};

/**
 * The current session, kept in step with `onAuthStateChange`.
 *
 * `ready` exists so the account screen can tell "signed out" from "we have not
 * looked yet" — without it, every launch flashes the signed-out state for as
 * long as it takes AsyncStorage to answer.
 */
export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isCloudConfigured);
  const [otherApp, setOtherApp] = useState(() => rejectedOtherApp);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    let cancelled = false;
    // Events are checked asynchronously; only the newest may win. Without this
    // a slow check of the old session finished after SIGNED_OUT and put the
    // account back on screen (seen on the Redmi, 2026-09-29).
    let latest = 0;

    // Only a Car Guy account's session reaches the app (and so sync). One from
    // another x-core app — a web tab signed in before 2.1.3, or a reset link
    // opened by a Music Hub user — is signed out; an unanswered check (offline,
    // never verified here) is simply not shown until it can be asked.
    const accept = async (next: Session | null) => {
      const mine = ++latest;
      if (next && !(await isKnownMember(next.user.id))) {
        const member = await checkMembership(supabase, next.user.id);
        if (member === false) {
          rejectedOtherApp = true;
          void supabase.auth.signOut();
        }
        if (member !== true) next = null;
      }
      if (cancelled || mine !== latest) return;
      if (next) rejectedOtherApp = false;
      setOtherApp(rejectedOtherApp);
      setSession(next);
      setReady(true);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => accept(data.session))
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      void accept(next);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { session, ready, configured: isCloudConfigured, otherApp };
}
