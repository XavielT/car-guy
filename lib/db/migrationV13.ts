/**
 * Schema v13 (IMP 03112026 Phase 2, SPEC-B §B7.6): the offline queue of Fuel Express.
 *
 *  - `ai_queue` — photos taken with no connection wait here until the phone is online, then the read happens and the
 *    person is told "Tu carga está lista para confirmar". LOCAL ONLY: not in the sync table list, never uploaded, wiped
 *    by "Borrar datos locales". Nothing is stored in the cloud by this table.
 *
 * `images_b64` holds the already-compressed JPEGs (1280 px) as a JSON array of base64 strings: durable on the phone AND
 * on the web, where a blob URL would not survive a reload. `image_uris` keeps where the compressed files were, so the
 * receipt/dashboard photos can still be attached to the saved fill-up when they are still there.
 * Items older than 7 days expire (SPEC-B §B7.6); an expired or dropped item costs nothing, since nothing was sent.
 *
 * (PROMPT-02 took v13 first; PROMPT-10's calibration columns become v14. Logged as decision D-18.)
 */
export function migrationV13(): string[] {
  return [
    `CREATE TABLE ai_queue (
       id TEXT PRIMARY KEY NOT NULL,
       kind TEXT NOT NULL CHECK (kind IN ('fuel_express')),
       vehicle_id TEXT NOT NULL,
       images_b64 TEXT NOT NULL,
       image_uris TEXT NOT NULL DEFAULT '[]',
       status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','ready','failed','dropped','expired')),
       attempts INTEGER NOT NULL DEFAULT 0,
       result_json TEXT,
       error_code TEXT,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL
     )`,
    `CREATE INDEX idx_ai_queue_status ON ai_queue(status, created_at)`,
  ];
}
