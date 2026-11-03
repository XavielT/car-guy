/**
 * Processing the Fuel Express offline queue (IMP 03112026 SPEC-B §B7.6). Dependency-injected so the rules are tested
 * without a database or a network:
 *
 *   · expired jobs (> 7 days) are dropped first, costing nothing;
 *   · each queued job is read in order; `ready` jobs keep the result and the person is notified;
 *   · NO CONNECTION (offline/timeout) stops the pass and leaves the job queued, WITHOUT consuming an attempt;
 *   · the gateway saying no (consent withdrawn, switched off, a cap, not signed in) also STOPS the pass: the rest would
 *     fail the same way, and the job stays queued for a better moment (the person can still go manual);
 *   · `unreadable` or `bad_input` is final: the job fails (one read cost money, retrying it would too);
 *   · anything else (provider hiccup) is retried up to AI_JOB_MAX_ATTEMPTS, then fails.
 */
import { AiError, type AiErrorCode } from './codes';
import { AI_JOB_MAX_ATTEMPTS, type AiJob } from '../db/aiQueueOps';

export type QueueDeps = {
  expire(): Promise<number>;
  listQueued(): Promise<AiJob[]>;
  markProcessing(id: string): Promise<void>;
  requeue(id: string): Promise<void>;
  retryLater(id: string, code: string): Promise<void>;
  markReady(id: string, resultJson: string): Promise<void>;
  markFailed(id: string, code: string): Promise<void>;
  /** Reads the job's photos through cg-ai-read (kind fuel_express); throws AiError. Returns the JSON-serialisable result. */
  read(job: AiJob): Promise<unknown>;
  /** "Tu carga está lista para confirmar". Failures here never fail the queue. */
  notifyReady(job: AiJob): Promise<void>;
};

export type QueueReport = { expired: number; ready: string[]; failed: string[]; stopped: AiErrorCode | null; remaining: number };

/** The gateway refusing is not about this job: stop and keep everything queued. */
const STOP_CODES: readonly AiErrorCode[] = [
  'offline', 'timeout', 'needs_account', 'no_auth', 'sesion_invalida', 'sin_consentimiento_ia', 'ai_disabled', 'ai_not_configured',
  'rate_user', 'cap_user_day', 'cap_global_day',
];
const FINAL_CODES: readonly AiErrorCode[] = ['unreadable', 'bad_input', 'forbidden'];

export async function processQueue(d: QueueDeps): Promise<QueueReport> {
  const report: QueueReport = { expired: await d.expire(), ready: [], failed: [], stopped: null, remaining: 0 };
  const jobs = await d.listQueued();

  for (const [i, job] of jobs.entries()) {
    if (job.attempts >= AI_JOB_MAX_ATTEMPTS) {
      await d.markFailed(job.id, job.errorCode ?? 'provider_error');
      report.failed.push(job.id);
      continue;
    }
    await d.markProcessing(job.id);
    try {
      const result = await d.read(job);
      await d.markReady(job.id, JSON.stringify(result));
      report.ready.push(job.id);
      try {
        await d.notifyReady(job);
      } catch {
        /* a missing notification permission must not undo a finished read */
      }
    } catch (e) {
      const code: AiErrorCode = e instanceof AiError ? e.code : 'internal';
      if (STOP_CODES.includes(code)) {
        await d.requeue(job.id); // not this job's fault: no attempt consumed
        report.stopped = code;
        report.remaining = jobs.length - i;
        return report;
      }
      if (FINAL_CODES.includes(code)) {
        await d.markFailed(job.id, code);
        report.failed.push(job.id);
      } else {
        await d.retryLater(job.id, code);
        report.remaining += 1;
      }
    }
  }
  return report;
}
