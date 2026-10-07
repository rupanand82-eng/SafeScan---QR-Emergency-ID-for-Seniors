import React, { useEffect, useState, useRef } from 'react';
import { SeniorProfile } from '../types';
import { generateQrDataUrl, formatEmergencyQrPayload, downloadImage } from '../utils/qrUtils';
import { Printer, Download, ShieldAlert, Heart, Phone, Hospital, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface EmergencyCardProps {
  senior: SeniorProfile;
  onClose?: () => void;
}

export const EmergencyCard: React.FC<EmergencyCardProps> = ({ senior, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const cardRef = useRef<HTMLDivElement>(null);
  const safeScanId = senior.safeScanId || senior.patientId || senior.qrToken || senior.id;
  const qrPayload = formatEmergencyQrPayload(senior, 'card');

  useEffect(() => {
    generateQrDataUrl(qrPayload).then(setQrDataUrl);
  }, [qrPayload]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadQr = () => {
    if (qrDataUrl) {
      downloadImage(qrDataUrl, `SafeScan-QR-${senior.fullName.replace(/\s+/g, '_')}.png`);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-w-2xl mx-auto my-4 print:shadow-none print:border-none print:m-0">
      {/* Header controls (hidden when printing) */}
      <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm">
            SS
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-wide">SafeScan Printable ID Card</h3>
            <p className="text-xs text-slate-400">Standard Wallet / Lanyard Badge Size</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadQr}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Save QR PNG
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Card
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xs px-2 py-1"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Card Body - Printable container */}
      <div ref={cardRef} className="p-6 bg-slate-100 print:bg-white print:p-0 flex flex-col items-center gap-6">
        
        {/* FRONT OF CARD */}
        <div className="w-full max-w-[420px] bg-white rounded-xl border-2 border-slate-800 shadow-md p-5 flex flex-col justify-between relative overflow-hidden print:shadow-none print:border-2 print:border-black">
          {/* Top Brand Banner */}
          <div className="flex items-center justify-between border-b-2 border-red-600 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-red-600 text-white font-black text-xs flex items-center justify-center">
                🆘
              </div>
              <div>
                <span className="font-extrabold text-base tracking-wider text-slate-900 block leading-tight">
                  SAFE SCAN
                </span>
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest block">
                  EMERGENCY IDENTIFICATION
                </span>
              </div>
            </div>
            <div className="bg-red-50 text-red-700 text-[11px] font-black px-2 py-0.5 rounded border border-red-200">
              SENIOR ID
            </div>
          </div>

          {/* Main Info with Photo & QR */}
          <div className="grid grid-cols-12 gap-3 items-center my-1">
            {/* Senior Photo & Blood Group */}
            <div className="col-span-4 flex flex-col items-center">
              <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-slate-300 bg-slate-100 shadow-inner flex items-center justify-center">
                {senior.photoUrl ? (
                  <img
                    src={senior.photoUrl}
                    alt={senior.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-2xl font-bold text-slate-400">
                    {senior.fullName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="mt-1.5 w-full text-center">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Blood Group</span>
                <span className="inline-block bg-red-600 text-white font-black text-xs px-2 py-0.5 rounded">
                  {senior.bloodGroup}
                </span>
              </div>
            </div>

            {/* Emergency Contacts & Details */}
            <div className="col-span-8 flex flex-col justify-center space-y-1 pl-1">
              <div>
                <span className="text-[9px] uppercase text-slate-400 font-bold block">Full Name</span>
                <p className="text-base font-extrabold text-slate-900 leading-tight">
                  {senior.fullName}
                </p>
                <p className="text-xs text-slate-600 font-medium">
                  Age: {senior.age} yrs • {senior.gender}
                </p>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <span className="text-[9px] uppercase text-red-600 font-bold flex items-center gap-1">
                  <Phone className="w-2.5 h-2.5" /> Emergency Contact
                </span>
                <p className="text-xs font-bold text-slate-800">
                  {senior.primaryContactName} ({senior.primaryContactRelation})
                </p>
                <p className="text-xs font-black text-blue-700 tracking-wide font-mono">
                  {senior.primaryContactPhone}
                </p>
              </div>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="mt-3 pt-2 border-t-2 border-dashed border-slate-300 flex items-center justify-between gap-3 bg-slate-50 p-2 rounded-lg">
            <div className="flex-1">
              <span className="text-[10px] font-extrabold text-slate-900 tracking-wide block uppercase">
                Scan for Medical & Emergency Info
              </span>
              <p className="text-[9px] text-slate-600 mt-0.5 leading-snug">
                If found disoriented, injured, or unconscious, scan with any smartphone camera.
              </p>
              <div className="mt-1 flex items-center gap-1 text-[9px] font-mono text-slate-500 font-semibold">
                SafeScan ID: <span className="font-bold text-red-600">{safeScanId}</span>
              </div>
            </div>
            <div className="w-20 h-20 bg-white p-1 rounded-md border border-slate-300 flex-shrink-0 flex items-center justify-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="SafeScan QR" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full bg-slate-100 animate-pulse" />
              )}
            </div>
          </div>

          {/* Bottom Card Footer */}
          <div className="mt-2 text-center text-[8px] text-slate-500 font-medium border-t border-slate-200 pt-1">
            SafeScan Community Service Project • Dial 108 / 112 for Ambulance
          </div>
        </div>

        {/* BACK OF CARD (Medical Alerts & Hospital) */}
        <div className="w-full max-w-[420px] bg-white rounded-xl border-2 border-slate-800 shadow-md p-5 flex flex-col justify-between print:shadow-none print:border-2 print:border-black">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-2">
              <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-red-500" /> Critical Medical Alert
              </span>
              <span className="text-[10px] font-mono text-slate-500 font-bold">EMERGENCY BACK</span>
            </div>

            {/* Medical Conditions */}
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Medical Conditions</span>
                <p className="font-semibold text-slate-900 leading-tight">
                  {senior.medicalConditions || 'No chronic conditions listed'}
                </p>
              </div>

              {/* Allergies - High Alert */}
              <div className="bg-red-50 border border-red-200 rounded p-1.5">
                <span className="text-[9px] uppercase font-black text-red-700 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-600" /> Known Allergies (DO NOT ADMINISTER)
                </span>
                <p className="font-bold text-red-900 text-xs mt-0.5">
                  {senior.allergies || 'No known drug or food allergies'}
                </p>
              </div>

              {/* Emergency Instructions */}
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Emergency Instructions</span>
                <p className="text-slate-700 italic text-[11px] leading-snug">
                  "{senior.emergencyInstructions || 'Please contact emergency contact immediately.'}"
                </p>
              </div>

              {/* Hospital & Doctor */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[10px]">
                <div>
                  <span className="font-bold text-slate-500 block uppercase text-[8px]">Preferred Hospital</span>
                  <p className="font-semibold text-slate-800 truncate">{senior.preferredHospital || 'Nearest Hospital'}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block uppercase text-[8px]">Doctor Contact</span>
                  <p className="font-semibold text-slate-800 truncate">
                    {senior.doctorName ? `${senior.doctorName} (${senior.doctorContact || ''})` : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
            <span>Scan QR on front for live profile updates</span>
            <span className="font-bold text-slate-800">SafeScan ID Card</span>
          </div>
        </div>

      </div>

      {/* Helpful Instructions */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-center gap-2 print:hidden">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span>
          Tip: Print on standard cardstock or laminate for wristbands, wallet cards, or elderly necklace pendants.
        </span>
      </div>
    </div>
  );
};
