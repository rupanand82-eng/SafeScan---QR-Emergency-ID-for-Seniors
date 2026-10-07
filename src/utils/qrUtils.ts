import QRCode from 'qrcode';
import { SeniorProfile } from '../types';

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

export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 420,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('QR generation error:', err);
    throw err;
  }
}

/**
 * Returns the web URL for opening the Emergency Profile inside the current browser
 */
export function getLocalEmergencyUrl(patientId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://safescan.csp';
  return `${base}/#/emergency/${patientId}`;
}

/**
 * Returns the shareable URL (prefers ais-pre shared URL over private ais-dev container URL)
 */
export function getEmergencyUrl(patientId: string): string {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/^https:\/\/ais-dev-/, 'https://ais-pre-');
    return `${origin}/#/emergency/${patientId}`;
  }
  return `https://safescan.csp/#/emergency/${patientId}`;
}

/**
 * Formats the QR code payload so scanning with ANY mobile phone camera immediately displays
 * the senior's life-saving medical & contact details without hitting AI Studio's private auth wall,
 * while also allowing the in-app SafeScan scanner (/scan) to extract the SafeScan ID and open the full profile.
 */
export function formatEmergencyQrPayload(senior: SeniorProfile, mode: 'card' | 'url' = 'card'): string {
  const safeScanId = (senior.safeScanId || senior.patientId || senior.qrToken || senior.id || '').toUpperCase();
  if (mode === 'url') {
    return getEmergencyUrl(safeScanId);
  }

  const lines = [
    '🚨 SAFESCAN EMERGENCY MEDICAL ID',
    `ID: ${safeScanId}`,
    `Patient: ${senior.fullName} (${senior.age} yrs, ${senior.gender || 'Senior'})`,
    `Blood Group: ${senior.bloodGroup}`,
    `Emergency Contact: ${senior.primaryContactName} (${senior.primaryContactRelation || 'Family'})`,
    `Call Family: ${senior.primaryContactPhone}`,
    ...(senior.secondaryContactPhone
      ? [`Backup Contact: ${senior.secondaryContactName || 'Family'} (${senior.secondaryContactPhone})`]
      : []),
    `Allergies: ${senior.allergies || 'None'}`,
    `Conditions: ${senior.medicalConditions || 'None listed'}`,
    `Medications: ${senior.medications || 'None listed'}`,
    ...(senior.preferredHospital ? [`Hospital: ${senior.preferredHospital}`] : []),
    `Helpline: Call 112 / 108`,
  ];

  return lines.join('\n');
}

export function downloadImage(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

