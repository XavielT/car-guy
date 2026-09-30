/**
 * Which failures the outbox keeps (retry next launch) and which it drops:
 * only Postgres data errors are final; a missing RPC (sql/021 not applied),
 * an expired token or no network are retried. rate_limited is its own case.
 */
jest.mock('@/lib/cloud/supabase', () => ({ getSupabase: () => null }));

import { classifyError, screenshotPath } from '@/lib/feedback/send';

describe('classifyError', () => {
  it.each([
    [{ code: 'P0001', message: 'rate_limited' }, 'rate_limited'],
    [{ code: '23514', message: 'new row violates check constraint "feedback_message_check"' }, 'rejected'],
    [{ code: '22023', message: 'device_id' }, 'rejected'],
    [{ code: 'PGRST202', message: 'Could not find the function carguy.submit_feedback' }, 'network'],
    [{ code: 'PGRST301', message: 'JWT expired' }, 'network'],
    [{ code: '', message: 'TypeError: Network request failed' }, 'network'],
  ])('%j → %s', (error, expected) => {
    expect(classifyError(error)).toBe(expected);
  });
});

it('names the object the bucket policy expects', () => {
  expect(screenshotPath('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111')).toBe(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/11111111-1111-4111-8111-111111111111.jpg',
  );
});
