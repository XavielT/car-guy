import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { es } from '../i18n/es';
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
  return { ok: false, message: es.account.notConfigured };
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

  if (message.includes('invalid login credentials')) return es.account.errors.invalidCredentials;
  if (message.includes('already registered') || message.includes('already been registered')) {
    return es.account.errors.userExists;
  }
  if (message.includes('password should be') || message.includes('weak password')) {
    return es.account.errors.weakPassword;
  }
  if (message.includes('email address') && message.includes('invalid')) {
    return es.account.errors.invalidEmail;
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return es.account.errors.rateLimited;
  }
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('failed to fetch')
  ) {
    return es.account.errors.network;
  }
  // The invite trigger on x-core. A Car Guy signup should never see it — if it
  // does, sql/001 has not been applied, and that is worth saying plainly.
  if (message.includes('invite-only')) return es.account.errors.inviteOnly;

  return es.account.errors.generic;
}

export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return notConfigured();
  if (password.length < MIN_PASSWORD) {
    return { ok: false, message: es.account.errors.weakPassword };
  }

  const { error } = await supabase.auth.signUp({
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
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) return { ok: false, message: translateAuthError(error.message) };
  return { ok: true };
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

  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, message: translateAuthError(error.message) };
  return { ok: true };
}

/**
 * Sends the password-reset email.
 *
 * The template is project-level on x-core and shared with Music Hub, so the
 * message a Car Guy user receives is whatever Music Hub's template says. That
 * is reported rather than fixed: changing it would change Music Hub's email.
 */
export async function resetPassword(email: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) return { ok: false, message: translateAuthError(error.message) };
  return { ok: true };
}

export type SessionState = {
  session: Session | null;
  /** False until the stored session has been read back from storage. */
  ready: boolean;
  configured: boolean;
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

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { session, ready, configured: isCloudConfigured };
}
