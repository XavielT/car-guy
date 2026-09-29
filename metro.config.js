// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web is a Metro-bundled web worker running a wa-sqlite WASM
// build, so the .wasm has to be treated as an asset or the worker cannot load it.
config.resolver.assetExts.push('wasm');

// pdf-lib (the car book) imports tslib; Metro's package-exports resolution lands
// on tslib's ESM wrapper, whose `import tslib from '../tslib.js'` has no default
// under Metro's interop ("Cannot destructure property '__extends' of
// 'tslib.default'"). The plain ES build exports the helpers directly.
const resolveDefault = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'tslib') {
    // Beside the resolved main file (tslib's "exports" map hides the path from require.resolve).
    const main = require.resolve('tslib', { paths: [require('path').dirname(context.originModulePath)] });
    return { type: 'sourceFile', filePath: require('path').join(require('path').dirname(main), 'tslib.es6.js') };
  }
  return (resolveDefault ?? context.resolveRequest)(context, moduleName, platform);
};

// Cross-origin isolation for the dev server only.
//
// Car Guy uses the **async** SQLite API exclusively (ADR-02), which talks to the
// worker over postMessage and needs no SharedArrayBuffer — so the production
// build on Vercel needs no COOP/COEP headers, and vercel.json deliberately has
// none. These headers are here so that the sync API fails loudly rather than
// silently in dev if anyone ever reaches for it.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
