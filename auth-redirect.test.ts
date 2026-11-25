import { describe, expect, it } from 'vitest';
import { safeRedirect } from '@/lib/auth-redirect';

describe('safeRedirect', () => {
  it('keeps same-origin paths', () => {
    expect(safeRedirect('/dashboard')).toBe('/dashboard');
    expect(safeRedirect('/products')).toBe('/products');
  });
  it('blocks other sites', () => {
    expect(safeRedirect('//evil.example')).toBe('/dashboard');
    expect(safeRedirect('https://evil.example')).toBe('/dashboard');
    expect(safeRedirect('/\\evil.example')).toBe('/dashboard');
  });
  it('uses the fallback for non-strings', () => {
    expect(safeRedirect(undefined)).toBe('/dashboard');
  });
});

import { LOGIN_PATH, isLocalDevHost, loginReturnUrl } from '@/lib/auth-redirect';

describe('loginReturnUrl', () => {
  it('always points at the lowercase /login route', () => {
    expect(LOGIN_PATH).toBe('/login');
    expect(loginReturnUrl('http://localhost:8080')).toBe('http://localhost:8080/login');
    expect(loginReturnUrl('https://storva-identity-studio.lovable.app')).toBe('https://storva-identity-studio.lovable.app/login');
  });
  it('does not double the slash when the origin ends with one', () => {
    expect(loginReturnUrl('http://localhost:8080/')).toBe('http://localhost:8080/login');
  });
});

describe('isLocalDevHost', () => {
  it('detects developer machines, where Lovable’s OAuth broker is not served', () => {
    for (const h of ['localhost', 'LOCALHOST', 'app.localhost', '127.0.0.1', '::1', '[::1]', '192.168.1.20', '10.0.0.5', '172.16.4.2']) {
      expect(isLocalDevHost(h)).toBe(true);
    }
  });
  it('leaves hosted domains on the Lovable broker', () => {
    for (const h of ['storva-identity-studio.lovable.app', 'id-preview--abc.lovable.app', 'storva.example.com', '172.32.0.1']) {
      expect(isLocalDevHost(h)).toBe(false);
    }
  });
});

import { readAuthError } from '@/lib/auth-redirect';

describe('readAuthError', () => {
  it('returns null when the URL has no auth error', () => {
    expect(readAuthError('?redirect=/orders', '')).toBeNull();
  });
  it('explains a cancelled Google sign-in', () => {
    expect(readAuthError('?error=access_denied&error_description=User+cancelled', '')).toMatch(/cancelled/);
  });
  it('explains an expired email link sent back in the hash', () => {
    expect(readAuthError('', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')).toMatch(/expired/);
  });
});

describe('safeRedirect hardening', () => {
  it('blocks tricks browsers turn into another site', () => {
    expect(safeRedirect('/\t/evil.example')).toBe('/dashboard');
    expect(safeRedirect('/\n/evil.example')).toBe('/dashboard');
    expect(safeRedirect('/a\\b')).toBe('/dashboard');
    expect(safeRedirect('/' + 'a'.repeat(600))).toBe('/dashboard');
  });
  it('still allows normal paths with a query', () => {
    expect(safeRedirect('/orders?status=new')).toBe('/orders?status=new');
  });
});

import { forgetRememberedRedirect, readRememberedRedirect, rememberRedirect } from '@/lib/auth-redirect';
import { vi } from 'vitest';

describe('safeRedirect never targets the login page', () => {
  it('falls back instead of looping /login -> /login', () => {
    for (const v of ['/login', '/login?redirect=/login', '/login#x', '/Login', '/LOGIN/', '/%6Cogin']) {
      expect(safeRedirect(v)).toBe('/dashboard');
    }
  });
  it('still allows paths that merely start with login', () => {
    expect(safeRedirect('/login-help')).toBe('/login-help');
  });
});

describe('remembered redirect survives blocked storage', () => {
  it('round-trips when storage works', () => {
    rememberRedirect('/orders');
    expect(readRememberedRedirect()).toBe('/orders');
    forgetRememberedRedirect();
    expect(readRememberedRedirect()).toBeNull();
  });
  it('does not throw when sessionStorage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    vi.stubGlobal('sessionStorage', blocked);
    expect(() => rememberRedirect('/orders')).not.toThrow();
    expect(readRememberedRedirect()).toBeNull();
    expect(() => forgetRememberedRedirect()).not.toThrow();
    vi.unstubAllGlobals();
  });
});
