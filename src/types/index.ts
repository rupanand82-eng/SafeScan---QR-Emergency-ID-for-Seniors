export type UserRole = 'user' | 'admin' | 'senior' | 'member' | 'caregiver';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  createdAt: string;
}

export interface MemberProfile {
  id: string;
  safeScanId?: string; // Unique SafeScan Emergency ID (e.g. SAFE-0AIK13, SS-1001)
  patientId: string;
  qrId?: string;
  userId: string;
  fullName: string;
  dateOfBirth?: string;
  age: number; // Any age: child, adult, senior
  gender: string;
  photoUrl?: string;
  bloodGroup: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  
  // Medical details
  medicalConditions: string;
  allergies: string;
  medications: string;
  emergencyInstructions: string;
  mobilityAssistance?: string;
  communicationDifficulties?: string;
  identificationMarks?: string;
  languagesSpoken?: string;
  
  // Contacts
  primaryContactName: string;
  primaryContactRelation: string;
  primaryContactPhone: string;
  secondaryContactName?: string;
  secondaryContactRelation?: string;
  secondaryContactPhone?: string;
  
  // Medical care providers
  preferredHospital?: string;
  doctorName?: string;
  doctorContact?: string;
  
  // Security, Identity & QR
  qrToken: string;
  identity_fingerprint?: string; // Server/client keyed HMAC-SHA256 fingerprint for duplicate prevention
  identityMasked?: string; // Masked last-4 format (e.g. XXXX-XXXX-4821), never raw Aadhaar
  identityStatus?: 'verified_unique' | 'legacy_unverified';
  linkedCaregiverIds?: string[];
  status: 'active' | 'disabled';
  isDemo?: boolean;
  publicVisibility: {
    showPhoto: boolean;
    showAge: boolean;
    showBloodGroup: boolean;
    showConditions: boolean;
    showAllergies: boolean;
    showMedications: boolean;
    showHospital: boolean;
    showSecondaryContact: boolean;
    showAddress: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

// Backward-compatible alias for existing codebase
export type SeniorProfile = MemberProfile;

export interface IdentityRegistryEntry {
  identity_fingerprint: string;
  safeScanId: string;
  ownerUserId: string;
  linkedCaregiverIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CaregiverAccessRequest {
  id: string;
  identity_fingerprint: string;
  safeScanId: string;
  ownerUserId: string;
  requesterUserId: string;
  requesterName: string;
  requesterEmail: string;
  relationshipNote: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface DuplicateRegistrationResponse {
  status: 'DUPLICATE_IDENTITY';
  code: 'ALREADY_REGISTERED';
  message: string;
  detail: string;
  isAuthorizedOwner: boolean;
  existingSafeScanId?: string;
  canRequestAccess?: boolean;
}

export interface EmergencyReport {
  id: string;
  seniorId: string; // Member ID
  seniorName?: string; // Member Name
  memberId?: string;
  memberName?: string;
  reporterName: string;
  reporterPhone: string;
  message: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  locationAddress?: string;
  status: 'pending' | 'contacted' | 'resolved';
  createdAt: string;
}

export interface NearbyHospital {
  name: string;
  address: string;
  phone: string;
  type: string;
  mapsUrl: string;
}

export interface TriageGuidance {
  immediateActions: string[];
  criticalWarnings: string[];
  calmBystanderTip: string;
}

