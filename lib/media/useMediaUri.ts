import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { getMedia, mediaUri } from './index';

/**
 * Resolves a media id to a renderable URI and cleans up after itself.
 *
 * The cleanup is the reason this is a hook. On web every call to `mediaUri`
 * mints an object URL, and an object URL that is never revoked pins its blob in
 * memory for the lifetime of the page — a garage screen scrolling through
 * vehicle photos would leak a few megabytes per pass.
 *
 * `{ thumb: true }` for grids and cards: the 400 px copy, downloaded on its own,
 * so a timeline never pulls full-size photos over the network.
 */
export function useMediaUri(mediaId: string | null | undefined, opts: { thumb?: boolean } = {}): string | null {
  const thumb = Boolean(opts.thumb);
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    (async () => {
      const item = await getMedia(mediaId);
      const resolved = await mediaUri(item, { thumb });
      if (cancelled) {
        // Resolved after unmount: revoke immediately, nothing will render it.
        if (resolved && Platform.OS === 'web') URL.revokeObjectURL(resolved);
        return;
      }
      created = resolved;
      setUri(resolved);
    })().catch(() => {
      if (!cancelled) setUri(null);
    });

    return () => {
      cancelled = true;
      if (created && Platform.OS === 'web') URL.revokeObjectURL(created);
    };
  }, [mediaId, thumb]);

  return uri;
}
