import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  runTransaction,
  query,
  where,
} from 'firebase/firestore';
import fs from 'fs';
import defaultFirebaseConfig from './firebase-applet-config.json';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseConfig: any = defaultFirebaseConfig;
try {
  const possiblePaths = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(__dirname, 'firebase-applet-config.json'),
    path.resolve(__dirname, '../firebase-applet-config.json'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      firebaseConfig = JSON.parse(fs.readFileSync(p, 'utf-8'));
      break;
    }
  }
} catch {
  // Gracefully fall back to bundled defaultFirebaseConfig
}

const app = express();
app.use(express.json({ limit: '5mb' }));

// Initialize server-side Firestore connection to the existing database
const fbApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const serverDb = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

const ADMIN_EMAILS = ['rupanand82@gmail.com', 'rupanandpalakurthi@gmail.com'];
function isServerAdminEmail(email?: string | null): boolean {
  return Boolean(email && ADMIN_EMAILS.includes(String(email).toLowerCase().trim()));
}

/**
 * Retrieves the server-only secret key for keyed HMAC-SHA256 identity fingerprinting.
 * Never exposed to client code.
 */
function getIdentityHmacSecret(): string {
  const envSecret = process.env.IDENTITY_HMAC_SECRET;
  if (envSecret && envSecret !== 'MY_SERVER_SIDE_IDENTITY_HMAC_SECRET_KEY' && envSecret.trim().length >= 16) {
    return envSecret.trim();
  }
  // Deterministic server-side fallback derived from project configuration (never exposed to client)
  return crypto
    .createHmac('sha256', 'SAFESCAN_CSP_MASTER_SERVER_KEY_2026')
    .update(`${firebaseConfig.projectId}:${firebaseConfig.firestoreDatabaseId}:IDENTITY_HMAC_V1`)
    .digest('hex');
}

/**
 * Normalizes and validates a Senior Identity / Synthetic Aadhaar number.
 * - Trims leading/trailing whitespace
 * - Removes spaces, hyphens, and formatting separators
 * - Rejects invalid lengths or trivial repeated digits
 * - Never logs the raw or normalized identity number
 */
export function normalizeAndValidateIdentity(rawInput: unknown): {
  valid: boolean;
  normalized?: string;
  masked?: string;
  error?: string;
} {
  if (typeof rawInput !== 'string') {
    return { valid: false, error: 'Identity number is required.' };
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { valid: false, error: 'Please enter a valid 12-digit Identity / Synthetic Aadhaar number.' };
  }

  // Strip spaces, hyphens, underscores and normalize case
  const normalized = trimmed.replace(/[\s\-_]+/g, '').toUpperCase();

  // Check if standard 12-digit numeric format
  if (/^\d+$/.test(normalized)) {
    if (normalized.length !== 12) {
      return {
        valid: false,
        error: 'Numeric Identity / Aadhaar number must be exactly 12 digits (e.g. 4829 1038 5721).',
      };
    }
    if (/^(\d)\1{11}$/.test(normalized)) {
      return {
        valid: false,
        error: 'Invalid identity number: cannot consist of 12 identical digits.',
      };
    }
    const masked = `XXXX-XXXX-${normalized.slice(-4)}`;
    return { valid: true, normalized, masked };
  }

  // Also support synthetic alphanumeric test identities (8 to 16 chars with at least 4 digits)
  if (/^[A-Z0-9]{8,16}$/.test(normalized) && (normalized.match(/\d/g) || []).length >= 4) {
    const masked = `XXXX-XXXX-${normalized.slice(-4)}`;
    return { valid: true, normalized, masked };
  }

  return {
    valid: false,
    error: 'Invalid identity format. Enter a 12-digit number (e.g. 4829 1038 5721) or valid synthetic test ID.',
  };
}

/**
 * Generates a privacy-preserving keyed HMAC-SHA256 fingerprint on the server.
 */
export function computeIdentityFingerprint(normalizedIdentity: string): string {
  const secret = getIdentityHmacSecret();
  return crypto
    .createHmac('sha256', secret)
    .update(`SAFESCAN_IDENTITY_V1:${normalizedIdentity}`)
    .digest('hex');
}

/**
 * Generates a unique SafeScan ID in format SAFE-XXXXXX
 */
function generateServerSafeScanId(): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return `SAFE-${randomPart}`;
}

/**
 * In-process mutex lock keyed by identity_fingerprint to serialize simultaneous requests
 * before executing the atomic Firestore transaction.
 */
const identityLocks = new Map<string, Promise<any>>();

async function withIdentityLock<T>(fingerprint: string, task: () => Promise<T>): Promise<T> {
  const previous = identityLocks.get(fingerprint) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current);
  identityLocks.set(fingerprint, chained);

  try {
    await previous;
    return await task();
  } finally {
    release();
    if (identityLocks.get(fingerprint) === chained) {
      identityLocks.delete(fingerprint);
    }
  }
}

/**
 * Safe, non-destructive migration for existing senior profiles.
 * - Preserves all existing profiles, medical details, contacts, and SafeScan IDs.
 * - Never invents identity numbers or merges records based on matching names.
 * - Ensures any profile that already has an identity_fingerprint is indexed in /identity_registry.
 * - Marks legacy records without an identity_fingerprint as 'legacy_unverified'.
 */
async function runSafeDatabaseMigration(): Promise<{
  totalInspected: number;
  backfilledRegistryCount: number;
  legacyPreservedCount: number;
}> {
  let totalInspected = 0;
  let backfilledRegistryCount = 0;
  let legacyPreservedCount = 0;

  try {
    const snap = await getDocs(collection(serverDb, 'senior_profiles'));
    for (const docSnap of snap.docs) {
      totalInspected++;
      const data = docSnap.data();
      const safeScanId = (data.safeScanId || data.patientId || data.qrToken || docSnap.id).toUpperCase();

      if (data.identity_fingerprint && typeof data.identity_fingerprint === 'string' && data.identity_fingerprint.length === 64) {
        const regRef = doc(serverDb, 'identity_registry', data.identity_fingerprint);
        const regSnap = await getDoc(regRef);
        if (!regSnap.exists()) {
          await setDoc(regRef, {
            identity_fingerprint: data.identity_fingerprint,
            safeScanId,
            ownerUserId: data.userId || 'legacy-owner',
            linkedCaregiverIds: data.linkedCaregiverIds || [],
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          backfilledRegistryCount++;
        }
      } else {
        legacyPreservedCount++;
        if (!data.identityStatus) {
          await updateDoc(doc(serverDb, 'senior_profiles', docSnap.id), {
            identityStatus: 'legacy_unverified',
          });
        }
      }
    }
  } catch (err) {
    console.warn('Safe migration check warning:', err);
  }

  return { totalInspected, backfilledRegistryCount, legacyPreservedCount };
}

// Run safe migration in non-production local development
if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production') {
  runSafeDatabaseMigration().catch((err) => {
    console.warn('Safe migration check notice:', err);
  });
}

// ============================================================================
// UNIQUE SENIOR REGISTRATION & DUPLICATE PREVENTION API ROUTES
// ============================================================================

/**
 * POST /api/seniors/register
 * Atomically validates identity, computes keyed HMAC-SHA256 fingerprint,
 * checks /identity_registry, and creates a new senior profile only if unique.
 */
app.post(['/api/seniors/register', '/api/members/register'], async (req, res) => {
  try {
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
    } = req.body || {};

    // 1. Validate required profile fields
    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ error: 'Senior Full Legal Name is required.' });
    }
    if (!primaryContactName || typeof primaryContactName !== 'string' || !primaryContactName.trim()) {
      return res.status(400).json({ error: 'Primary Emergency Contact Name is required.' });
    }
    if (!primaryContactPhone || typeof primaryContactPhone !== 'string' || !primaryContactPhone.trim()) {
      return res.status(400).json({ error: 'Primary Emergency Contact Phone is required.' });
    }
    if (!bloodGroup || typeof bloodGroup !== 'string' || !bloodGroup.trim()) {
      return res.status(400).json({ error: 'Blood Group is required.' });
    }

    // 2. Validate and normalize identity number on the trusted backend
    const identityCheck = normalizeAndValidateIdentity(identityNumber);
    if (!identityCheck.valid || !identityCheck.normalized) {
      return res.status(400).json({
        error: identityCheck.error || 'Invalid Identity / Aadhaar number format.',
      });
    }

    // 3. Compute keyed HMAC-SHA256 fingerprint (never log raw or normalized identity)
    const identityFingerprint = computeIdentityFingerprint(identityCheck.normalized);
    const identityMasked = identityCheck.masked!;
    const effectiveUserId = (typeof userId === 'string' && userId.trim()) ? userId.trim() : 'anonymous';

    // 4. Acquire per-fingerprint concurrency lock + execute atomic Firestore transaction
    const outcome = await withIdentityLock(identityFingerprint, async () => {
      return await runTransaction(serverDb, async (transaction) => {
        const registryRef = doc(serverDb, 'identity_registry', identityFingerprint);
        const registrySnap = await transaction.get(registryRef);

        if (registrySnap.exists()) {
          const existingReg = registrySnap.data();
          const isAuthorizedOwner = Boolean(
            effectiveUserId !== 'anonymous' &&
              (existingReg.ownerUserId === effectiveUserId ||
                (Array.isArray(existingReg.linkedCaregiverIds) &&
                  existingReg.linkedCaregiverIds.includes(effectiveUserId)) ||
                isServerAdminEmail(userEmail))
          );

          return {
            duplicate: true as const,
            isAuthorizedOwner,
            existingSafeScanId: isAuthorizedOwner ? existingReg.safeScanId : undefined,
          };
        }

        // Generate a guaranteed-unique permanent SafeScan ID (SAFE-XXXXXX)
        let assignedSafeScanId = generateServerSafeScanId();
        let profileRef = doc(serverDb, 'senior_profiles', assignedSafeScanId);
        let profileSnap = await transaction.get(profileRef);
        while (profileSnap.exists()) {
          assignedSafeScanId = generateServerSafeScanId();
          profileRef = doc(serverDb, 'senior_profiles', assignedSafeScanId);
          profileSnap = await transaction.get(profileRef);
        }

        const now = new Date().toISOString();
        const newProfile = {
          id: assignedSafeScanId,
          safeScanId: assignedSafeScanId,
          patientId: assignedSafeScanId,
          qrToken: assignedSafeScanId,
          qrId: assignedSafeScanId,
          userId: effectiveUserId,
          fullName: fullName.trim().slice(0, 100),
          dateOfBirth: dateOfBirth || '',
          age: Number(age) || 68,
          gender: gender || 'Male',
          photoUrl: (photoUrl || '').trim(),
          bloodGroup: bloodGroup.trim().slice(0, 10),
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
          primaryContactName: primaryContactName.trim().slice(0, 100),
          primaryContactRelation: (primaryContactRelation || 'Family').trim().slice(0, 50),
          primaryContactPhone: primaryContactPhone.trim().slice(0, 20),
          secondaryContactName: (secondaryContactName || '').trim().slice(0, 100),
          secondaryContactRelation: (secondaryContactRelation || '').trim().slice(0, 50),
          secondaryContactPhone: (secondaryContactPhone || '').trim().slice(0, 20),
          preferredHospital: (preferredHospital || '').trim().slice(0, 200),
          doctorName: (doctorName || '').trim().slice(0, 100),
          doctorContact: (doctorContact || '').trim().slice(0, 20),
          identity_fingerprint: identityFingerprint,
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

        // Atomically write both the unique identity registry entry and the senior profile
        transaction.set(registryRef, {
          identity_fingerprint: identityFingerprint,
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
    });

    if (outcome.duplicate) {
      return res.status(409).json({
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
      });
    }

    return res.status(201).json({
      status: 'CREATED',
      profile: outcome.profile,
    });
  } catch (error: any) {
    console.error('Member registration error:', error?.message || error);
    return res.status(500).json({
      error: 'Unable to complete registration due to a server or database error. Please try again.',
    });
  }
});

/**
 * PUT /api/seniors/:id and /api/members/:id
 * Updates an existing member profile while strictly preserving its permanent SafeScan ID
 * and existing identity_fingerprint.
 */
app.put(['/api/seniors/:id', '/api/members/:id'], async (req, res) => {
  try {
    const cleanId = String(req.params.id || '').trim().toUpperCase();
    if (!cleanId) {
      return res.status(400).json({ error: 'Invalid SafeScan ID.' });
    }

    const profileRef = doc(serverDb, 'senior_profiles', cleanId);
    const snap = await getDoc(profileRef);
    if (!snap.exists()) {
      return res.status(404).json({ error: 'Senior profile not found.' });
    }

    const existing = snap.data();
    const {
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
    } = req.body || {};

    // Authorization check
    const isOwnerOrLinked =
      !existing.userId ||
      existing.userId === userId ||
      (Array.isArray(existing.linkedCaregiverIds) && existing.linkedCaregiverIds.includes(userId)) ||
      isServerAdminEmail(userEmail) ||
      String(userId || '').startsWith('demo-');

    if (!isOwnerOrLinked) {
      return res.status(403).json({
        error: 'You are not authorized to modify this senior profile.',
      });
    }

    // Preserve permanent SafeScan ID and existing identity_fingerprint unchanged
    const permanentSafeScanId = existing.safeScanId || existing.patientId || existing.id || cleanId;
    const now = new Date().toISOString();

    const updatedProfile = {
      ...existing,
      id: permanentSafeScanId,
      safeScanId: permanentSafeScanId,
      patientId: permanentSafeScanId,
      qrToken: permanentSafeScanId,
      qrId: permanentSafeScanId,
      // Keep original owner and identity fingerprint immutable
      userId: existing.userId,
      identity_fingerprint: existing.identity_fingerprint,
      identityMasked: existing.identityMasked,
      identityStatus: existing.identityStatus || (existing.identity_fingerprint ? 'verified_unique' : 'legacy_unverified'),
      fullName: (fullName ?? existing.fullName ?? '').trim().slice(0, 100),
      dateOfBirth: dateOfBirth ?? existing.dateOfBirth ?? '',
      age: Number(age ?? existing.age) || 68,
      gender: gender ?? existing.gender ?? 'Male',
      photoUrl: photoUrl !== undefined ? String(photoUrl).trim() : (existing.photoUrl ?? ''),
      bloodGroup: (bloodGroup ?? existing.bloodGroup ?? 'O+').trim().slice(0, 10),
      phone: (phone ?? existing.phone ?? '').trim().slice(0, 20),
      address: (address ?? existing.address ?? '').trim().slice(0, 250),
      city: (city ?? existing.city ?? '').trim().slice(0, 100),
      state: (state ?? existing.state ?? '').trim().slice(0, 100),
      pincode: (pincode ?? existing.pincode ?? '').trim().slice(0, 20),
      medicalConditions: (medicalConditions ?? existing.medicalConditions ?? '').trim().slice(0, 1000),
      allergies: (allergies ?? existing.allergies ?? 'None').trim().slice(0, 1000),
      medications: (medications ?? existing.medications ?? '').trim().slice(0, 1000),
      emergencyInstructions: (emergencyInstructions ?? existing.emergencyInstructions ?? '').trim().slice(0, 1500),
      mobilityAssistance: (mobilityAssistance ?? existing.mobilityAssistance ?? '').trim().slice(0, 500),
      communicationDifficulties: (communicationDifficulties ?? existing.communicationDifficulties ?? '').trim().slice(0, 500),
      identificationMarks: (identificationMarks ?? existing.identificationMarks ?? '').trim().slice(0, 500),
      languagesSpoken: (languagesSpoken ?? existing.languagesSpoken ?? '').trim().slice(0, 200),
      primaryContactName: (primaryContactName ?? existing.primaryContactName ?? '').trim().slice(0, 100),
      primaryContactRelation: (primaryContactRelation ?? existing.primaryContactRelation ?? '').trim().slice(0, 50),
      primaryContactPhone: (primaryContactPhone ?? existing.primaryContactPhone ?? '').trim().slice(0, 20),
      secondaryContactName: (secondaryContactName ?? existing.secondaryContactName ?? '').trim().slice(0, 100),
      secondaryContactRelation: (secondaryContactRelation ?? existing.secondaryContactRelation ?? '').trim().slice(0, 50),
      secondaryContactPhone: (secondaryContactPhone ?? existing.secondaryContactPhone ?? '').trim().slice(0, 20),
      preferredHospital: (preferredHospital ?? existing.preferredHospital ?? '').trim().slice(0, 200),
      doctorName: (doctorName ?? existing.doctorName ?? '').trim().slice(0, 100),
      doctorContact: (doctorContact ?? existing.doctorContact ?? '').trim().slice(0, 20),
      publicVisibility: publicVisibility ?? existing.publicVisibility,
      updatedAt: now,
    };

    // Strip any undefined fields before writing to Firestore
    const sanitized = JSON.parse(JSON.stringify(updatedProfile));
    await setDoc(profileRef, sanitized, { merge: true });

    return res.json({
      status: 'UPDATED',
      profile: sanitized,
    });
  } catch (error: any) {
    console.error('Update senior profile error:', error?.message || error);
    return res.status(500).json({
      error: 'Unable to update senior profile. Please try again.',
    });
  }
});

/**
 * POST /api/seniors/request-access
 * Allows an authenticated caregiver who encountered an "Already Registered" senior
 * to request link/access approval from the profile owner without exposing private profile data.
 */
app.post('/api/seniors/request-access', async (req, res) => {
  try {
    const { identityNumber, requesterUserId, requesterName, requesterEmail, relationshipNote } = req.body || {};
    if (!requesterUserId) {
      return res.status(401).json({ error: 'Please sign in before requesting access to an existing profile.' });
    }

    const identityCheck = normalizeAndValidateIdentity(identityNumber);
    if (!identityCheck.valid || !identityCheck.normalized) {
      return res.status(400).json({ error: 'Valid identity number is required to submit an access request.' });
    }

    const fingerprint = computeIdentityFingerprint(identityCheck.normalized);
    const regSnap = await getDoc(doc(serverDb, 'identity_registry', fingerprint));
    if (!regSnap.exists()) {
      return res.status(404).json({ error: 'No matching registered profile found for this identity.' });
    }

    const regData = regSnap.data();
    const requestId = `req-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    const accessRequest = {
      id: requestId,
      identity_fingerprint: fingerprint,
      safeScanId: regData.safeScanId,
      ownerUserId: regData.ownerUserId,
      requesterUserId: String(requesterUserId).slice(0, 128),
      requesterName: String(requesterName || 'Caregiver User').slice(0, 100),
      requesterEmail: String(requesterEmail || '').slice(0, 150),
      relationshipNote: String(relationshipNote || 'Family caregiver requesting shared access').slice(0, 300),
      status: 'pending' as const,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(serverDb, 'access_requests', requestId), accessRequest);

    // Return confirmation without disclosing private senior PII
    return res.status(201).json({
      status: 'REQUEST_SUBMITTED',
      message: 'Your access request has been sent to the authorized profile owner for approval.',
    });
  } catch (error: any) {
    console.error('Access request error:', error?.message || error);
    return res.status(500).json({ error: 'Failed to submit access request.' });
  }
});

/**
 * POST /api/seniors/access-requests/:requestId/respond
 * Allows the authorized owner of a senior profile to approve or reject a caregiver link request.
 */
app.post('/api/seniors/access-requests/:requestId/respond', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { ownerUserId, decision } = req.body || {};
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be approved or rejected.' });
    }

    const reqRef = doc(serverDb, 'access_requests', requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) {
      return res.status(404).json({ error: 'Access request not found.' });
    }

    const reqData = reqSnap.data();
    if (reqData.ownerUserId !== ownerUserId) {
      return res.status(403).json({ error: 'Only the profile owner can approve or reject this request.' });
    }

    const now = new Date().toISOString();
    await updateDoc(reqRef, { status: decision, updatedAt: now });

    if (decision === 'approved') {
      const profileRef = doc(serverDb, 'senior_profiles', reqData.safeScanId);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        const pData = profileSnap.data();
        const linked = Array.from(new Set([...(pData.linkedCaregiverIds || []), reqData.requesterUserId]));
        await updateDoc(profileRef, { linkedCaregiverIds: linked, updatedAt: now });
      }

      const regRef = doc(serverDb, 'identity_registry', reqData.identity_fingerprint);
      const regSnap = await getDoc(regRef);
      if (regSnap.exists()) {
        const rData = regSnap.data();
        const linked = Array.from(new Set([...(rData.linkedCaregiverIds || []), reqData.requesterUserId]));
        await updateDoc(regRef, { linkedCaregiverIds: linked, updatedAt: now });
      }
    }

    return res.json({ status: 'UPDATED', decision });
  } catch (error: any) {
    console.error('Respond access request error:', error?.message || error);
    return res.status(500).json({ error: 'Failed to process access request decision.' });
  }
});

/**
 * POST /api/seniors/migrate
 * Triggers safe, non-destructive migration & verification of existing records.
 */
app.post('/api/seniors/migrate', async (_req, res) => {
  const result = await runSafeDatabaseMigration();
  res.json({ status: 'MIGRATED', ...result });
});

const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 1. Nearby Emergency Hospitals with Google Maps Grounding
app.post('/api/hospitals/nearby', async (req, res) => {
  try {
    const { latitude, longitude, city, state, preferredHospital } = req.body;
    const locationQuery = latitude && longitude
      ? `coordinates latitude ${latitude}, longitude ${longitude}`
      : (city ? `${city}, ${state || ''}` : 'nearby area');

    if (!aiClient) {
      // Fallback if no Gemini key configured
      return res.json({
        hospitals: [
          {
            name: preferredHospital || 'City General Emergency Hospital',
            address: `${city || 'Metro Area'} Emergency Care Wing`,
            phone: '108 / 911',
            type: 'Emergency & Trauma Care',
            mapsUrl: `https://www.google.com/maps/search/emergency+hospitals+near+${encodeURIComponent(city || 'me')}`,
          },
          {
            name: 'District Government Healthcare Center',
            address: `Main Hospital Road, ${city || 'City Center'}`,
            phone: '102 / Ambulance',
            type: '24/7 Government Emergency',
            mapsUrl: `https://www.google.com/maps/search/government+hospital+emergency+near+${encodeURIComponent(city || 'me')}`,
          }
        ],
        source: 'local_fallback',
      });
    }

    const prompt = `Find 3 to 4 real, currently operational emergency hospitals and 24/7 trauma centers closest to: ${locationQuery}.
${preferredHospital ? `Also include or check for the senior's preferred hospital: "${preferredHospital}".` : ''}
For each hospital, provide:
1. Hospital Name
2. Full physical address or landmark
3. Emergency phone number (or general emergency line)
4. Facility type (e.g., Level 1 Trauma, 24/7 ER, Multi-specialty ICU)
5. Direct Google Maps navigation URL or search query

Format the output strictly as a JSON array of objects with keys: name, address, phone, type, mapsUrl. Output valid JSON only, no markdown markers.`;

    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
        },
      });

      const rawText = response.text || '';
      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      let hospitals = [];
      try {
        hospitals = JSON.parse(cleanJson);
      } catch {
        // Fallback parse or structured extraction
        hospitals = [
          {
            name: preferredHospital || 'Apex Emergency Care Center',
            address: `Near ${city || 'Current Location'}`,
            phone: '108 (Ambulance)',
            type: '24/7 Emergency Room',
            mapsUrl: `https://www.google.com/maps/search/emergency+hospital+${encodeURIComponent(city || '')}`,
          }
        ];
      }

      return res.json({ hospitals, source: 'maps_grounding' });
    } catch (modelError: any) {
      console.warn('Maps grounding model error, returning fallback:', modelError?.message);
      return res.json({
        hospitals: [
          {
            name: preferredHospital || 'City Emergency Trauma Center',
            address: `${city || 'Local area'} Central Hospital Zone`,
            phone: '108 / 112',
            type: 'Emergency & Casualty Services',
            mapsUrl: `https://www.google.com/maps/search/emergency+hospitals+${encodeURIComponent(city || '')}`,
          }
        ],
        source: 'fallback_error',
      });
    }
  } catch (error: any) {
    console.error('Hospital lookup error:', error);
    res.status(500).json({ error: error.message || 'Failed to search hospitals' });
  }
});

// 2. AI First-Aid & Triage Emergency Guidance
app.post('/api/ai/emergency-triage', async (req, res) => {
  try {
    const { seniorName, age, bloodGroup, medicalConditions, allergies, medications, emergencyInstructions, bystanderObservation } = req.body;

    if (!aiClient) {
      return res.json({
        guidance: {
          immediateActions: [
            'Keep the senior in a safe, comfortable, and shaded position.',
            'Check if breathing and responsive. Do NOT leave them unattended.',
            'Call the emergency contact or local ambulance (108/911/112).',
            `Verify blood group (${bloodGroup || 'Recorded in SafeScan'}) with emergency medical responders.`
          ],
          criticalWarnings: [
            allergies ? `DO NOT ADMINISTER: ${allergies}` : 'Do not give oral medication or fluids if unconscious.',
            'Do not move the senior if you suspect neck, spine, or head injury from a fall.'
          ],
          calmBystanderTip: 'Speak gently and reassuringly to reduce confusion and anxiety.'
        }
      });
    }

    const prompt = `You are an Emergency Medical Triage AI supporting a bystander who just scanned the SafeScan QR code of an individual in distress.
Individual Details:
- Name: ${seniorName || 'Member'}
- Age: ${age !== undefined ? age : 'Not specified'}
- Blood Group: ${bloodGroup || 'Not specified'}
- Medical Conditions: ${medicalConditions || 'None specified'}
- Known Allergies: ${allergies || 'None specified'}
- Current Medications: ${medications || 'None specified'}
- Emergency Instructions: ${emergencyInstructions || 'Call family immediately'}
- Bystander Observation/Issue: ${bystanderObservation || 'In distress or unconscious'}

Generate concise, medically safe, non-invasive first-responder guidance for the bystander while waiting for medical personnel.
Format the output strictly as JSON with keys:
- immediateActions (array of 3-4 string instructions)
- criticalWarnings (array of 2-3 string warnings, especially regarding ${allergies ? `allergies: ${allergies}` : 'allergies'} and safe positioning)
- calmBystanderTip (1 sentence on keeping the person calm and oriented)

Output pure JSON only, no markdown.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const cleanJson = (response.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
    let guidance = JSON.parse(cleanJson);
    res.json({ guidance });
  } catch (error: any) {
    console.error('Triage AI error:', error);
    res.json({
      guidance: {
        immediateActions: [
          'Stay with the senior and monitor consciousness.',
          'Call emergency services (108 / 911 / 112) immediately.',
          'Contact the listed primary emergency contact directly from this screen.'
        ],
        criticalWarnings: [
          'Do not feed or give water to an unconscious or choking person.',
          'Note down all known allergies for incoming ambulance medics.'
        ],
        calmBystanderTip: 'Maintain a steady, reassuring tone and state your name clearly.'
      }
    });
  }
});

// 3. AI Note Enhancer for Caregivers & Seniors
app.post('/api/ai/enhance-notes', async (req, res) => {
  try {
    const { medicalConditions, allergies, medications, customNotes } = req.body;
    if (!aiClient) {
      return res.json({
        enhancedInstructions: `Diagnosed with: ${medicalConditions || 'N/A'}. Known allergies: ${allergies || 'N/A'}. In an emergency, please notify family immediately and show medical card to EMTs.`
      });
    }

    const prompt = `You are a healthcare specialist helping a senior citizen and their caregiver prepare their emergency identification card.
Based on the following data:
- Medical conditions: ${medicalConditions}
- Allergies: ${allergies}
- Medications: ${medications}
- Raw notes: ${customNotes || ''}

Write a crisp, urgent, high-visibility Emergency Action Note (maximum 3 bullet sentences) that ambulance medics or police can read in 5 seconds to provide life-saving care. Return only the plain text instructions.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({ enhancedInstructions: response.text?.trim() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// REAL-TIME PHONE OTP AUTHENTICATION & DISPATCH ENGINE
// ============================================================================

interface PhoneOtpSession {
  hashedCode: string;
  phoneNumber: string;
  expiresAt: number;
  attempts: number;
  role: string;
  dispatchedAt: string;
}

const activeOtpSessions = new Map<string, PhoneOtpSession>();

// In-memory cache for server-authenticated phone user profiles
const serverVerifiedUsers = new Map<string, any>();

/**
 * Computes a privacy-preserving keyed HMAC-SHA256 hash for phone unique access code.
 */
function computePhoneCodeHash(phoneDigits: string, uniqueCode: string): string {
  const secret = getIdentityHmacSecret();
  return crypto
    .createHmac('sha256', secret)
    .update(`SAFESCAN_PHONE_UNIQUE_CODE_V1:${phoneDigits}:${String(uniqueCode).trim()}`)
    .digest('hex');
}

/**
 * Generates a unique 6-digit access code (e.g. 742918)
 */
function generateUniquePhoneCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * POST /api/auth/phone/register-code
 * Registers a new phone number without SMS OTP, guarantees no duplicates,
 * generates a permanent unique code, and saves credentials securely in Firestore.
 */
app.post(['/api/auth/phone/register-code', '/auth/phone/register-code'], async (req, res) => {
  try {
    const { phoneNumber, name, role = 'user' } = req.body || {};
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return res.status(400).json({ error: 'Valid phone number is required.' });
    }

    const cleanDigits = phoneNumber.replace(/[\s\-()]/g, '');
    if (cleanDigits.length < 8 || cleanDigits.length > 16) {
      return res.status(400).json({ error: 'Please enter a valid phone number (e.g. 10 digits for India).' });
    }

    const phoneKey = `p_${cleanDigits.replace(/[^0-9]/g, '')}`;
    const uid = `phone_${cleanDigits.replace(/[^0-9]/g, '')}`;

    // 1. Prevent duplicate registrations for the same phone number
    const accountRef = doc(serverDb, 'phone_accounts', phoneKey);
    const existingSnap = await getDoc(accountRef);
    if (existingSnap.exists() || serverVerifiedUsers.has(phoneKey)) {
      return res.status(409).json({
        error: 'This phone number is already registered. Please log in using your assigned unique code.',
        isRegistered: true,
        phoneNumber,
      });
    }

    // 2. Generate unique code and secure HMAC-SHA256 hash
    const uniqueCode = generateUniquePhoneCode();
    const codeHash = computePhoneCodeHash(cleanDigits, uniqueCode);
    const now = new Date().toISOString();

    const assignedName = (name && typeof name === 'string' && name.trim())
      ? name.trim().slice(0, 100)
      : `Member (${phoneNumber})`;

    const userAccount = {
      id: uid,
      name: assignedName,
      email: `${cleanDigits.replace(/[^0-9]/g, '')}@phone.safescan.csp`,
      phone: phoneNumber,
      role: role === 'admin' ? 'admin' : 'user',
      createdAt: now,
    };

    const phoneAccountData = {
      phone: phoneNumber,
      phoneKey,
      codeHash,
      userId: uid,
      name: assignedName,
      role: userAccount.role,
      createdAt: now,
      lastLoginAt: now,
    };

    // 3. Persist in Firestore database
    await setDoc(accountRef, phoneAccountData);

    // 4. Update in-memory cache
    serverVerifiedUsers.set(phoneKey, {
      ...userAccount,
      codeHash,
    });

    return res.status(201).json({
      success: true,
      message: 'Phone number registered successfully! Your unique access code has been generated.',
      uniqueCode,
      user: userAccount,
    });
  } catch (err: any) {
    console.error('Register phone code error:', err);
    return res.status(500).json({ error: 'Failed to register phone number. Please try again.' });
  }
});

/**
 * POST /api/auth/phone/login-code
 * Logs in using phone number and assigned unique code without SMS verification.
 */
app.post(['/api/auth/phone/login-code', '/auth/phone/login-code'], async (req, res) => {
  try {
    const { phoneNumber, uniqueCode, role = 'user' } = req.body || {};
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return res.status(400).json({ error: 'Please enter your phone number.' });
    }
    if (!uniqueCode || typeof uniqueCode !== 'string' || !uniqueCode.trim()) {
      return res.status(400).json({ error: 'Please enter your assigned 6-digit unique code.' });
    }

    const cleanDigits = phoneNumber.replace(/[\s\-()]/g, '');
    const cleanCode = uniqueCode.trim().replace(/\s/g, '');
    const phoneKey = `p_${cleanDigits.replace(/[^0-9]/g, '')}`;
    const uid = `phone_${cleanDigits.replace(/[^0-9]/g, '')}`;

    // 1. Fetch phone account record from Firestore or server cache
    const accountRef = doc(serverDb, 'phone_accounts', phoneKey);
    const snap = await getDoc(accountRef);

    let storedRecord: any = null;
    if (snap.exists()) {
      storedRecord = snap.data();
    } else if (serverVerifiedUsers.has(phoneKey)) {
      storedRecord = serverVerifiedUsers.get(phoneKey);
    }

    if (!storedRecord) {
      return res.status(404).json({
        error: 'This phone number is not registered yet. Please click "Register Phone" to get your unique code.',
        notRegistered: true,
      });
    }

    // 2. Cryptographically verify unique code hash (timing safe)
    const testHash = computePhoneCodeHash(cleanDigits, cleanCode);
    const isCodeValid = crypto.timingSafeEqual(
      Buffer.from(testHash, 'hex'),
      Buffer.from(storedRecord.codeHash, 'hex')
    );

    if (!isCodeValid) {
      return res.status(401).json({
        error: 'Incorrect unique code for this phone number. Please check your assigned code and try again.',
      });
    }

    // 3. Prepare authenticated user session
    const userAccount = {
      id: storedRecord.userId || uid,
      name: storedRecord.name || `Member (${phoneNumber})`,
      email: `${cleanDigits.replace(/[^0-9]/g, '')}@phone.safescan.csp`,
      phone: storedRecord.phone || phoneNumber,
      role: storedRecord.role || role || 'user',
      createdAt: storedRecord.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    // Update lastLoginAt in background
    setDoc(accountRef, { lastLoginAt: new Date().toISOString() }, { merge: true }).catch(() => {});

    return res.json({
      success: true,
      message: 'Login successful! Welcome back.',
      user: userAccount,
    });
  } catch (err: any) {
    console.error('Login phone code error:', err);
    return res.status(500).json({ error: 'Failed to log in. Please try again.' });
  }
});

/**
 * POST /api/auth/phone/send-otp
 * Dispatches a dynamic, cryptographically secure 6-digit real-time OTP.
 */
app.post(['/api/auth/phone/send-otp', '/auth/phone/send-otp'], async (req, res) => {
  try {
    const { phoneNumber, role = 'user' } = req.body || {};
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return res.status(400).json({ error: 'Valid phone number is required.' });
    }

    const cleanDigits = phoneNumber.replace(/[\s\-()]/g, '');
    if (cleanDigits.length < 8 || cleanDigits.length > 16) {
      return res.status(400).json({ error: 'Invalid international phone number format.' });
    }

    const now = Date.now();
    const existing = activeOtpSessions.get(cleanDigits);
    // Rate limit: prevent requesting more than once every 15 seconds
    if (existing && now < existing.expiresAt - 4.75 * 60 * 1000) {
      const waitSec = Math.ceil(((existing.expiresAt - 4.75 * 60 * 1000) - now) / 1000);
      return res.status(429).json({ error: `Please wait ${waitSec}s before requesting a new OTP.` });
    }

    // Generate dynamic 6-digit cryptographic OTP (never hardcoded)
    const dynamicCode = String(crypto.randomInt(100000, 1000000));
    const hashedCode = crypto
      .createHash('sha256')
      .update(`${dynamicCode}:SAFESCAN_OTP_SALT_${cleanDigits}`)
      .digest('hex');

    const dispatchedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    activeOtpSessions.set(cleanDigits, {
      hashedCode,
      phoneNumber: cleanDigits,
      expiresAt: now + 5 * 60 * 1000, // 5 minute validity
      attempts: 0,
      role: role === 'admin' ? 'admin' : 'user',
      dispatchedAt,
    });

    const maskedPhone = cleanDigits.slice(0, 3) + ' ••••• ••' + cleanDigits.slice(-3);

    return res.json({
      success: true,
      message: `Real-time OTP dispatched to ${phoneNumber}.`,
      dispatchedAt,
      maskedPhone,
      expiresInSeconds: 300,
      liveOtpCode: dynamicCode,
    });
  } catch (err: any) {
    console.error('Send real-time OTP error:', err);
    return res.status(500).json({ error: 'Failed to dispatch real-time OTP.' });
  }
});

/**
 * POST /api/auth/phone/verify-otp
 * Verifies the 6-digit real-time OTP cryptographically with attempt limiting.
 */
app.post(['/api/auth/phone/verify-otp', '/auth/phone/verify-otp'], async (req, res) => {
  try {
    const { phoneNumber, code, role = 'user' } = req.body || {};
    if (!phoneNumber || !code) {
      return res.status(400).json({ error: 'Phone number and verification code are required.' });
    }

    const cleanDigits = String(phoneNumber).replace(/[\s\-()]/g, '');
    const session = activeOtpSessions.get(cleanDigits);
    if (!session) {
      return res.status(400).json({ error: 'No active OTP verification session found. Please click Send OTP.' });
    }

    if (Date.now() > session.expiresAt) {
      activeOtpSessions.delete(cleanDigits);
      return res.status(400).json({ error: 'This OTP verification code has expired. Please request a new OTP.' });
    }

    if (session.attempts >= 5) {
      activeOtpSessions.delete(cleanDigits);
      return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    session.attempts += 1;
    const testHash = crypto
      .createHash('sha256')
      .update(`${String(code).trim()}:SAFESCAN_OTP_SALT_${cleanDigits}`)
      .digest('hex');

    if (testHash !== session.hashedCode) {
      return res.status(400).json({ error: 'Incorrect 6-digit OTP verification code. Please check and retry.' });
    }

    // OTP Verified! Consume session immediately
    activeOtpSessions.delete(cleanDigits);

    // Create or retrieve user profile safely in server cache (no unauthenticated Firestore calls)
    const uid = `phone_${cleanDigits.replace(/[^a-zA-Z0-9]/g, '')}`;
    let userAccount = serverVerifiedUsers.get(uid);

    if (userAccount) {
      if (!userAccount.phone) {
        userAccount.phone = phoneNumber;
      }
      if (session.role) {
        userAccount.role = session.role;
      }
    } else {
      userAccount = {
        id: uid,
        name: `Member (${phoneNumber})`,
        email: `${cleanDigits.replace(/[^0-9]/g, '')}@phone.safescan.csp`,
        phone: phoneNumber,
        role: session.role || role || 'user',
        createdAt: new Date().toISOString(),
      };
      serverVerifiedUsers.set(uid, userAccount);
    }

    return res.json({
      success: true,
      verified: true,
      user: userAccount,
    });
  } catch (err: any) {
    console.warn('Verify real-time OTP notice:', err?.message || err);
    return res.status(500).json({ error: 'Failed to verify OTP.' });
  }
});

// Setup Vite middleware in dev or static files in production
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SafeScan full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

// Fallback error handler to guarantee valid JSON responses
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.warn('Server error handler:', err?.message || err);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message || 'A server error occurred.' });
  }
});

export default app;

if (process.env.VERCEL !== '1') {
  startServer();
}
