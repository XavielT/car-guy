/**
 * lib/notifications/push.ts: the device token goes to register_push_token once per launch, never without the
 * permission, quietly nothing without Firebase; sign-out unregisters it.
 */
const mockRpc = jest.fn(async (..._args: unknown[]) => ({ ok: true, data: null }));
const mockGetToken = jest.fn(async (..._args: unknown[]) => ({ data: 'ExponentPushToken[abcdefghijklmnop]' }));
const mockHas = jest.fn(async () => true);
const mockRequest = jest.fn(async () => true);

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'proj-1' } } } }));
jest.mock('expo-notifications', () => ({ getExpoPushTokenAsync: (...a: unknown[]) => mockGetToken(...a) }));
jest.mock('../../lib/social/rpc', () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }));
jest.mock('../../lib/diagnostics', () => ({ recordError: jest.fn() }));
jest.mock('../../lib/notifications/index', () => ({ hasPermission: () => mockHas(), requestPermission: () => mockRequest() }));

import { registerPush, unregisterPush } from '../../lib/notifications/push';

beforeEach(async () => {
  await unregisterPush();
  jest.clearAllMocks();
});

it('registers the token with the project id, once per launch', async () => {
  await expect(registerPush()).resolves.toBe(true);
  await expect(registerPush()).resolves.toBe(true);
  expect(mockGetToken).toHaveBeenCalledWith({ projectId: 'proj-1' });
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(mockRpc).toHaveBeenCalledWith('register_push_token', { p_token: 'ExponentPushToken[abcdefghijklmnop]', p_platform: 'android' });
  expect(mockRequest).not.toHaveBeenCalled();
});

it('without the permission: asks only when told to, registers nothing otherwise', async () => {
  mockHas.mockResolvedValueOnce(false);
  await expect(registerPush()).resolves.toBe(false);
  expect(mockRpc).not.toHaveBeenCalled();
  await registerPush({ ask: true });
  expect(mockRequest).toHaveBeenCalledTimes(1);
});

it('no Firebase in the build: the token call throws and nothing is registered', async () => {
  mockGetToken.mockRejectedValueOnce(new Error('Default FirebaseApp is not initialized'));
  await expect(registerPush()).resolves.toBe(false);
  expect(mockRpc).not.toHaveBeenCalled();
});

it('sign-out unregisters the token, even one this launch did not register', async () => {
  await unregisterPush();
  expect(mockRpc).toHaveBeenCalledWith('unregister_push_token', { p_token: 'ExponentPushToken[abcdefghijklmnop]' });
});
