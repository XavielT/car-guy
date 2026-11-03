/**
 * The stable error codes of the AI gateway (IMP 03112026 ADR-66, SPEC-A §A3). The app translates `error_code`;
 * no provider text ever reaches the person. `message` is Spanish (the app's default) for the cases where a caller
 * without the app's i18n (curl, the admin) reads the body; the app uses its own es/en strings keyed by the code.
 */
export type AiErrorCode =
  | 'method_not_allowed'
  | 'no_auth'
  | 'sesion_invalida'
  | 'forbidden'
  | 'ai_disabled'
  | 'ai_not_configured'
  | 'sin_consentimiento_ia'
  | 'rate_user'
  | 'cap_user_day'
  | 'cap_global_day'
  | 'bad_input'
  | 'provider_error'
  | 'unreadable'
  | 'internal';

export const AI_ERRORS: Record<AiErrorCode, { status: number; message: string }> = {
  method_not_allowed: { status: 405, message: 'Método no permitido.' },
  no_auth: { status: 401, message: 'Inicia sesión para usar la IA.' },
  sesion_invalida: { status: 401, message: 'Tu sesión venció. Inicia sesión de nuevo.' },
  forbidden: { status: 403, message: 'No tienes permiso para esto.' },
  ai_disabled: { status: 503, message: 'La IA está apagada por ahora. Llena el formulario a mano.' },
  ai_not_configured: { status: 503, message: 'La IA todavía no está configurada. Llena el formulario a mano.' },
  sin_consentimiento_ia: { status: 403, message: 'Activa la IA en Cuenta > Privacidad para usarla.' },
  rate_user: { status: 429, message: 'Has usado mucho la IA en la última hora. Intenta en un rato o llena a mano.' },
  cap_user_day: { status: 429, message: 'Llegaste al tope de IA de hoy. Mañana vuelve; mientras, llena a mano.' },
  cap_global_day: { status: 429, message: 'La IA llegó a su tope de hoy para todos. Llena a mano; mañana vuelve.' },
  bad_input: { status: 400, message: 'Los datos enviados no son válidos.' },
  provider_error: { status: 502, message: 'No se pudo contactar el servicio de IA. Llena a mano o reintenta.' },
  unreadable: { status: 422, message: 'No se pudo leer. Intenta otra foto o llena a mano.' },
  internal: { status: 500, message: 'Algo falló de nuestro lado. Llena a mano.' },
};

export type AiBody = { ok: false; error: string; error_code: AiErrorCode };

export function errorBody(code: AiErrorCode): AiBody {
  return { ok: false, error: AI_ERRORS[code].message, error_code: code };
}
