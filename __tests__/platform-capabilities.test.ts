/** ADR-48: the iPhone PWA is told the truth — no background location there. */
import { canAutoTrips, classifyPlatform, isIosWeb } from '@/lib/platform/capabilities';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 13; M2101K6G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

it('the APK is android-native; only it can detect trips automatically', () => {
  expect(classifyPlatform({ os: 'android' })).toBe('android-native');
  expect(canAutoTrips('android-native')).toBe(true);
  expect(canAutoTrips('web-android')).toBe(false);
});
it('iPhone: Home-Screen app vs Safari tab', () => {
  expect(classifyPlatform({ os: 'web', userAgent: IPHONE, standalone: true })).toBe('web-ios-pwa');
  expect(classifyPlatform({ os: 'web', userAgent: IPHONE, standalone: false })).toBe('web-ios-safari');
  expect(isIosWeb('web-ios-pwa') && isIosWeb('web-ios-safari')).toBe(true);
});
it('an iPad that says "Macintosh" is told apart by touch points; a real Mac stays desktop', () => {
  expect(classifyPlatform({ os: 'web', userAgent: IPAD_AS_MAC, maxTouchPoints: 5, standalone: true })).toBe('web-ios-pwa');
  expect(classifyPlatform({ os: 'web', userAgent: IPAD_AS_MAC, maxTouchPoints: 0 })).toBe('web-desktop');
});
it('Android Chrome and desktop', () => {
  expect(classifyPlatform({ os: 'web', userAgent: ANDROID_CHROME })).toBe('web-android');
  expect(classifyPlatform({ os: 'web', userAgent: DESKTOP })).toBe('web-desktop');
});
