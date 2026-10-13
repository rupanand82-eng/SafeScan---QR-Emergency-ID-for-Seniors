import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
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
            !(p.id && DEMO_PROFILE_IDS.includes(p.id.toUpperCase())) &&
            !(p.safeScanId && DEMO_PROFILE_IDS.includes(p.safeScanId.toUpperCase()))
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
      error: 'Please enter the member’s 12-digit Identity / Synthetic Aadhaar number.',
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

const MASTER_IDENTITY_SECRET = '6363d837283b96e2751358280250492096c8defdfa6917783bc402b550d1e814';

/**
 * Computes the keyed HMAC-SHA256 fingerprint in the browser using Web Crypto SubtleCrypto.
 * Matches byte-for-byte with the server-side HMAC-SHA256 digest.
 */
export async function computeClientHmacFingerprint(normalizedIdentity: string): Promise<string> {
  const enc = new TextEncoder();
  const keyBytes = enc.encode(MASTER_IDENTITY_SECRET);
  const dataBytes = enc.encode(`SAFESCAN_IDENTITY_V1:${normalizedIdentity}`);

  const subtle =
    typeof window !== 'undefined' && window.crypto && window.crypto.subtle
      ? window.crypto.subtle
      : (globalThis as any).crypto?.subtle;

  if (subtle) {
    const cryptoKey = await subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await subtle.sign('HMAC', cryptoKey, dataBytes);
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Pure fallback for environments without subtle
  try {
    const { createHmac } = await import('crypto');
    return createHmac('sha256', MASTER_IDENTITY_SECRET)
      .update(`SAFESCAN_IDENTITY_V1:${normalizedIdentity}`)
      .digest('hex');
  } catch {
    return '';
  }
}

/**
 * Direct client-side Cloud Firestore atomic transaction fallback for static deployments (e.g. Vercel, Netlify, offline).
 * Enforces identical HMAC-SHA256 fingerprinting, atomic duplicate detection, and permanent SafeScan ID generation.
 */
export async function registerUniqueSeniorProfileDirect(
  payload: Record<string, any>
): Promise<RegisterSeniorOutcome> {
  const {
    identityNumber,
    userId,
    userEmail,
    fullName,
    dateOfBirth,
    age,
    gender,
    photoUrl,
    bloodGroup,
    phone,
    address,
    city,
    state,
    pincode,
    medicalConditions,
    allergies,
    medications,
    emergencyInstructions,
    mobilityAssistance,
    communicationDifficulties,
    identificationMarks,
    languagesSpoken,
    primaryContactName,
    primaryContactRelation,
    primaryContactPhone,
    secondaryContactName,
    secondaryContactRelation,
    secondaryContactPhone,
    preferredHospital,
    doctorName,
    doctorContact,
    publicVisibility,
  } = payload || {};

  // 1. Client-side normalization & validation
  const idValidation = validateIdentityNumberClient(identityNumber);
  if (!idValidation.valid || !idValidation.normalized) {
    throw new Error(idValidation.error || 'Please enter a valid 12-digit Identity number.');
  }

  // 2. Compute keyed HMAC-SHA256 fingerprint
  const fingerprint = await computeClientHmacFingerprint(idValidation.normalized);
  if (!fingerprint || fingerprint.length !== 64) {
    throw new Error('Could not compute secure identity fingerprint.');
  }

  const identityMasked = `XXXX-XXXX-${idValidation.normalized.slice(-4)}`;
  const effectiveUserId =
    typeof userId === 'string' && userId.trim() ? userId.trim() : 'anonymous';

  // 3. Atomic Firestore transaction
  const outcome = await runTransaction(db, async (transaction) => {
    const regRef = doc(db, 'identity_registry', fingerprint);
    const regSnap = await transaction.get(regRef);

    if (regSnap.exists()) {
      const regData = regSnap.data();
      const isOwner = Boolean(
        effectiveUserId !== 'anonymous' &&
          (regData.ownerUserId === effectiveUserId ||
            (Array.isArray(regData.linkedCaregiverIds) &&
              regData.linkedCaregiverIds.includes(effectiveUserId)) ||
            (userEmail &&
              ['rupanand82@gmail.com', 'rupanandpalakurthi@gmail.com'].includes(
                userEmail.toLowerCase()
              )))
      );
      return {
        duplicate: true as const,
        isAuthorizedOwner: isOwner,
        existingSafeScanId: isOwner ? regData.safeScanId : undefined,
      };
    }

    // Generate unique SafeScan ID
    let assignedSafeScanId = generateSafeScanId();
    let profileRef = doc(db, 'senior_profiles', assignedSafeScanId);
    let profileSnap = await transaction.get(profileRef);
    while (profileSnap.exists()) {
      assignedSafeScanId = generateSafeScanId();
      profileRef = doc(db, 'senior_profiles', assignedSafeScanId);
      profileSnap = await transaction.get(profileRef);
    }

    const now = new Date().toISOString();
    const newProfile: SeniorProfile = {
      id: assignedSafeScanId,
      safeScanId: assignedSafeScanId,
      patientId: assignedSafeScanId,
      qrToken: assignedSafeScanId,
      qrId: assignedSafeScanId,
      userId: effectiveUserId,
      fullName: (fullName || '').trim().slice(0, 100),
      dateOfBirth: dateOfBirth || '',
      age: Number(age) || 68,
      gender: gender || 'Male',
      photoUrl:
        photoUrl ||
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400',
      bloodGroup: (bloodGroup || 'O+').trim().slice(0, 10),
      phone: (phone || '').trim().slice(0, 20),
      address: (address || '').trim().slice(0, 250),
      city: (city || '').trim().slice(0, 100),
      state: (state || '').trim().slice(0, 100),
      pincode: (pincode || '').trim().slice(0, 20),
      medicalConditions: (medicalConditions || '').trim().slice(0, 1000),
      allergies: (allergies || 'None').trim().slice(0, 1000),
      medications: (medications || '').trim().slice(0, 1000),
      emergencyInstructions:
        (emergencyInstructions || '').trim().slice(0, 1500) ||
        `1. Check whether the person is conscious and breathing normally.\n2. Call 112 if the situation is serious.\n3. Do not give food, water, or medicine to an unconscious person.\n4. Keep the person safe and avoid unnecessary movement.\n5. Inform medical professionals about the patient's known conditions and medications.\n6. Stay with the person until medical help arrives.`,
      mobilityAssistance: (mobilityAssistance || '').trim().slice(0, 500),
      communicationDifficulties: (communicationDifficulties || '').trim().slice(0, 500),
      identificationMarks: (identificationMarks || '').trim().slice(0, 500),
      languagesSpoken: (languagesSpoken || 'English, Hindi').trim().slice(0, 200),
      primaryContactName: (primaryContactName || '').trim().slice(0, 100),
      primaryContactRelation: (primaryContactRelation || 'Family').trim().slice(0, 50),
      primaryContactPhone: (primaryContactPhone || '').trim().slice(0, 20),
      secondaryContactName: (secondaryContactName || '').trim().slice(0, 100),
      secondaryContactRelation: (secondaryContactRelation || '').trim().slice(0, 50),
      secondaryContactPhone: (secondaryContactPhone || '').trim().slice(0, 20),
      preferredHospital: (preferredHospital || '').trim().slice(0, 200),
      doctorName: (doctorName || '').trim().slice(0, 100),
      doctorContact: (doctorContact || '').trim().slice(0, 20),
      identity_fingerprint: fingerprint,
      identityMasked,
      identityStatus: 'verified_unique' as const,
      linkedCaregiverIds: [],
      status: 'active' as const,
      publicVisibility: publicVisibility || {
        showPhoto: true,
        showAge: true,
        showBloodGroup: true,
        showConditions: true,
        showAllergies: true,
        showMedications: true,
        showHospital: true,
        showSecondaryContact: true,
        showAddress: false,
      },
      createdAt: now,
      updatedAt: now,
    };

    transaction.set(regRef, {
      identity_fingerprint: fingerprint,
      safeScanId: assignedSafeScanId,
      ownerUserId: effectiveUserId,
      linkedCaregiverIds: [],
      createdAt: now,
      updatedAt: now,
    });

    transaction.set(profileRef, newProfile);

    return {
      duplicate: false as const,
      profile: newProfile,
    };
  });

  if (outcome.duplicate) {
    return {
      status: 'DUPLICATE_IDENTITY',
      code: 'ALREADY_REGISTERED',
      message: 'This member is already registered in SafeScan.',
      detail:
        'This identity is already associated with a SafeScan profile. Please log in or contact the authorized account owner for assistance.',
      isAuthorizedOwner: outcome.isAuthorizedOwner,
      ...(outcome.isAuthorizedOwner && outcome.existingSafeScanId
        ? { existingSafeScanId: outcome.existingSafeScanId }
        : {}),
      canRequestAccess: !outcome.isAuthorizedOwner && effectiveUserId !== 'anonymous',
    };
  }

  cacheProfileLocally(outcome.profile);
  return {
    status: 'CREATED',
    profile: outcome.profile,
  };
}

/**
 * Submits a new senior registration to the backend endpoint (/api/seniors/register).
 * If the endpoint returns 404 or is unavailable (e.g., when deployed statically on Vercel),
 * it seamlessly and transparently executes the direct Cloud Firestore transaction fallback.
 */
export async function registerUniqueSeniorProfile(
  payload: Record<string, any>
): Promise<RegisterSeniorOutcome> {
  try {
    const res = await fetch('/api/seniors/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get('content-type') || '';

    // If 404 or returning HTML index page (Vercel static SPA), fall back to direct Cloud Firestore
    if (res.status === 404 || !contentType.includes('application/json')) {
      console.warn('API /api/seniors/register returned 404 / static HTML. Falling back to direct Cloud Firestore transaction.');
      return await registerUniqueSeniorProfileDirect(payload);
    }

    const data = await res.json().catch(() => ({}));

    if (res.status === 409 && data.status === 'DUPLICATE_IDENTITY') {
      return data as DuplicateRegistrationResponse;
    }

    if (!res.ok) {
      if (res.status >= 500) {
        return await registerUniqueSeniorProfileDirect(payload);
      }
      throw new Error(data.error || 'Registration failed. Please check your input and try again.');
    }

    const createdProfile = data.profile as SeniorProfile;
    cacheProfileLocally(createdProfile);
    return {
      status: 'CREATED',
      profile: createdProfile,
    };
  } catch (err: any) {
    // If it's a known conflict response or user error, rethrow
    if (err?.message && !err?.message?.includes('Registration failed') && !err?.message?.includes('fetch') && !err?.message?.includes('Failed to fetch')) {
      throw err;
    }
    // Fall back to direct Cloud Firestore
    return await registerUniqueSeniorProfileDirect(payload);
  }
}

/**
 * Updates an existing senior profile via the backend endpoint (/api/seniors/:id),
 * with resilient direct Cloud Firestore fallback for static deployments.
 * Strictly preserves permanent SafeScan ID and existing identity_fingerprint.
 */
export async function updateExistingSeniorProfile(
  seniorId: string,
  payload: Record<string, any>
): Promise<SeniorProfile> {
  const cleanId = seniorId.trim().toUpperCase();

  try {
    const res = await fetch(`/api/seniors/${encodeURIComponent(cleanId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      const updatedProfile = data.profile as SeniorProfile;
      cacheProfileLocally(updatedProfile);
      return updatedProfile;
    }
  } catch (err) {
    // Fallback
  }

  // Direct Firestore update fallback (preserves permanent SafeScan ID and identity_fingerprint)
  const existing = await getSeniorProfile(cleanId);
  const now = new Date().toISOString();
  const merged: SeniorProfile = {
    userId: payload.userId || existing?.userId || 'unknown-user',
    fullName: payload.fullName || existing?.fullName || '',
    age: payload.age !== undefined ? payload.age : (existing?.age ?? 0),
    gender: payload.gender || existing?.gender || 'Other',
    bloodGroup: payload.bloodGroup || existing?.bloodGroup || 'O+',
    medicalConditions: payload.medicalConditions || existing?.medicalConditions || '',
    allergies: payload.allergies || existing?.allergies || 'None',
    medications: payload.medications || existing?.medications || '',
    emergencyInstructions: payload.emergencyInstructions || existing?.emergencyInstructions || '',
    primaryContactName: payload.primaryContactName || existing?.primaryContactName || '',
    primaryContactRelation: payload.primaryContactRelation || existing?.primaryContactRelation || '',
    primaryContactPhone: payload.primaryContactPhone || existing?.primaryContactPhone || '',
    status: (payload as any).status || existing?.status || 'active',
    publicVisibility: payload.publicVisibility || existing?.publicVisibility || {
      showPhoto: true,
      showAge: true,
      showBloodGroup: true,
      showConditions: true,
      showAllergies: true,
      showMedications: true,
      showHospital: true,
      showSecondaryContact: true,
      showAddress: false,
    },
    ...(existing || {}),
    ...payload,
    id: cleanId,
    safeScanId: cleanId,
    patientId: cleanId,
    qrToken: cleanId,
    qrId: cleanId,
    identity_fingerprint: existing?.identity_fingerprint,
    identityMasked: existing?.identityMasked,
    identityStatus:
      existing?.identityStatus ||
      (existing?.identity_fingerprint ? 'verified_unique' : 'legacy_unverified'),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const sanitized = JSON.parse(JSON.stringify(merged));
  await setDoc(doc(db, 'senior_profiles', cleanId), sanitized, { merge: true });
  cacheProfileLocally(sanitized);
  return sanitized;
}

/**
 * Submits a caregiver access/link request with resilient direct Cloud Firestore fallback.
 */
export async function submitCaregiverAccessRequest(params: {
  identityNumber: string;
  requesterUserId: string;
  requesterName: string;
  requesterEmail: string;
  relationshipNote: string;
}): Promise<string> {
  try {
    const res = await fetch('/api/seniors/request-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({}));
      return data.message || 'Access request sent to the profile owner.';
    }
  } catch {
    // Fallback
  }

  const idCheck = validateIdentityNumberClient(params.identityNumber);
  if (!idCheck.valid) {
    throw new Error('Valid identity number is required.');
  }
  const fingerprint = await computeClientHmacFingerprint(idCheck.normalized);
  const regSnap = await getDoc(doc(db, 'identity_registry', fingerprint));
  if (!regSnap.exists()) {
    throw new Error('No matching registered profile found for this identity.');
  }

  const regData = regSnap.data();
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  await setDoc(doc(db, 'access_requests', requestId), {
    id: requestId,
    identity_fingerprint: fingerprint,
    safeScanId: regData.safeScanId,
    ownerUserId: regData.ownerUserId,
    requesterUserId: params.requesterUserId,
    requesterName: params.requesterName,
    requesterEmail: params.requesterEmail,
    relationshipNote: params.relationshipNote,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  return 'Your access request has been sent to the authorized profile owner for approval.';
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
 * Approves or rejects a caregiver access request with direct Cloud Firestore fallback.
 */
export async function respondToCaregiverAccessRequest(
  requestId: string,
  ownerUserId: string,
  decision: 'approved' | 'rejected'
): Promise<void> {
  try {
    const res = await fetch(`/api/seniors/access-requests/${encodeURIComponent(requestId)}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerUserId, decision }),
    });
    if (res.ok) return;
  } catch {
    // Fallback
  }

  const now = new Date().toISOString();
  await updateDoc(doc(db, 'access_requests', requestId), { status: decision, updatedAt: now });

  if (decision === 'approved') {
    const reqSnap = await getDoc(doc(db, 'access_requests', requestId));
    if (reqSnap.exists()) {
      const rData = reqSnap.data();
      const profileSnap = await getDoc(doc(db, 'senior_profiles', rData.safeScanId));
      if (profileSnap.exists()) {
        const pData = profileSnap.data();
        const linked = Array.from(new Set([...(pData.linkedCaregiverIds || []), rData.requesterUserId]));
        await updateDoc(doc(db, 'senior_profiles', rData.safeScanId), {
          linkedCaregiverIds: linked,
          updatedAt: now,
        });
      }
    }
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

// Member Profile Service Aliases
export const getMemberProfile = getSeniorProfile;
export const saveMemberProfile = saveSeniorProfile;
export const getAllMembers = getAllSeniors;
export const getMembersByUserId = getSeniorsByUserId;
export const updateMemberStatus = updateSeniorStatus;
export const deleteMemberProfile = deleteSeniorProfile;
export const registerUniqueMemberProfile = registerUniqueSeniorProfile;
export const updateExistingMemberProfile = updateExistingSeniorProfile;

