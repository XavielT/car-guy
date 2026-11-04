/**
 * Feature flags of the AI workflows (IMP 03112026 SPEC-G). Build-time constants with no imports, like flagsV8/flagsV10.
 *
 * Two layers, on purpose:
 *   - these constants decide whether the UI exists in a build at all;
 *   - `AI_FEATURES` (lib/ai/features.ts) lists the ids the admin can switch off at runtime from Admin → Uso y costos (server-enforced
 *     for the model-backed ones: the gateway refuses the call, so a stale app cannot spend).
 *
 * G3 (trips) and G8 (community) are deliberately NOT here: they have no AI hook to switch.
 */

/** G1 Smart search / quick add in Herramientas. */
export const FEATURE_AI_SEARCH = true;
/** G2 Album and build log photo understanding. Shipped ON; each person opts in on first use (AiAlbumConsent). */
export const FEATURE_AI_ALBUM = true;
/** G4 Google Places list. Default OFF (verdict D-04: Places ToS §14.2 and no right to persist its fields). The OSM source is not behind this. */
export const FEATURE_GOOGLE_PLACES = false;
/** G4 "find a shop near me" with the default OpenStreetMap source. */
export const FEATURE_PLACES_OSM = true;
/** G5 "paid vs reference" line and the receipt price offer. */
export const FEATURE_PRICE_ASSIST = true;
/** G6 photo on a `chequeo` item. */
export const FEATURE_AI_CHECK_PHOTO = true;
/** G7 accident event photos → description draft. */
export const FEATURE_AI_ACCIDENT = true;
/** G9 sale-ready summary in the Libro. */
export const FEATURE_AI_SALE_SUMMARY = true;
