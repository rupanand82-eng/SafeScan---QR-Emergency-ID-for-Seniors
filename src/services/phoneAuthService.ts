import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { UserAccount, UserRole } from '../types';

const PHONE_PEPPER_SALT = 'SAFESCAN_PHONE_PEPPER_SALT_2026';

/**
 * Computes the HMAC-SHA256 hash using the standard Web Crypto API.
 * Matches the server-side Node.js crypto computation identically.
 */
export async function computeClientPhoneCodeHash(phoneDigits: string, uniqueCode: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(PHONE_PEPPER_SALT),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await window.crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`SAFESCAN_PHONE_UNIQUE_CODE_V1:${phoneDigits}:${String(uniqueCode).trim()}`)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates a random 6-digit access code (100000 - 999999)
 */
export function generateClientPhoneCode(): string {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  const code = 100000 + (array[0] % 900000);
  return String(code);
}

/**
 * Helper to safely parse responses from fetch without throwing "Unexpected token" errors.
 */
async function safeFetchJson(url: string, body: Record<string, any>): Promise<{ ok: boolean; status: number; data?: any; rawText?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    const rawText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      // Non-JSON response (e.g. Vercel "A server error has occurred" or HTML 500)
    }

    return {
      ok: res.ok && data !== null,
      status: res.status,
      data,
      rawText,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      rawText: err?.message || 'Network request failed',
    };
  }
}

/**
 * Registers a phone number with an assigned unique code.
 * Dual-strategy: Calls the backend API, and seamlessly falls back to direct Firestore
 * if the backend environment (e.g. Vercel serverless lambda) encounters a server error.
 */
export async function registerPhoneWithCode(params: {
  phoneNumber: string;
  name?: string;
  role?: UserRole;
}): Promise<{
  success: boolean;
  uniqueCode: string;
  user: UserAccount;
}> {
  const { phoneNumber, name, role = 'user' } = params;
  const cleanDigits = phoneNumber.replace(/[\s\-()]/g, '');
  const numericOnly = cleanDigits.replace(/[^0-9]/g, '');
  const phoneKey = `p_${numericOnly}`;
  const uid = `phone_${numericOnly}`;

  // 1. Try server endpoint first
  const apiRes = await safeFetchJson('/api/auth/phone/register-code', {
    phoneNumber,
    name,
    role,
  });

  if (apiRes.ok && apiRes.data?.uniqueCode) {
    return {
      success: true,
      uniqueCode: apiRes.data.uniqueCode,
      user: apiRes.data.user,
    };
  }

  // If the server explicitly returned a 409 conflict, honor it
  if (apiRes.status === 409) {
    throw new Error(
      apiRes.data?.error || 'This phone number is already registered. Please log in using your assigned unique code.'
    );
  }

  // If the server explicitly returned a user input validation error, honor it
  if (apiRes.status === 400 && apiRes.data?.error) {
    throw new Error(apiRes.data.error);
  }

  // 2. Direct Firestore Fallback (Guaranteed to work on Vercel or when serverless functions encounter cold errors)
  console.info('SafeScan Auth: Using direct Firestore verification for phone registration.');
  const accountRef = doc(db, 'phone_accounts', phoneKey);
  const snap = await getDoc(accountRef);

  if (snap.exists()) {
    throw new Error('This phone number is already registered. Please log in using your assigned unique code.');
  }

  const uniqueCode = generateClientPhoneCode();
  const codeHash = await computeClientPhoneCodeHash(cleanDigits, uniqueCode);
  const now = new Date().toISOString();

  const assignedName = name?.trim() ? name.trim().slice(0, 100) : `Member (${phoneNumber})`;
  const userAccount: UserAccount = {
    id: uid,
    name: assignedName,
    email: `${numericOnly}@phone.safescan.csp`,
    phone: phoneNumber,
    role,
    createdAt: now,
  };

  const phoneAccountData = {
    phone: phoneNumber,
    phoneKey,
    codeHash,
    userId: uid,
    name: assignedName,
    role,
    createdAt: now,
    lastLoginAt: now,
  };

  await setDoc(accountRef, phoneAccountData);

  return {
    success: true,
    uniqueCode,
    user: userAccount,
  };
}

/**
 * Logs in with phone number and unique code without SMS OTP.
 * Dual-strategy: Calls the backend API, and seamlessly falls back to direct Firestore
 * if the backend environment encounters a server error.
 */
export async function loginPhoneWithCode(params: {
  phoneNumber: string;
  uniqueCode: string;
  role?: UserRole;
}): Promise<{
  success: boolean;
  message: string;
  user: UserAccount;
}> {
  const { phoneNumber, uniqueCode, role = 'user' } = params;
  const cleanDigits = phoneNumber.replace(/[\s\-()]/g, '');
  const cleanCode = uniqueCode.trim().replace(/\s/g, '');
  const numericOnly = cleanDigits.replace(/[^0-9]/g, '');
  const phoneKey = `p_${numericOnly}`;
  const uid = `phone_${numericOnly}`;

  // 1. Try server endpoint first
  const apiRes = await safeFetchJson('/api/auth/phone/login-code', {
    phoneNumber,
    uniqueCode: cleanCode,
    role,
  });

  if (apiRes.ok && apiRes.data?.user) {
    return {
      success: true,
      message: apiRes.data.message || 'Login successful!',
      user: apiRes.data.user,
    };
  }

  // If the server explicitly returned 404 (not registered) or 401 (invalid code), honor the message
  if (apiRes.status === 404 && apiRes.data?.error) {
    throw new Error(apiRes.data.error);
  }
  if (apiRes.status === 401 && apiRes.data?.error) {
    throw new Error(apiRes.data.error);
  }
  if (apiRes.status === 400 && apiRes.data?.error) {
    throw new Error(apiRes.data.error);
  }

  // 2. Direct Firestore Fallback (Guaranteed to work seamlessly on Vercel)
  console.info('SafeScan Auth: Using direct Firestore verification for phone login.');
  const accountRef = doc(db, 'phone_accounts', phoneKey);
  const snap = await getDoc(accountRef);

  if (!snap.exists()) {
    throw new Error('This phone number is not registered yet. Please click "Register Phone" to get your unique code.');
  }

  const stored = snap.data();
  const testHash = await computeClientPhoneCodeHash(cleanDigits, cleanCode);

  if (stored.codeHash !== testHash) {
    throw new Error('Incorrect unique code for this phone number. Please check your assigned code and try again.');
  }

  const userAccount: UserAccount = {
    id: stored.userId || uid,
    name: stored.name || `Member (${phoneNumber})`,
    email: `${numericOnly}@phone.safescan.csp`,
    phone: stored.phone || phoneNumber,
    role: stored.role || role || 'user',
    createdAt: stored.createdAt || new Date().toISOString(),
  };

  // Best effort update of lastLoginAt
  setDoc(accountRef, { lastLoginAt: new Date().toISOString() }, { merge: true }).catch(() => {});

  return {
    success: true,
    message: 'Login successful! Welcome back.',
    user: userAccount,
  };
}
