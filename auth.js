'use strict';
/* HOLLOWCAST local accounts.
   Accounts live only on this device (browser storage, or the desktop app's profile).
   Passwords are never stored: only a salted PBKDF2 hash. This gates the editor, but it is
   not cloud sign-in. See README "Accounts" for how to plug in a real auth service. */

(() => {
  const ACCOUNTS = 'hollowcast.accounts';
  const SESSION = 'hollowcast.session';
  const $ = s => document.querySelector(s);
  const gate = $('#auth'), form = $('#authForm');
  const email = $('#authEmail'), pass = $('#authPass'), confirmPw = $('#authConfirm');
  const errEl = $('#authErr'), submit = $('#authSubmit'), switchBtn = $('#authSwitch');
  let mode = 'signup';

  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

  async function hashPw(pw, saltHex) {
    const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
    return hex(bits);
  }

  function setMode(m) {
    mode = m;
    const signup = m === 'signup';
    $('#authLead').textContent = signup ? 'Create an account to start editing.' : 'Sign in to keep editing.';
    $('#authConfirmRow').hidden = !signup;
    confirmPw.required = signup;
    submit.textContent = signup ? 'Create account' : 'Sign in';
    switchBtn.textContent = signup ? 'I already have an account' : 'Create a new account';
    pass.autocomplete = signup ? 'new-password' : 'current-password';
    errEl.hidden = true;
  }

  function lock(on) {
    gate.hidden = !on;
    document.querySelectorAll('header, main').forEach(el => { el.inert = on; });
    if (on) setTimeout(() => email.focus(), 50);
  }

  function signedIn(addr) {
    write(SESSION, addr);
    $('#who').textContent = addr;
    lock(false);
  }

  function fail(msg) {
    errEl.textContent = msg;
    errEl.hidden = false;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const addr = email.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return fail('Enter a valid email address.');
    if (pass.value.length < 8) return fail('Use at least 8 characters for the password.');
    if (!window.crypto || !crypto.subtle) return fail('This browser cannot hash passwords here. Open the app over https or use the desktop app.');
    const accounts = read(ACCOUNTS, {});
    submit.disabled = true;
    try {
      if (mode === 'signup') {
        if (accounts[addr]) return fail('An account with that email already exists on this device. Sign in instead.');
        if (pass.value !== confirmPw.value) return fail('The passwords do not match.');
        const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
        accounts[addr] = { salt, hash: await hashPw(pass.value, salt), created: new Date().toISOString() };
        if (!write(ACCOUNTS, accounts)) return fail('Could not save the account: storage is blocked.');
        signedIn(addr);
      } else {
        const acc = accounts[addr];
        if (!acc || (await hashPw(pass.value, acc.salt)) !== acc.hash) return fail('Wrong email or password.');
        signedIn(addr);
      }
      pass.value = confirmPw.value = '';
    } finally {
      submit.disabled = false;
    }
  });

  switchBtn.addEventListener('click', () => setMode(mode === 'signup' ? 'signin' : 'signup'));
  $('#signOut').addEventListener('click', () => {
    try { localStorage.removeItem(SESSION); } catch (e) { /* ignore */ }
    $('#who').textContent = '';
    setMode('signin');
    lock(true);
  });

  const accounts = read(ACCOUNTS, {});
  const session = read(SESSION, null);
  if (session && accounts[session]) {
    $('#who').textContent = session;
  } else {
    setMode(Object.keys(accounts).length ? 'signin' : 'signup');
    lock(true);
  }
})();
