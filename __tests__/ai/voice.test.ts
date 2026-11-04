/**
 * IMP 03112026 SPEC-B §B3: the clip → what cg-stt accepts. The mime decision is the part that can silently break
 * transcription (D-18: no conversion, so the label must be right).
 */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/ai/client', () => ({ callAi: jest.fn() }));

import { AiError } from '@/lib/ai/codes';
import { callAi } from '@/lib/ai/client';
import { audioMime, base64Bytes, MAX_AUDIO_BYTES, MAX_RECORD_MS, transcribe } from '@/lib/ai/voice';

// The server's accepted list (supabase/functions/cg-stt/logic.ts AUDIO_MIMES), mirrored here so drift fails a test.
const SERVER_ACCEPTS = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/mpeg', 'audio/wav', 'audio/x-wav'];

describe('audioMime', () => {
  it.each([
    ['blob:https://app/abc', 'audio/webm;codecs=opus', 'audio/webm'],
    ['blob:https://app/abc', 'audio/mp4', 'audio/mp4'],
    ['blob:https://app/abc', 'video/webm', 'audio/webm'],
    ['blob:https://app/abc', 'video/mp4', 'audio/mp4'],
    ['file:///cache/rec-1.m4a', '', 'audio/mp4'],
    ['file:///cache/rec-1.m4a', null, 'audio/mp4'],
    ['file:///cache/rec.webm?x=1', undefined, 'audio/webm'],
    ['file:///cache/rec.wav', undefined, 'audio/wav'],
    ['file:///cache/rec.3gp', undefined, 'audio/mp4'],
    ['blob:no-extension', 'application/octet-stream', 'audio/mp4'],
  ])('%s + %j → %s', (uri, type, want) => {
    expect(audioMime(uri, type)).toBe(want);
  });
  it('everything it can return is something the server accepts', () => {
    for (const [uri, type] of [['a.m4a', ''], ['a.webm', ''], ['a.ogg', ''], ['a.wav', ''], ['a.mp3', ''], ['a.aac', ''], ['x', 'video/webm'], ['x', 'audio/webm;codecs=opus']] as const) {
      expect(SERVER_ACCEPTS).toContain(audioMime(uri, type));
    }
  });
});

describe('limits', () => {
  it('the recorder stops long before the server cap (30 s of AAC is far below 2 MB)', () => {
    expect(MAX_RECORD_MS).toBe(30_000);
    expect(MAX_AUDIO_BYTES).toBe(2_000_000);
    // HIGH_QUALITY m4a is 128 kbit/s: 30 s ≈ 480 kB
    expect((128_000 / 8) * (MAX_RECORD_MS / 1000)).toBeLessThan(MAX_AUDIO_BYTES);
  });
  it('base64Bytes sizes without decoding', () => {
    expect(base64Bytes('AAAA')).toBe(3);
    expect(base64Bytes('AAA=')).toBe(2);
    expect(base64Bytes('AA==')).toBe(1);
  });
});

describe('transcribe', () => {
  const call = callAi as jest.Mock;
  beforeEach(() => call.mockReset());

  it('returns the trimmed text and posts the clip to cg-stt', async () => {
    call.mockResolvedValue({ ok: true, text: '  eché doce galones  ' });
    await expect(transcribe({ audio: 'QUJD', mime: 'audio/mp4' })).resolves.toBe('eché doce galones');
    expect(call).toHaveBeenCalledWith('cg-stt', { audio: 'QUJD', mime: 'audio/mp4' });
  });
  it('an empty transcript is "unreadable", never an empty string the form would take', async () => {
    call.mockResolvedValue({ ok: true, text: '   ' });
    await expect(transcribe({ audio: 'QUJD', mime: 'audio/mp4' })).rejects.toMatchObject({ code: 'unreadable' });
  });
  it('a gateway error passes through with its stable code', async () => {
    call.mockRejectedValue(new AiError('cap_user_day'));
    await expect(transcribe({ audio: 'QUJD', mime: 'audio/mp4' })).rejects.toMatchObject({ code: 'cap_user_day' });
  });
});
