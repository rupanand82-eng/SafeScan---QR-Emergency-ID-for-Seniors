import React, { useEffect, useState } from 'react';
import { SeniorProfile } from '../types';
import {
  generateQrDataUrl,
  getEmergencyUrl,
  getLocalEmergencyUrl,
  formatEmergencyQrPayload,
  downloadImage,
} from '../utils/qrUtils';
import { EmergencyCard } from './EmergencyCard';
import { Download, ExternalLink, Copy, Check, Printer, X, ShieldCheck, Smartphone, Globe } from 'lucide-react';

interface QRDisplayModalProps {
  senior: SeniorProfile;
  isOpen: boolean;
  onClose: () => void;
}

export const QRDisplayModal: React.FC<QRDisplayModalProps> = ({ senior, isOpen, onClose }) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [qrMode, setQrMode] = useState<'card' | 'url'>('card');
  const [copied, setCopied] = useState(false);
  const [showFullCard, setShowFullCard] = useState(false);

  const safeScanId = senior.safeScanId || senior.patientId || senior.qrToken || senior.id;
  const emergencyUrl = getEmergencyUrl(safeScanId);
  const localTestUrl = getLocalEmergencyUrl(safeScanId);
  const qrPayload = formatEmergencyQrPayload(senior, qrMode);

  useEffect(() => {
    if (isOpen) {
      generateQrDataUrl(qrPayload).then(setQrUrl);
    }
  }, [isOpen, qrPayload]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(qrMode === 'card' ? qrPayload : emergencyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (qrUrl) {
      downloadImage(qrUrl, `SafeScan-${senior.fullName.replace(/\s+/g, '_')}-QR.png`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-base leading-tight">SafeScan Emergency QR</h3>
              <p className="text-xs text-slate-400">{senior.fullName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal View toggle */}
        {showFullCard ? (
          <div className="p-4">
            <button
              onClick={() => setShowFullCard(false)}
              className="mb-2 text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              ← Back to Simple QR View
            </button>
            <EmergencyCard senior={senior} onClose={onClose} />
          </div>
        ) : (
          <div className="p-6 text-center">
            {/* Blood group & status pill */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                Blood Group: {senior.bloodGroup}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                senior.status === 'active'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                {senior.status === 'active' ? '● QR Active' : '● QR Disabled'}
              </span>
            </div>

            {/* QR Format Toggle */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 mb-3">
              <button
                type="button"
                onClick={() => setQrMode('card')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  qrMode === 'card'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Universal Phone Scan (No Login)
              </button>
              <button
                type="button"
                onClick={() => setQrMode('url')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  qrMode === 'url'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Web App Link
              </button>
            </div>

            {/* QR Code Container */}
            <div className="inline-block p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-inner my-1">
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt={`QR for ${senior.fullName}`}
                  className="w-56 h-56 mx-auto object-contain"
                />
              ) : (
                <div className="w-56 h-56 bg-slate-100 animate-pulse rounded-lg" />
              )}
            </div>

            <p className="text-xs text-slate-500 mt-2">
              SafeScan ID: <span className="font-mono font-bold text-red-600">{safeScanId}</span>
            </p>

            {/* Info banner explaining scan mode */}
            <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 text-left leading-relaxed">
              {qrMode === 'card' ? (
                <span>
                  <strong>✓ Instant Mobile Scan Ready:</strong> Scanning this QR with any phone camera immediately displays {senior.fullName}'s blood group, allergies, and clickable emergency contact phone number—without requiring AI Studio login—and also opens the full profile when scanned in SafeScan's <strong>Scan QR</strong> page.
                </span>
              ) : (
                <span>
                  <strong>Web App URL Mode:</strong> Encodes the direct web link. Note: To open web links on external phones outside AI Studio, make sure you click <strong>Share / Publish</strong> in AI Studio first.
                </span>
              )}
            </div>

            {/* Direct URL input bar with copy */}
            <div className="mt-3 flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <input
                type="text"
                readOnly
                value={emergencyUrl}
                className="w-full bg-transparent px-2 text-xs font-mono text-slate-600 outline-none truncate"
              />
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 shadow-sm transition flex-shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* Actions */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
              >
                <Download className="w-4 h-4" />
                Save PNG
              </button>
              
              <button
                onClick={() => setShowFullCard(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition border border-blue-200"
              >
                <Printer className="w-4 h-4" />
                Print ID Card
              </button>

              <a
                href={localTestUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition"
              >
                <ExternalLink className="w-4 h-4" />
                Test Open
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

