import { routeOf } from '@/lib/notifications';

const tap = (data?: unknown) => ({ notification: { request: { content: { data } } } });

describe('routeOf — notification deep links', () => {
  it('sends a pre-2.1 notification for the old Chequeo tab to the stack route', () => {
    expect(routeOf(tap({ route: '/(tabs)/chequeo' }))).toBe('/chequeo');
  });

  it('keeps current routes, including the weekly runner', () => {
    expect(routeOf(tap({ route: '/chequeo/carro_semanal/run' }))).toBe('/chequeo/carro_semanal/run');
    expect(routeOf(tap({ route: '/recordatorio/r1' }))).toBe('/recordatorio/r1');
  });

  it('ignores a notification with no route', () => {
    expect(routeOf(tap())).toBeNull();
    expect(routeOf(tap({ route: 42 }))).toBeNull();
  });
});
