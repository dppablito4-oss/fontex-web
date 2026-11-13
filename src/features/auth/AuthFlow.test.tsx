import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { AuthPage } from './AuthPage';
import { App } from '../../app/App';
import { ThemeProvider } from '../theme/ThemeProvider';
const mocked = vi.hoisted(() => ({
  getSession: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), resend: vi.fn(),
  resetPasswordForEmail: vi.fn(), updateUser: vi.fn(),
  listener: null as null | ((event: string, session: unknown) => void),
}));
vi.mock('../../lib/supabase/client', () => ({ supabase: {
  auth: { ...mocked, onAuthStateChange: (callback: typeof mocked.listener) => { mocked.listener = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; } },
  from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'test-user', display_name: 'Estudiante' }, error: null }) }) }) }),
} }));
const session = { user: { id: 'test-user', user_metadata: { display_name: 'Estudiante' } }, access_token: 'test-only-token' };
function renderFlow(route = '/ingresar') {
  window.location.hash = `#${route}`;
  return render(<ThemeProvider><AuthProvider><HashRouter><App/></HashRouter></AuthProvider></ThemeProvider>);
}
async function fillSignIn() {
  await screen.findByRole('button', { name: 'Entrar a Fontex' });
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'student@example.com' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Testing-123!' } });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocked.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocked.signInWithPassword.mockResolvedValue({ data: { session }, error: null });
  mocked.signUp.mockResolvedValue({ data: { session: null, user: { id: 'test-user' } }, error: null });
  mocked.signOut.mockResolvedValue({ error: null }); mocked.resend.mockResolvedValue({ error: null });
  mocked.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  mocked.updateUser.mockResolvedValue({ data: { user: session.user }, error: null });
});
describe('Acceso completo a Fontex', () => {
  it('permite solicitar recuperación con retorno sin fragmento y sin revelar cuentas existentes', async () => {
    renderFlow();
    fireEvent.click(await screen.findByRole('link', { name: 'Olvidé mi contraseña' }));
    await screen.findByRole('heading', { name: 'Recupera tu cuenta' });
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'student@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Si existe una cuenta');
    expect(mocked.resetPasswordForEmail).toHaveBeenCalledWith('student@example.com', { redirectTo: 'http://localhost:3000/' });
  });
  it('no deja cambiar una contraseña desde un enlace sin sesión válida', async () => {
    renderFlow('/nueva-contrasena');
    expect(await screen.findByRole('button', { name: 'Guardar nueva contraseña' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Abre el enlace');
    expect(mocked.updateUser).not.toHaveBeenCalled();
  });
  it('abre el cambio de contraseña tras PASSWORD_RECOVERY y lo conserva al recargar la ruta', async () => {
    const view = renderFlow('/');
    await screen.findByRole('link', { name: 'Entrar' });
    act(() => mocked.listener?.('PASSWORD_RECOVERY', session));
    await screen.findByRole('heading', { name: 'Elige una nueva contraseña' });
    expect(window.location.hash).toBe('#/nueva-contrasena');
    view.unmount();
    mocked.getSession.mockResolvedValue({ data: { session }, error: null });
    renderFlow('/nueva-contrasena');
    expect(await screen.findByRole('button', { name: 'Guardar nueva contraseña' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'New-Test-123!' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'Different-123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no coinciden');
    expect(mocked.updateUser).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'New-Test-123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva contraseña' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Tu contraseña se actualizó');
    expect(mocked.updateUser).toHaveBeenCalledWith({ password: 'New-Test-123!' });
  });
  it('permite reintentar el envío de recuperación después de un error de SMTP', async () => {
    mocked.resetPasswordForEmail.mockResolvedValueOnce({ data: null, error: { status: 429 } });
    renderFlow('/recuperar-contrasena');
    const submit = await screen.findByRole('button', { name: 'Enviar enlace de recuperación' });
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'student@example.com' } });
    fireEvent.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent('demasiados intentos');
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(await screen.findByRole('status')).toHaveTextContent('Si existe una cuenta');
  });
  it('abre el acceso desde el lienzo y vuelve al lienzo con una sesión válida', async () => {
    renderFlow('/lienzo');
    fireEvent.click(await screen.findByRole('link', { name: 'Entrar' }));
    await fillSignIn();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar a Fontex' }));
    expect(await screen.findByRole('link', { name: 'Mi cuenta' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/lienzo');
    expect(mocked.signInWithPassword).toHaveBeenCalledWith({ email: 'student@example.com', password: 'Testing-123!' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('link', { name: 'Entrar' })).toBeInTheDocument();
  });
  it('crea una cuenta y explica la confirmación sin anunciar una sesión inexistente', async () => {
    renderFlow('/crear-cuenta');
    await screen.findByLabelText('Nombre visible');
    fireEvent.change(screen.getByLabelText('Nombre visible'), { target: { value: ' Estudiante ' } });
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Testing-123!' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'Testing-123!' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Crear cuenta' }).find(button => button.getAttribute('type') === 'submit')!);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('enlace para confirmar'));
    expect(mocked.signUp).toHaveBeenCalledWith({ email: 'student@example.com', password: 'Testing-123!', options: { data: { display_name: 'Estudiante' }, emailRedirectTo: 'http://localhost:3000/' } });
    expect(screen.getByRole('button', { name: 'Entrar a Fontex' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reenviar confirmación en/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });
  it('muestra el motivo real de un correo sin confirmar y permite solicitar otro enlace', async () => {
    mocked.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { code: 'email_not_confirmed', message: 'Email not confirmed' } });
    renderFlow(); await fillSignIn();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar a Fontex' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirma tu correo');
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar correo de confirmación' }));
    await waitFor(() => expect(mocked.resend).toHaveBeenCalledWith({ type: 'signup', email: 'student@example.com', options: { emailRedirectTo: 'http://localhost:3000/' } }));
    expect(await screen.findByRole('status')).toHaveTextContent('nuevo enlace de confirmación');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('rechaza contraseñas distintas sin registrar nada y limpia errores al cambiar de modo', async () => {
    renderFlow('/crear-cuenta'); await screen.findByLabelText('Nombre visible');
    fireEvent.change(screen.getByLabelText('Nombre visible'), { target: { value: 'Estudiante' } });
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Testing-123!' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'Testing-456!' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Crear cuenta' }).find(button => button.getAttribute('type') === 'submit')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('no coinciden'); expect(mocked.signUp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('recupera la sesión al recargar y permite salir del lienzo', async () => {
    mocked.getSession.mockResolvedValue({ data: { session }, error: null });
    renderFlow('/ingresar');
    expect(await screen.findByRole('link', { name: 'Mi cuenta' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/lienzo');
  });
  it('una falla de red no deja la pantalla verificando la sesión para siempre', async () => {
    mocked.getSession.mockRejectedValue(new Error('Failed to fetch'));
    renderFlow();
    expect(await screen.findByRole('button', { name: 'Entrar a Fontex' })).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Comprueba tu conexión');
  });
  it('una sesión inicial tardía no pisa un inicio de sesión más reciente', async () => {
    let resolveInitial!: (value: unknown) => void;
    mocked.getSession.mockImplementation(() => new Promise(resolve => { resolveInitial = resolve; }));
    renderFlow('/lienzo');
    act(() => mocked.listener?.('SIGNED_IN', session));
    expect(await screen.findByRole('link', { name: 'Mi cuenta' })).toBeInTheDocument();
    await act(async () => { resolveInitial({ data: { session: null }, error: null }); await Promise.resolve(); });
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toBeInTheDocument();
  });
  it('no impone el mínimo de registro a contraseñas antiguas al iniciar sesión', () => {
    render(<ThemeProvider><AuthProvider><AuthPage/></AuthProvider></ThemeProvider>);
    expect(screen.getByLabelText('Contraseña')).not.toHaveAttribute('minlength');
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('minlength', '8');
  });
});
