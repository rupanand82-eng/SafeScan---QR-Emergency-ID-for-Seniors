import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import {
  SeniorProfile,
  EmergencyReport,
  DuplicateRegistrationResponse,
  CaregiverAccessRequest,
} from '../types';

export const DEMO_PROFILE_IDS = [
  'SS-1001',
  'SAFE-DEMO-7892',
  'demo-senior-ravi-kumar',
  'DEMO-SENIOR-RAVI-KUMAR',
];

/**
 * Extracts and normalizes SafeScan ID from raw scanner text, universal emergency card QR text, or full URL.
 * Handles formats:
 * - Multi-line Universal Emergency Card QR text containing "ID: SAFE-0AIK13"
 * - https://domain.com/emergency/SAFE-0AIK13
 * - https://domain.com/#/emergency/SAFE-0AIK13
 * - /emergency/SAFE-0AIK13
 * - SAFE-0AIK13
 * - safe-0aik13
 */
export function extractSafeScanId(input: string): string {
  if (!input) return '';
  let cleaned = input.trim();
  try {
    cleaned = decodeURIComponent(cleaned);
  } catch {
    // Keep raw if percent-decoding fails
  }

  // 1. Check for explicit "ID: SAFE-XXXXXX" or "SafeScan ID: SAFE-XXXXXX" in multi-line QR text
  const idLineMatch = cleaned.match(/(?:SafeScan\s*ID|Patient\s*ID|ID)\s*:\s*([A-Za-z0-9_-]+)/i);
  if (idLineMatch && idLineMatch[1]) {
    return idLineMatch[1].trim().toUpperCase();
  }

  // 2. Check for standard SAFE-XXXXXX or SS-XXXX token anywhere in text or URL
  const tokenMatch = cleaned.match(/\b(SAFE-[A-Za-z0-9]{4,12}|SS-[0-9]{3,10})\b/i);
  if (tokenMatch && tokenMatch[1]) {
    return tokenMatch[1].trim().toUpperCase();
  }

  // Remove surrounding quotes or whitespace
  cleaned = cleaned.replace(/^["']|["']$/g, '').trim();

  // 3. If text contains /emergency/
  if (cleaned.includes('/emergency/')) {
    const parts = cleaned.split('/emergency/');
    cleaned = parts[parts.length - 1];
  }

  // Remove query params, hash fragments, or trailing lines
  cleaned = cleaned.split('\n')[0].split('?')[0].split('#')[0].replace(/\/+$/, '').trim();

  // If it's a URL or path, take the final segment
  if (cleaned.includes('/')) {
    const segments = cleaned.split('/').filter(Boolean);
    if (segments.length > 0) {
      cleaned = segments[segments.length - 1];
    }
  }

  cleaned = cleaned.trim();

  // Normalize case: IDs like SAFE-0AIK13 or SS-1001 are uppercase
  if (/^(safe|ss)[-_]/i.test(cleaned) || /^[a-z0-9_-]+$/i.test(cleaned)) {
    return cleaned.toUpperCase();
  }

  return cleaned;
}

// Backward-compatible alias
export const extractPatientId = extractSafeScanId;

/**
 * Generates a unique SafeScan ID in format SAFE-XXXXXX (e.g. SAFE-0AIK13)
 */
export function generateSafeScanId(): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SAFE-${randomPart}`;
}

/**
 * Local storage caching helpers for offline resilience
 */
function cacheProfileLocally(profile: SeniorProfile): void {
  if (profile.isDemo) return;
  try {
    const keys = [
      profile.safeScanId,
      profile.patientId,
      profile.qrToken,
      profile.id,
    ].filter(Boolean) as string[];

    keys.forEach((k) => {
      localStorage.setItem(`safescan_patient_${k.toUpperCase()}`, JSON.stringify(profile));
      localStorage.setItem(`safescan_patient_${k}`, JSON.stringify(profile));
    });

    // Also update all-seniors list in localStorage
    const stored = localStorage.getItem('safescan_all_profiles');
    let list: SeniorProfile[] = stored ? JSON.parse(stored) : [];
    const idx = list.findIndex(
      (p) =>
        p.id === profile.id ||
        p.safeScanId === profile.safeScanId ||
        p.patientId === profile.patientId
    );
    if (idx >= 0) {
      list[idx] = profile;
    } else {
      list.push(profile);
    }
    localStorage.setItem('safescan_all_profiles', JSON.stringify(list));
  } catch {}
}

function getProfileFromLocalStorage(candidateIds: string[]): SeniorProfile | null {
  try {
    for (const cid of candidateIds) {
      const cached =
        localStorage.getItem(`safescan_patient_${cid}`) ||
        localStorage.getItem(`safescan_patient_${cid.toUpperCase()}`) ||
        localStorage.getItem(`safescan_patient_${cid.toLowerCase()}`);
      if (cached) {
        const parsed = JSON.parse(cached) as SeniorProfile;
        if (!parsed.isDemo) return parsed;
      }
    }

    // Check in all profiles array
    const stored = localStorage.getItem('safescan_all_profiles');
    if (stored) {
      const list: SeniorProfile[] = JSON.parse(stored);
      for (const cid of candidateIds) {
        const needle = cid.toUpperCase();
        const found = list.find(
          (p) =>
            !p.isDemo &&
            ((p.safeScanId && p.safeScanId.toUpperCase() === needle) ||
              (p.patientId && p.patientId.toUpperCase() === needle) ||
              (p.qrToken && p.qrToken.toUpperCase() === needle) ||
              (p.qrId && p.qrId.toUpperCase() === needle) ||
              (p.id && p.id.toUpperCase() === needle))
        );
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

/**
 * Clean up all mock / demo profiles from localStorage and Firestore
 */
export async function cleanupDemoProfiles(): Promise<void> {
  // 1. Clean localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      DEMO_PROFILE_IDS.forEach((id) => {
        localStorage.removeItem(`safescan_patient_${id}`);
        localStorage.removeItem(`safescan_patient_${id.toUpperCase()}`);
        localStorage.removeItem(`safescan_patient_${id.toLowerCase()}`);
      });

      // If SAFE-0AIK13 was cached as demo, remove it
      const cachedSafe = localStorage.getItem('safescan_patient_SAFE-0AIK13');
      if (cachedSafe) {
        try {
          const parsed = JSON.parse(cachedSafe);
          if (parsed.isDemo) {
            localStorage.removeItem('safescan_patient_SAFE-0AIK13');
          }
        } catch {}
      }

      const stored = localStorage.getItem('safescan_all_profiles');
      if (stored) {
        const all: SeniorProfile[] = JSON.parse(stored);
        const filtered = all.filter(
          (p) =>
            !p.isDemo &&
            !DEMO_PROFILE_IDS.includes(p.id?.toUpperCase()) &&
            !DEMO_PROFILE_IDS.includes(p.safeScanId?.toUpperCase())
        );
        localStorage.setItem('safescan_all_profiles', JSON.stringify(filtered));
      }
    } catch (e) {
      console.warn('Local cleanup error:', e);
    }
  }

  // 2. Clean Firestore demo documents if present
  try {
    for (const id of ['SS-1001', 'demo-senior-ravi-kumar', 'SAFE-DEMO-7892']) {
      try {
        const snap = await getDoc(doc(db, 'senior_profiles', id));
        if (snap.exists()) {
          const data = snap.data();
          if (data?.isDemo || data?.fullName === 'Ramesh Kumar') {
            await deleteDoc(doc(db, 'senior_profiles', id));
          }
        }
      } catch {}
    }

    try {
      const snap = await getDoc(doc(db, 'senior_profiles', 'SAFE-0AIK13'));
      if (snap.exists() && snap.data()?.isDemo) {
        await deleteDoc(doc(db, 'senior_profiles', 'SAFE-0AIK13'));
      }
    } catch {}
  } catch (err) {
    console.warn('Firestore demo cleanup error:', err);
  }
}

// Backward compatibility alias so callers don't break
export const ensureDemoSeniorCreated = cleanupDemoProfiles;

/**
 * Generates the next sequential unique Patient ID in the format SAFE-XXXXXX
 */
export async function getNextPatientId(): Promise<string> {
  return generateSafeScanId();
}

/**
 * Retrieves a patient's emergency medical profile from Firestore using the extracted SafeScan ID.
 * Follows resolution chain:
 * 1. Primary: Direct document fetch by document ID
 * 2. Secondary: Query by safeScanId field
 * 3. Tertiary: Query by patientId field
 * 4. Quaternary: Query by qrToken field
 * 5. Quinary: Query by qrId field
 * 6. Collection scan with case-insensitive comparison
 * 7. LocalStorage cached fallback
 */
export async function getSeniorProfile(idOrToken: string): Promise<SeniorProfile | null> {
  const safeScanId = extractSafeScanId(idOrToken);
  if (!safeScanId) return null;

  const upperId = safeScanId.toUpperCase();
  const rawId = safeScanId;
  const candidateIds = Array.from(new Set([upperId, rawId]));

  // 1. Primary lookup: Direct document fetch by document ID
  for (const cid of candidateIds) {
    try {
      const docRef = doc(db, 'senior_profiles', cid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as SeniorProfile;
        if (!data.isDemo) {
          cacheProfileLocally(data);
          return data;
        }
      }
    } catch (error) {
      console.warn(`Direct fetch for candidate ID ${cid} failed:`, error);
    }
  }

  // 2. Secondary lookups: Query by safeScanId, patientId, qrToken, qrId, id
  const queryFields = ['safeScanId', 'patientId', 'qrToken', 'qrId', 'id'];
  for (const field of queryFields) {
    for (const val of candidateIds) {
      try {
        const q = query(collection(db, 'senior_profiles'), where(field, '==', val));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          for (const d of querySnap.docs) {
            const docData = d.data() as SeniorProfile;
            if (!docData.isDemo) {
              cacheProfileLocally(docData);
              return docData;
            }
          }
        }
      } catch (err) {
        // Continue
      }
    }
  }

  // 3. Collection scan fallback with case-insensitive comparison
  try {
    const allSnap = await getDocs(collection(db, 'senior_profiles'));
    for (const docSnap of allSnap.docs) {
      const data = docSnap.data() as SeniorProfile;
      if (data.isDemo) continue;
      const sId = (data.safeScanId || '').toUpperCase();
      const pId = (data.patientId || '').toUpperCase();
      const qToken = (data.qrToken || '').toUpperCase();
      const qId = (data.qrId || '').toUpperCase();
      const docId = docSnap.id.toUpperCase();

      if (
        docId === upperId ||
        sId === upperId ||
        pId === upperId ||
        qToken === upperId ||
        qId === upperId
      ) {
        cacheProfileLocally(data);
        return data;
      }
    }
  } catch (error) {
    console.warn('Collection scan fallback failed:', error);
  }

  // 4. Local storage offline/resilience fallback
  const localResult = getProfileFromLocalStorage(candidateIds);
  if (localResult && !localResult.isDemo) {
    return localResult;
  }

  return null;
}

export async function getSeniorsByUserId(userId: string): Promise<SeniorProfile[]> {
  const path = 'senior_profiles';
  try {
    const querySnap = await getDocs(collection(db, path));
    const list = querySnap.docs
      .map((d) => d.data() as SeniorProfile)
      .filter(
        (p) =>
          !p.isDemo &&
          !DEMO_PROFILE_IDS.includes(p.id?.toUpperCase()) &&
          (p.userId === userId ||
            (Array.isArray(p.linkedCaregiverIds) && p.linkedCaregiverIds.includes(userId)))
      );
    list.forEach(cacheProfileLocally);
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function getAllSeniors(): Promise<SeniorProfile[]> {
  const path = 'senior_profiles';
  try {
    const querySnap = await getDocs(collection(db, path));
    const list = querySnap.docs
      .map((d) => d.data() as SeniorProfile)
      .filter((p) => !p.isDemo && !DEMO_PROFILE_IDS.includes(p.id?.toUpperCase()));
    list.forEach(cacheProfileLocally);
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    // Fallback to local storage
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('safescan_all_profiles');
      if (stored) {
        const all: SeniorProfile[] = JSON.parse(stored as string);
        return all.filter(
          (p) => !p.isDemo && !DEMO_PROFILE_IDS.includes(p.id?.toUpperCase())
        );
      }
    }
    return [];
  }
}

/**
 * Saves or updates a patient profile in Firestore under their unique SafeScan ID.
 * Guarantees that:
 * - id: safeScanId
 * - safeScanId: safeScanId
 * - patientId: safeScanId
 * - qrToken: safeScanId
 * - qrId: safeScanId
 * are all strictly identical and permanent.
 */
export async function saveSeniorProfile(profile: SeniorProfile): Promise<SeniorProfile> {
  const safeScanId = (
    profile.safeScanId ||
    profile.patientId ||
    profile.qrToken ||
    profile.id ||
    generateSafeScanId()
  )
    .toUpperCase()
    .trim();

  const updatedProfile: SeniorProfile = {
    ...profile,
    id: safeScanId,
    safeScanId: safeScanId,
    patientId: safeScanId,
    qrToken: safeScanId,
    qrId: safeScanId,
    updatedAt: new Date().toISOString(),
  };

  const path = `senior_profiles/${safeScanId}`;
  try {
    await setDoc(doc(db, 'senior_profiles', safeScanId), updatedProfile);
    cacheProfileLocally(updatedProfile);
    return updatedProfile;
  } catch (error) {
    console.error('Firestore save failed, caching in local storage:', error);
    cacheProfileLocally(updatedProfile);
    handleFirestoreError(error, OperationType.WRITE, path);
    return updatedProfile;
  }
}

export async function updateSeniorStatus(id: string, status: 'active' | 'disabled'): Promise<void> {
  const cleanId = id.toUpperCase().trim();
  const path = `senior_profiles/${cleanId}`;
  try {
    await updateDoc(doc(db, 'senior_profiles', cleanId), {
      status,
      updatedAt: new Date().toISOString(),
    });

    // Update in local storage
    const profile = await getSeniorProfile(cleanId);
    if (profile) {
      cacheProfileLocally({ ...profile, status });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSeniorProfile(id: string): Promise<void> {
  const cleanId = id.toUpperCase().trim();
  const path = `senior_profiles/${cleanId}`;
  try {
    const snap = await getDoc(doc(db, 'senior_profiles', cleanId));
    if (snap.exists()) {
      const data = snap.data() as SeniorProfile;
      if (data.identity_fingerprint) {
        try {
          await deleteDoc(doc(db, 'identity_registry', data.identity_fingerprint));
        } catch {}
      }
    }
    await deleteDoc(doc(db, 'senior_profiles', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }

  // Also clean up local storage
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(`safescan_patient_${cleanId}`);
      localStorage.removeItem(`safescan_patient_${id}`);
      const stored = localStorage.getItem('safescan_all_profiles');
      if (stored) {
        const list: SeniorProfile[] = JSON.parse(stored);
        const filtered = list.filter(
          (p) =>
            p.id !== cleanId &&
            p.id !== id &&
            p.safeScanId !== cleanId &&
            p.patientId !== cleanId
        );
        localStorage.setItem('safescan_all_profiles', JSON.stringify(filtered));
      }
    } catch {}
  }
}

/**
 * Validates and normalizes an identity number on the client before submitting to the server.
 */
export function validateIdentityNumberClient(rawInput: string): {
  valid: boolean;
  normalized: string;
  formattedDisplay: string;
  error?: string;
} {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      normalized: '',
      formattedDisplay: '',
      error: 'Please enter the senior citizen’s 12-digit Identity / Synthetic Aadhaar number.',
    };
  }

  const normalized = trimmed.replace(/[\s\-_]+/g, '').toUpperCase();

  if (/^\d+$/.test(normalized)) {
    if (normalized.length !== 12) {
      return {
        valid: false,
        normalized,
        formattedDisplay: trimmed,
        error: 'Identity / Aadhaar number must be exactly 12 digits (e.g. 4829 1038 5721).',
      };
    }
    if (/^(\d)\1{11}$/.test(normalized)) {
      return {
        valid: false,
        normalized,
        formattedDisplay: trimmed,
        error: 'Identity number cannot consist of 12 identical digits.',
      };
    }
    const formattedDisplay = `${normalized.slice(0, 4)} ${normalized.slice(4, 8)} ${normalized.slice(8, 12)}`;
    return { valid: true, normalized, formattedDisplay };
  }

  if (/^[A-Z0-9]{8,16}$/.test(normalized) && (normalized.match(/\d/g) || []).length >= 4) {
    return { valid: true, normalized, formattedDisplay: normalized };
  }

  return {
    valid: false,
    normalized,
    formattedDisplay: trimmed,
    error: 'Invalid format. Enter a 12-digit numeric ID (e.g. 4829 1038 5721) or valid synthetic test ID.',
  };
}

/**
 * Generates a realistic 12-digit synthetic test identity number for development & evaluation
 * (never starts with 0 or 1, formatted as XXXX XXXX XXXX).
 */
export function generateSyntheticTestIdentity(): string {
  const firstDigit = String(Math.floor(2 + Math.random() * 8));
  let rest = '';
  for (let i = 0; i < 11; i++) {
    rest += String(Math.floor(Math.random() * 10));
  }
  const full = firstDigit + rest;
  return `${full.slice(0, 4)} ${full.slice(4, 8)} ${full.slice(8, 12)}`;
}

export type RegisterSeniorOutcome =
  | { status: 'CREATED'; profile: SeniorProfile }
  | DuplicateRegistrationResponse;

/**
 * Submits a new senior registration to the trusted backend endpoint (/api/seniors/register),
 * which computes the keyed HMAC-SHA256 identity_fingerprint and enforces atomic database uniqueness.
 */
export async function registerUniqueSeniorProfile(
  payload: Record<string, any>
): Promise<RegisterSeniorOutcome> {
  const res = await fetch('/api/seniors/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 409 && data.status === 'DUPLICATE_IDENTITY') {
    return data as DuplicateRegistrationResponse;
  }

  if (!res.ok) {
    throw new Error(data.error || 'Registration failed. Please check your input and try again.');
  }

  const createdProfile = data.profile as SeniorProfile;
  cacheProfileLocally(createdProfile);
  return {
    status: 'CREATED',
    profile: createdProfile,
  };
}

/**
 * Updates an existing senior profile via the trusted backend endpoint (/api/seniors/:id),
 * strictly preserving its permanent SafeScan ID and existing identity_fingerprint.
 */
export async function updateExistingSeniorProfile(
  seniorId: string,
  payload: Record<string, any>
): Promise<SeniorProfile> {
  const cleanId = seniorId.trim().toUpperCase();
  const res = await fetch(`/api/seniors/${encodeURIComponent(cleanId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update senior profile.');
  }

  const updatedProfile = data.profile as SeniorProfile;
  cacheProfileLocally(updatedProfile);
  return updatedProfile;
}

/**
 * Submits a caregiver access/link request when an authorized caregiver attempts to register
 * a senior who is already registered under another account.
 */
export async function submitCaregiverAccessRequest(params: {
  identityNumber: string;
  requesterUserId: string;
  requesterName: string;
  requesterEmail: string;
  relationshipNote: string;
}): Promise<string> {
  const res = await fetch('/api/seniors/request-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Could not submit access request.');
  }
  return data.message || 'Access request sent to the profile owner.';
}

/**
 * Fetches pending caregiver access requests for a senior profile owner.
 */
export async function getAccessRequestsForOwner(
  ownerUserId: string
): Promise<CaregiverAccessRequest[]> {
  if (!ownerUserId) return [];
  try {
    const q = query(collection(db, 'access_requests'), where('ownerUserId', '==', ownerUserId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as CaregiverAccessRequest)
      .filter((r) => r.status === 'pending');
  } catch (err) {
    console.warn('Could not load access requests:', err);
    return [];
  }
}

/**
 * Approves or rejects a caregiver access request.
 */
export async function respondToCaregiverAccessRequest(
  requestId: string,
  ownerUserId: string,
  decision: 'approved' | 'rejected'
): Promise<void> {
  const res = await fetch(`/api/seniors/access-requests/${encodeURIComponent(requestId)}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerUserId, decision }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to respond to access request.');
  }
}

export async function submitEmergencyReport(report: EmergencyReport): Promise<void> {
  const path = `emergency_reports/${report.id}`;
  try {
    await setDoc(doc(db, 'emergency_reports', report.id), report);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getEmergencyReports(): Promise<EmergencyReport[]> {
  const path = 'emergency_reports';
  try {
    const querySnap = await getDocs(collection(db, path));
    return querySnap.docs.map((d) => d.data() as EmergencyReport);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}
