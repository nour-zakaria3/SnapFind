import { beforeEach, describe, expect, it } from 'vitest';
import { setLang, t } from '../src/i18n';

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear();
    setLang('ar');
  });

  it('returns Arabic by default', () => {
    expect(t('login')).toBe('تسجيل الدخول');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it("setLang('en') switches strings and sets document.dir to ltr", () => {
    setLang('en');
    expect(t('login')).toBe('Log in');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });

  it('missing key returns the key itself', () => {
    expect(t('no_such_key')).toBe('no_such_key');
  });
});
