/**
 * app.json, plus the one thing a static file cannot know: which commit this is.
 *
 * Every field still lives in app.json — this file only reads it and appends
 * `extra.gitSha`, so there is one place to edit the app's identity and no risk
 * of the two drifting.
 *
 * The SHA comes from whichever builder is running, because none of them agree:
 * Vercel and EAS each inject their own variable, and a local `expo export` has
 * neither but does have a .git directory. A build that cannot find any of the
 * three ships without the line rather than failing — the version number is the
 * part that matters, and the SHA is for telling two builds of 2.0.0 apart.
 */
const { execSync } = require('node:child_process');

const appJson = require('./app.json');

function gitSha() {
  const fromCi = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.EAS_BUILD_GIT_COMMIT_HASH;
  if (fromCi) return fromCi.slice(0, 7);

  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

module.exports = () => ({
  ...appJson.expo,
  extra: { ...appJson.expo.extra, gitSha: gitSha() },
});
