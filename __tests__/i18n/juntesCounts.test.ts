/** Junte counts read in the singular for one (2.5.1: "1 conectados", "1 carros"). */
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';

describe('junte counts', () => {
  it('online', () => {
    expect(es.juntes.online(1)).toBe('1 conectado');
    expect(es.juntes.online(3)).toBe('3 conectados');
    expect(en.juntes.online(1)).toBe('1 online');
  });

  it('summary', () => {
    expect(es.juntes.summaryText('Subida', 1, '12')).toBe('Junte "Subida" · 1 carro · 12 km juntos · Car Guy');
    expect(es.juntes.summaryText('Subida', 4, '12')).toBe('Junte "Subida" · 4 carros · 12 km juntos · Car Guy');
    expect(en.juntes.summaryText('Climb', 1, '12')).toBe('Junte "Climb" · 1 car · 12 km together · Car Guy');
  });
});
