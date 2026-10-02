/**
 * patches/expo-location+57.0.20.patch: the web shim dispatches fixes by the subscriber's watch id (it used the
 * browser's, so a fix reached its callback only while the two counters agreed) and forwards errors (dropped).
 */
import ExpoLocationWeb from 'expo-location/build/ExpoLocation.web';
import { LocationEventEmitter } from 'expo-location/build/LocationEventEmitter';

type Cb = (p: unknown) => void;
const watches = new Map<number, { ok: Cb; err: Cb }>();
const cleared: number[] = [];

beforeAll(() => {
  let next = 40; // a browser counter that does not agree with expo-location's
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      geolocation: {
        watchPosition: (ok: Cb, err: Cb) => {
          const id = ++next;
          watches.set(id, { ok, err });
          return id;
        },
        clearWatch: (id: number) => cleared.push(id),
      },
    },
  });
});

const position = { coords: { latitude: 18.47, longitude: -69.93, accuracy: 5, altitude: null, altitudeAccuracy: null, heading: 0, speed: 15 }, timestamp: 1 };

it('a fix is emitted under the subscriber id, an error reaches the error event, remove clears the browser watch', async () => {
  const seen: unknown[] = [];
  const a = LocationEventEmitter.addListener('Expo.locationChanged', (e: unknown) => seen.push(e));
  const b = LocationEventEmitter.addListener('Expo.locationError', (e: unknown) => seen.push(e));
  await ExpoLocationWeb.watchPositionImplAsync(7, { enableHighAccuracy: true });
  const [browserId, w] = [...watches.entries()][0];
  w.ok(position);
  w.err({ code: 3, message: 'Timeout expired' });
  expect(seen).toEqual([
    { watchId: 7, location: expect.objectContaining({ coords: expect.objectContaining({ speed: 15, accuracy: 5 }) }) },
    { watchId: 7, reason: 'Timeout expired' },
  ]);
  await ExpoLocationWeb.removeWatchAsync(7);
  await ExpoLocationWeb.removeWatchAsync(7);
  expect(cleared).toEqual([browserId]);
  a.remove();
  b.remove();
});
