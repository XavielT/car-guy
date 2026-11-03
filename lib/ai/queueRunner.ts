/**
 * The real wiring of the Fuel Express offline queue (IMP 03112026 SPEC-B §B7.6): database operations, `cg-ai-read`, and
 * the local notification, handed to the tested `processQueue`. Single-flight: two screens asking at once share one pass.
 * Called when the Express screen opens, when Hoy comes into focus, and after a photo is queued. Costs nothing when the
 * queue is empty (one local query).
 */
import { notifyNow } from '../notifications';
import { expireOldJobs, listAiJobs, markFailed, markProcessing, markReady, requeue, retryLater } from '../db/aiQueueOps';
import { t } from '../i18n';
import { processQueue, type QueueReport } from './queue';
import { readImages } from './read';

let running: Promise<QueueReport> | null = null;

export function processAiQueue(): Promise<QueueReport> {
  if (running) return running;
  running = processQueue({
    expire: () => expireOldJobs(),
    listQueued: () => listAiJobs(['queued']),
    markProcessing,
    requeue,
    retryLater,
    markReady,
    markFailed,
    read: (job) => readImages('fuel_express', job.imagesB64.map((data) => ({ data, mime: 'image/jpeg' as const }))),
    notifyReady: (job) => notifyNow({ title: t.ai.express.readyTitle, body: t.ai.express.readyBody, route: `/carga/express?job=${job.id}` }),
  }).finally(() => {
    running = null;
  });
  return running;
}
