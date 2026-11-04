jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { mailtoFor, triageRequest } from '@/lib/ai/triage';

describe('admin triage, client side', () => {
  it('sends only the fields the function reads, never the sender’s email or ids', () => {
    const req = triageRequest({ kind: 'bug', message: 'Se cierra al guardar', screen: '/carga/nueva', app_version: '2.7.0', platform: 'android', email: 'a@b.com', user_id: 'u1' } as never);
    expect(req).toEqual({ kind: 'bug', message: 'Se cierra al guardar', screen: '/carga/nueva', appVersion: '2.7.0', platform: 'android' });
    expect(JSON.stringify(req)).not.toMatch(/a@b\.com|u1/);
  });
  it('the mail link carries the draft as the body, encoded; it is only a link until the admin opens it', () => {
    const url = mailtoFor('juan@x.com', 'Sobre tu comentario', 'Gracias. ¿Qué carro usas?');
    expect(url.startsWith('mailto:juan@x.com?subject=')).toBe(true);
    expect(decodeURIComponent(url.split('&body=')[1])).toBe('Gracias. ¿Qué carro usas?');
  });
});
