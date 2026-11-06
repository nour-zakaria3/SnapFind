import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/auth', () => ({ signIn: vi.fn(), signUp: vi.fn() }));
import { setLang } from '../src/i18n';
import { renderLogin } from '../src/ui/login';

describe('login screen', () => {
  it('renders Arabic labels by default and English after switching', () => {
    setLang('ar');
    expect(renderLogin(() => {}).textContent).toContain('تسجيل الدخول');
    setLang('en');
    expect(renderLogin(() => {}).textContent).toContain('Log in');
  });

  it('shows the error message when sign-in fails', async () => {
    const auth = await import('../src/auth');
    (auth.signIn as any).mockRejectedValueOnce(new Error('bad creds'));
    setLang('en');
    const form = renderLogin(() => {});
    (form.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(form.querySelector('.error')!.textContent).toBe('bad creds');
  });
});
