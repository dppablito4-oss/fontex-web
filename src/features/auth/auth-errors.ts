export function readableAuthError(error: unknown): string {
  const item = error && typeof error === 'object' ? error as { message?: string; code?: string; status?: number } : {};
  const message = item.message?.toLowerCase() ?? '';
  switch (item.code) {
    case 'email_not_confirmed': return 'Confirma tu correo antes de iniciar sesión. Revisa también la carpeta de spam o solicita un nuevo enlace.';
    case 'invalid_credentials': return 'El correo o la contraseña no son correctos.';
    case 'user_already_exists': case 'email_exists': return 'Ese correo ya está registrado. Inicia sesión con tu contraseña.';
    case 'over_email_send_rate_limit': case 'over_request_rate_limit': return 'Se han hecho demasiados intentos. Espera unos minutos antes de volver a intentarlo.';
    case 'email_address_invalid': return 'Introduce un correo electrónico válido.';
    case 'weak_password': return 'La contraseña es demasiado débil. Usa al menos 8 caracteres y combina letras, números y símbolos.';
    case 'signup_disabled': return 'El registro de cuentas no está disponible en este momento.';
    case 'otp_expired': case 'access_denied': return 'El enlace de confirmación venció o ya fue utilizado. Solicita uno nuevo o inicia sesión si ya confirmaste tu correo.';
  }
  if (message.includes('email not confirmed')) return readableAuthError({ code: 'email_not_confirmed' });
  if (message.includes('invalid login credentials')) return readableAuthError({ code: 'invalid_credentials' });
  if (message.includes('already registered')) return readableAuthError({ code: 'user_already_exists' });
  if (item.status === 429 || message.includes('rate limit')) return readableAuthError({ code: 'over_request_rate_limit' });
  if (message.includes('fetch') || message.includes('network') || message.includes('timeout')) return 'No pudimos conectar con Fontex. Comprueba tu conexión e inténtalo de nuevo.';
  return 'No fue posible completar la solicitud. Inténtalo de nuevo en unos minutos.';
}

// No hash route here: Supabase's implicit callback uses the fragment for tokens.
export function confirmationRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}
