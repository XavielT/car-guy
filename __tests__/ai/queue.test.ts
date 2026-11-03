/**
 * IMP 03112026 SPEC-B §B7.6: the rules of the Fuel Express offline queue, with fakes (no db, no network).
 */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { AiError } from '@/lib/ai/codes';
import { processQueue, type QueueDeps } from '@/lib/ai/queue';
import { AI_JOB_MAX_ATTEMPTS, type AiJob } from '@/lib/db/aiQueueOps';

const mk = (id: string, over: Partial<AiJob> = {}): AiJob => ({
  id, kind: 'fuel_express', vehicleId: 'v', imagesB64: ['AAAA'], imageUris: [], status: 'queued', attempts: 0,
  resultJson: null, errorCode: null, createdAt: 't', updatedAt: 't', ...over,
});

function deps(jobs: AiJob[], read: (j: AiJob) => Promise<unknown>) {
  const log: string[] = [];
  const d: QueueDeps = {
    expire: async () => 0,
    listQueued: async () => jobs,
    markProcessing: async (id) => void log.push(`processing:${id}`),
    requeue: async (id) => void log.push(`requeue:${id}`),
    retryLater: async (id, code) => void log.push(`retry:${id}:${code}`),
    markReady: async (id) => void log.push(`ready:${id}`),
    markFailed: async (id, code) => void log.push(`failed:${id}:${code}`),
    read,
    notifyReady: async (j) => void log.push(`notify:${j.id}`),
  };
  return { d, log };
}

describe('processQueue', () => {
  it('reads every job in order, keeps the result and notifies', async () => {
    const { d, log } = deps([mk('a'), mk('b')], async (j) => ({ id: j.id }));
    const r = await processQueue(d);
    expect(r.ready).toEqual(['a', 'b']);
    expect(log).toEqual(['processing:a', 'ready:a', 'notify:a', 'processing:b', 'ready:b', 'notify:b']);
  });

  it('NO CONNECTION stops the pass, requeues WITHOUT an attempt, and leaves later jobs untouched', async () => {
    const { d, log } = deps([mk('a'), mk('b')], async () => {
      throw new AiError('offline');
    });
    const r = await processQueue(d);
    expect(r.stopped).toBe('offline');
    expect(r.remaining).toBe(2);
    expect(log).toEqual(['processing:a', 'requeue:a']); // b never touched, no retry:/failed: (no attempt consumed)
  });

  it.each(['sin_consentimiento_ia', 'ai_disabled', 'cap_user_day', 'rate_user', 'cap_global_day', 'needs_account', 'timeout'] as const)(
    'the gateway saying %s stops the whole pass and keeps the job queued',
    async (code) => {
      const { d, log } = deps([mk('a'), mk('b')], async () => {
        throw new AiError(code);
      });
      const r = await processQueue(d);
      expect(r.stopped).toBe(code);
      expect(log).toEqual(['processing:a', 'requeue:a']);
    },
  );

  it.each(['unreadable', 'bad_input'] as const)('%s is final: the job fails and the pass goes on', async (code) => {
    const { d, log } = deps([mk('a'), mk('b')], async (j) => {
      if (j.id === 'a') throw new AiError(code);
      return { ok: 1 };
    });
    const r = await processQueue(d);
    expect(r.failed).toEqual(['a']);
    expect(r.ready).toEqual(['b']);
    expect(log).toContain(`failed:a:${code}`);
  });

  it('a provider hiccup is retried (an attempt is consumed) and the pass goes on', async () => {
    const { d, log } = deps([mk('a'), mk('b')], async (j) => {
      if (j.id === 'a') throw new AiError('provider_error');
      return {};
    });
    const r = await processQueue(d);
    expect(log).toContain('retry:a:provider_error');
    expect(r.ready).toEqual(['b']);
    expect(r.stopped).toBeNull();
  });

  it('a job that already used its attempts fails without another paid call', async () => {
    const read = jest.fn();
    const { d, log } = deps([mk('a', { attempts: AI_JOB_MAX_ATTEMPTS, errorCode: 'provider_error' })], read);
    const r = await processQueue(d);
    expect(read).not.toHaveBeenCalled();
    expect(log).toEqual(['failed:a:provider_error']);
    expect(r.failed).toEqual(['a']);
  });

  it('an unexpected error is treated as a hiccup, never a crash', async () => {
    const { d, log } = deps([mk('a')], async () => {
      throw new Error('boom');
    });
    await expect(processQueue(d)).resolves.toBeDefined();
    expect(log).toContain('retry:a:internal');
  });

  it('a failing notification never undoes a finished read', async () => {
    const { d, log } = deps([mk('a')], async () => ({ ok: 1 }));
    d.notifyReady = async () => {
      throw new Error('no permission');
    };
    const r = await processQueue(d);
    expect(r.ready).toEqual(['a']);
    expect(log).toContain('ready:a');
  });

  it('reports how many expired first, costing nothing', async () => {
    const { d } = deps([], async () => ({}));
    d.expire = async () => 3;
    expect((await processQueue(d)).expired).toBe(3);
  });
});
