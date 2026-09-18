import type { ErrorBoundaryProps } from 'expo-router';
import { Component, Fragment, type PropsWithChildren } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { fonts, palette, radius, space } from '@/constants/theme';
import { es } from '@/lib/i18n/es';

/**
 * What the user sees when the app cannot start, and — for one specific failure —
 * the thing that stops them seeing it at all.
 *
 * ## The OPFS handle race
 *
 * On the web the database lives in OPFS, and SQLite holds it open through a
 * `SyncAccessHandle` in a worker. Only one such handle may exist per file. When
 * a page reloads, the new document's worker asks for the handle while the old
 * document's worker may still be holding it — the browser tears the page down
 * before it releases the handle, and the two overlap:
 *
 *     NoModificationAllowedError: Failed to execute 'createSyncAccessHandle' …
 *     Access Handles cannot be created if there is another open Access Handle
 *
 * It is a race, so it is intermittent: a fast local reload usually wins, and a
 * slower one over HTTPS with a service worker in front of it loses. Caught on
 * the first reload of car-guy.vercel.app.
 *
 * ## Why the recovery is a page reload and not a remount
 *
 * The obvious fix — catch it, remount `SQLiteProvider`, open again — cannot
 * work, and it took a measurement to see why. `expo-sqlite`'s `getDatabaseAsync`
 * keeps the open promise in a module-level `databaseInstance`. On a cache miss
 * it builds the next attempt *on top of the previous promise*:
 *
 *     promise = databaseInstance.promise.then((db) => db.closeAsync()).then(open)
 *
 * There is no `.catch`. When the first open rejected, `.then` passes the
 * rejection straight through, so every later attempt in that document inherits
 * the original failure no matter how many times the tree is remounted. Verified:
 * pressing retry after the other tab had released the handle still failed, while
 * a fresh page load succeeded immediately.
 *
 * So on web the retry reloads the document, which is the only way to get a fresh
 * module scope and an unpoisoned cache. The count is kept in `sessionStorage` —
 * per tab, and it survives the reload, which is exactly the scope needed — so a
 * handle held by a *second* tab cannot turn this into a reload loop. Three tries,
 * then it stops and explains.
 *
 * Everything else is reported, in Spanish, over Car Guy's own background. The
 * default boundary renders black-on-white English with a raw stack trace, which
 * for a Dominican driver holding a phone is indistinguishable from the app being
 * gone.
 */

/** Three reload attempts at 300/700/1500 ms before giving the user the message. */
const RETRY_DELAYS = [300, 700, 1500];

const ATTEMPT_KEY = 'carguy.boot.attempts';

function isHandleRace(error: Error): boolean {
  const text = `${error.name} ${error.message}`;
  return (
    text.includes('NoModificationAllowedError') ||
    text.includes('createSyncAccessHandle') ||
    text.includes('Access Handles cannot be created')
  );
}

/**
 * How many times *this tab* has already reloaded trying to get the database
 * open. `sessionStorage` can throw in a private window, so every access is
 * guarded; a browser that refuses it simply never auto-reloads.
 */
function readAttempts(): number {
  if (Platform.OS !== 'web') return 0;
  try {
    return Number(window.sessionStorage.getItem(ATTEMPT_KEY) ?? '0') || 0;
  } catch {
    return RETRY_DELAYS.length;
  }
}

function writeAttempts(n: number): void {
  if (Platform.OS !== 'web') return;
  try {
    if (n === 0) window.sessionStorage.removeItem(ATTEMPT_KEY);
    else window.sessionStorage.setItem(ATTEMPT_KEY, String(n));
  } catch {
    // Nothing to do: without a counter the boundary just shows the message.
  }
}

/**
 * Forgets the retry budget once the app is actually running.
 *
 * Called from the shell, which only renders when the database opened. Without
 * this, a tab that recovered on its third try would start its next reload with
 * no attempts left.
 */
export function clearBootAttempts(): void {
  if (readAttempts() !== 0) writeAttempts(0);
}

/** The message. Presentational — the boundary decides whether to retry. */
export function BootError({
  error,
  retry,
  retrying = false,
}: ErrorBoundaryProps & { retrying?: boolean }) {
  // Mid-retry: the splash background, not a message. The page is about to
  // reload and the user reloaded it a moment ago anyway.
  if (retrying) return <View style={styles.blank} />;

  const locked = isHandleRace(error);

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="title" style={styles.brand}>
          {es.boot.brand}
        </T>
        <T face="title" style={styles.title}>
          {locked ? es.boot.lockedTitle : es.boot.crashTitle}
        </T>
        <T face="body" style={styles.body}>
          {locked ? es.boot.lockedBody : es.boot.crashBody}
        </T>

        <Pressable
          onPress={() => void retry()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}>
          <T face="semibold" style={styles.buttonLabel}>
            {es.boot.retry}
          </T>
        </Pressable>

        {/* Last, small, and in the developer's language, because it is for the
            developer. The two lines above are the ones the driver reads. */}
        <T face="mono" style={styles.detail}>
          {`${error.name}: ${error.message}`}
        </T>
      </ScrollView>
    </View>
  );
}

/**
 * Catches a database that would not open, reloads once or twice for the
 * recoverable case, and otherwise hands over to `BootError`.
 *
 * Sits directly around `SQLiteProvider` so the failure is caught next to where
 * it happens, and so the rest of the app is not implicated in a problem that a
 * reload solves.
 */
export class DatabaseBoundary extends Component<
  PropsWithChildren<unknown>,
  { error: Error | null; generation: number; reloading: boolean }
> {
  state = { error: null as Error | null, generation: 0, reloading: false };
  private timer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (Platform.OS !== 'web' || !isHandleRace(error)) return;

    const attempts = readAttempts();
    const delay = RETRY_DELAYS[attempts];
    // Out of budget: the handle is held by something that is not going away —
    // almost always a second Car Guy tab — and reloading again would only loop.
    if (delay === undefined) return;

    writeAttempts(attempts + 1);
    this.setState({ reloading: true });
    this.timer = setTimeout(() => window.location.reload(), delay);
  }

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
  }

  /** A press is the user's decision, so it starts the budget over. */
  private retry = async () => {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    writeAttempts(0);

    if (Platform.OS === 'web') {
      this.setState({ reloading: true });
      window.location.reload();
      return;
    }

    // Native: no OPFS and no page to reload, so remount and try once more.
    this.setState((s) => ({ error: null, generation: s.generation + 1 }));
  };

  render() {
    const { error, generation, reloading } = this.state;

    if (error) {
      return <BootError error={error} retry={this.retry} retrying={reloading} />;
    }

    return <Fragment key={generation}>{this.props.children}</Fragment>;
  }
}

// Plain StyleSheet against the dark palette rather than the theme hook: this
// renders when the tree above it has already failed, so it cannot assume a
// provider is mounted.
const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.dark.bg.base },
  blank: { flex: 1, backgroundColor: palette.dark.bg.base },
  pad: { padding: space.gutter, paddingTop: 96, maxWidth: 560, alignSelf: 'center', width: '100%' },
  brand: {
    fontFamily: fonts.title,
    fontSize: 11,
    letterSpacing: 1.5,
    color: palette.dark.accent,
  },
  title: {
    fontFamily: fonts.title,
    fontSize: 26,
    color: palette.dark.text.primary,
    marginTop: space.md,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    color: palette.dark.text.secondary,
    marginTop: space.md,
  },
  button: {
    marginTop: space.xl,
    backgroundColor: palette.dark.accent,
    borderRadius: radius.card,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonLabel: { color: palette.dark.accentInk, fontSize: 15 },
  detail: {
    marginTop: space.xl,
    fontSize: 11,
    lineHeight: 16,
    color: palette.dark.text.muted,
  },
});
