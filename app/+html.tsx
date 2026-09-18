import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

import { es } from '@/lib/i18n/es';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="es-DO">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* No <title> here on purpose: expo-router renders its own through
            react-helmet, ahead of anything static, and the first title in the
            document is the one that counts. Titles live on the Stack screens. */}
        <meta name="description" content={es.web.description} />
        <meta name="theme-color" content="#121212" />
        <link rel="icon" type="image/png" href="/favicon.png" />

        {/* PWA: installable on desktop and, via Add to Home Screen, on iPhone. */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content={es.app.name} />
        {/* Car Guy is dark by default, so the status bar blends into the panel
            instead of sitting on it as a light strip. */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        <script dangerouslySetInnerHTML={{ __html: registerServiceWorker }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Must equal the default scheme's bg.base. The app is dark unless the device
// asks for light, so painting the shell dark removes the white flash before the
// bundle mounts; light-preference devices get one frame of dark instead, which
// is the cheaper of the two.
const responsiveBackground = `
body {
  background-color: #121212;
}`;

// Registered from the shell rather than from a component: it should run on
// every exported route, and it has nothing to do with the React tree.
const registerServiceWorker = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}`;
