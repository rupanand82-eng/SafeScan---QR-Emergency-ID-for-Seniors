import React, { useEffect, useState } from 'react';
import { SeniorProfile, EmergencyReport, NearbyHospital, TriageGuidance } from '../types';
import { getSeniorProfile, submitEmergencyReport, extractSafeScanId } from '../services/seniorService';
import {
  PhoneCall,
  AlertTriangle,
  Hospital,
  MapPin,
  ShieldAlert,
  Heart,
  Pill,
  Send,
  Navigation,
  CheckCircle,
  ExternalLink,
  Sparkles,
  ChevronRight,
  User,
  Shield,
  LifeBuoy,
  FileText,
} from 'lucide-react';

interface EmergencyProfilePageProps {
  seniorId: string;
  navigate: (path: string) => void;
}

export const EmergencyProfilePage: React.FC<EmergencyProfilePageProps> = ({ seniorId, navigate }) => {
  const patientId = extractSafeScanId(seniorId);
  const [profile, setProfile] = useState<SeniorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Emergency Reporting Modal & State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [bystanderLocation, setBystanderLocation] = useState<{
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  }>({});
  const [gettingLocation, setGettingLocation] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);

  // Hospital Finder State
  const [showHospitalsModal, setShowHospitalsModal] = useState(false);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [nearbyHospitals, setNearbyHospitals] = useState<NearbyHospital[]>([]);

  // AI Triage & First-Aid State
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [loadingTriage, setLoadingTriage] = useState(false);
  const [triageGuidance, setTriageGuidance] = useState<TriageGuidance | null>(null);
  const [bystanderObservation, setBystanderObservation] = useState('Senior seems confused or disoriented');

  // Load Profile from Database using Patient ID
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        if (!patientId) {
          setError('Invalid Patient ID in QR code.');
          setLoading(false);
          return;
        }

        const data = await getSeniorProfile(patientId);
        if (isCancelled) return;

        if (!data) {
          setError("We couldn't find an emergency profile associated with this QR code.");
        } else if (data.status === 'disabled') {
          setError('This SafeScan emergency profile has been deactivated or reported lost by the registered family/caregiver.');
        } else {
          setProfile(data);
        }
      } catch (err: any) {
        console.error('Failed to load profile:', err);
        if (!isCancelled) {
          setError('Unable to retrieve emergency information. Please try scanning again or contact emergency services.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [patientId]);

  // Fetch Hospitals via Server with Google Maps Grounding
  const handleOpenHospitals = async () => {
    setShowHospitalsModal(true);
    if (nearbyHospitals.length > 0) return;

    try {
      setLoadingHospitals(true);
      const res = await fetch('/api/hospitals/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: bystanderLocation.latitude,
          longitude: bystanderLocation.longitude,
          city: profile?.city,
          state: profile?.state,
          preferredHospital: profile?.preferredHospital,
        }),
      });
      const data = await res.json();
      if (data.hospitals && Array.isArray(data.hospitals)) {
        setNearbyHospitals(data.hospitals);
      }
    } catch (err) {
      console.warn('Failed to fetch hospitals, providing fallbacks:', err);
      setNearbyHospitals([
        {
          name: profile?.preferredHospital || 'City General Emergency Hospital',
          address: `${profile?.city || 'Local area'} Central Hospital Area`,
          phone: '108 / 112',
          type: '24/7 Trauma Emergency',
          mapsUrl: `https://www.google.com/maps/search/emergency+hospitals+near+${encodeURIComponent(profile?.city || 'me')}`,
        },
      ]);
    } finally {
      setLoadingHospitals(false);
    }
  };

  // Fetch AI Emergency Guidance
  const handleOpenTriage = async () => {
    setShowTriageModal(true);
    if (triageGuidance) return;

    try {
      setLoadingTriage(true);
      const res = await fetch('/api/ai/emergency-triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seniorName: profile?.fullName,
          age: profile?.age,
          bloodGroup: profile?.bloodGroup,
          medicalConditions: profile?.medicalConditions,
          allergies: profile?.allergies,
          medications: profile?.medications,
          emergencyInstructions: profile?.emergencyInstructions,
          bystanderObservation,
        }),
      });
      const data = await res.json();
      if (data.guidance) {
        setTriageGuidance(data.guidance);
      }
    } catch (err) {
      console.error('Triage fetch error:', err);
      setTriageGuidance({
        immediateActions: [
          'Keep the senior resting in a calm, shaded, safe environment.',
          'Call their emergency contact or 112 immediately.',
          'Check consciousness and regular breathing.',
        ],
        criticalWarnings: [
          `Do NOT administer any food, water, or medication if they are unconscious or choking.`,
        ],
        calmBystanderTip: 'Speak softly and reassure them that assistance is on the way.',
      });
    } finally {
      setLoadingTriage(false);
    }
  };

  // Browser Geolocation Permission & Capture
  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBystanderLocation({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
        });
        setGettingLocation(false);
      },
      (err) => {
        console.warn('Geolocation denied or unavailable:', err.message);
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Submit Emergency Report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!reportMessage.trim()) return;

    try {
      setSubmittingReport(true);
      const report: EmergencyReport = {
        id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        seniorId: profile.id,
        seniorName: profile.fullName,
        reporterName: reporterName || 'Concerned Bystander',
        reporterPhone: reporterPhone || 'Not provided',
        message: reportMessage,
        latitude: bystanderLocation.latitude,
        longitude: bystanderLocation.longitude,
        accuracy: bystanderLocation.accuracy,
        locationAddress: profile.city ? `Near ${profile.city}` : undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await submitEmergencyReport(report);
      setReportSuccess(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
        setReportMessage('');
      }, 3500);
    } catch (err) {
      console.error('Failed to submit emergency report:', err);
      alert('Could not submit report online. Please call the emergency contact directly!');
    } finally {
      setSubmittingReport(false);
    }
  };

  // 1. LOADING STATE
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-2xl font-black tracking-tight">Loading Emergency Profile...</h2>
        <p className="text-xs text-slate-400 mt-2 max-w-sm">
          Extracting Patient ID <code className="text-red-400 font-mono font-bold">{patientId}</code> and querying database...
        </p>
      </div>
    );
  }

  // 2. ERROR / INVALID QR STATE
  if (error || !profile) {
    const isNotFound =
      error?.toLowerCase().includes("couldn't find") ||
      error?.toLowerCase().includes('not found') ||
      !profile;

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900">
              {isNotFound ? 'Patient Not Found' : 'Unable to Retrieve Profile'}
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Scanned ID: <span className="font-bold text-slate-700">{patientId || 'None'}</span>
            </p>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200">
            {error || "We couldn't find an emergency profile associated with this QR code."}
          </p>

          <div className="space-y-2.5 pt-2">
            <a
              href="tel:112"
              className="w-full py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-sm shadow-md transition flex items-center justify-center gap-2"
            >
              <PhoneCall className="w-4 h-4" />
              <span>📞 Call 112 National Emergency</span>
            </a>

            <button
              onClick={() => navigate('/scan')}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow transition"
            >
              Scan Again
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const vis = profile.publicVisibility;
  const displayPatientId = profile.safeScanId || profile.patientId || profile.qrToken || profile.id;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-20">
      
      {/* Top High-Urgency Emergency Banner */}
      <div className="bg-red-600 text-white px-4 py-3.5 shadow-lg sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="animate-ping w-2.5 h-2.5 rounded-full bg-white opacity-80" />
            <span className="font-black text-xs sm:text-sm tracking-widest uppercase flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" /> 🚨 EMERGENCY PROFILE
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-black uppercase px-2.5 py-0.5 rounded bg-black/30 border border-white/20 text-white">
              ID: {displayPatientId}
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-5">

        {/* 1. EMERGENCY IDENTITY CARD: Name, Age, Blood Group */}
        <div className="bg-white rounded-3xl shadow-md border-2 border-slate-200 p-6 sm:p-7 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            
            {/* Senior Photo */}
            <div className="relative flex-shrink-0">
              <div className="w-28 h-28 rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-300 shadow-md flex items-center justify-center">
                {vis.showPhoto && profile.photoUrl ? (
                  <img
                    src={profile.photoUrl}
                    alt={profile.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-14 h-14 text-slate-400" />
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 bg-red-600 text-white font-black text-sm px-2.5 py-1 rounded-lg shadow-md border-2 border-white">
                {profile.bloodGroup}
              </div>
            </div>

            {/* Core Patient Details */}
            <div className="flex-1 text-center sm:text-left space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  Patient ID: {displayPatientId}
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> SafeScan Verified
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                {profile.fullName}
              </h1>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1 text-sm text-slate-700 font-semibold">
                <span className="bg-slate-100 px-3 py-1 rounded-xl">
                  Age: <strong className="text-slate-900">{profile.age} yrs</strong>
                </span>
                <span className="bg-slate-100 px-3 py-1 rounded-xl">
                  Gender: <strong className="text-slate-900">{profile.gender}</strong>
                </span>
                <span className="bg-red-50 text-red-800 border border-red-200 px-3 py-1 rounded-xl font-black">
                  Blood Group: {profile.bloodGroup}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. PROMINENT CALL BUTTONS: Call Emergency Contact & Call 112 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          
          {/* Prominent Call Emergency Contact */}
          <a
            href={`tel:${profile.primaryContactPhone.replace(/[^0-9+]/g, '')}`}
            className="flex items-center justify-between p-4 sm:p-5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-3xl shadow-lg shadow-emerald-600/25 transition group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <PhoneCall className="w-7 h-7 text-white" />
              </div>
              <div className="text-left">
                <span className="text-[11px] font-bold text-emerald-100 uppercase tracking-wider block">
                  Emergency Contact
                </span>
                <span className="text-lg font-black block leading-tight">
                  CALL {profile.primaryContactName.toUpperCase()}
                </span>
                <span className="text-xs font-medium text-emerald-200 font-mono">
                  {profile.primaryContactPhone} ({profile.primaryContactRelation})
                </span>
              </div>
            </div>
            <ChevronRight className="w-6 h-6 text-white/70 group-hover:translate-x-1 transition" />
          </a>

          {/* Prominent Call 112 National Emergency */}
          <a
            href="tel:112"
            className="flex items-center justify-between p-4 sm:p-5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-3xl shadow-lg shadow-red-600/25 transition group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <PhoneCall className="w-7 h-7 text-white" />
              </div>
              <div className="text-left">
                <span className="text-[11px] font-bold text-red-100 uppercase tracking-wider block">
                  National Emergency Service
                </span>
                <span className="text-lg font-black block leading-tight">
                  📞 CALL 112
                </span>
                <span className="text-xs font-medium text-red-200">
                  Ambulance, Police & Fire (Toll-Free)
                </span>
              </div>
            </div>
            <ChevronRight className="w-6 h-6 text-white/70 group-hover:translate-x-1 transition" />
          </a>

        </div>

        {/* 3. VITAL MEDICAL SUMMARY BOX */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-600" />
            Medical & Medication Profile
          </h2>

          <div className="space-y-4">
            {/* Chronic Medical Conditions */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Medical Conditions
              </span>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-slate-900 font-bold text-sm">
                {profile.medicalConditions || 'Type 2 Diabetes'}
              </div>
            </div>

            {/* Severe Allergies */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-red-600 block mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Severe Allergies
              </span>
              <div className={`p-3.5 rounded-2xl border text-sm font-black ${
                profile.allergies && profile.allergies.toLowerCase() !== 'none'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                {profile.allergies || 'None'}
              </div>
            </div>

            {/* Critical Medications */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1 flex items-center gap-1">
                <Pill className="w-3.5 h-3.5 text-blue-600" /> Critical Medications
              </span>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-slate-900 font-bold text-sm">
                {profile.medications || 'Metformin 500 mg — Once daily'}
              </div>
            </div>
          </div>
        </div>

        {/* 4. EMERGENCY ACTION INSTRUCTIONS */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-black text-slate-900">Emergency Action Instructions</h2>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 space-y-2 text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
            <p className="font-bold text-amber-950">
              Guidance for Responders & Bystanders:
            </p>
            <div className="whitespace-pre-line space-y-1.5">
              {profile.emergencyInstructions || (
                `1. Check whether the person is conscious and breathing normally.
2. Call 112 if the situation is serious.
3. Do not give food, water, or medicine to an unconscious person.
4. Keep the person safe and avoid unnecessary movement.
5. Inform medical professionals about the patient's known conditions and medications.
6. Stay with the person until medical help arrives.`
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 italic">
            These instructions are general first-aid guidance and must not replace professional medical care.
          </p>
        </div>

        {/* 5. INTERACTIVE TOOLS: FIND HOSPITAL, AI TRIAGE, REPORT INCIDENT */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          <button
            onClick={handleOpenHospitals}
            className="flex flex-col items-center justify-center p-4 bg-white hover:bg-slate-50 border-2 border-slate-200 rounded-2xl shadow-sm text-center transition"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
              <Hospital className="w-5 h-5" />
            </div>
            <span className="font-bold text-sm text-slate-900 leading-tight">Find Hospital</span>
            <span className="text-[11px] text-slate-500 mt-0.5">Nearby trauma centers</span>
          </button>

          <button
            onClick={handleOpenTriage}
            className="flex flex-col items-center justify-center p-4 bg-white hover:bg-slate-50 border-2 border-slate-200 rounded-2xl shadow-sm text-center transition"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-bold text-sm text-slate-900 leading-tight">First-Aid Advice</span>
            <span className="text-[11px] text-slate-500 mt-0.5">AI triage guidance</span>
          </button>

          <button
            onClick={() => setShowReportModal(true)}
            className="flex flex-col items-center justify-center p-4 bg-white hover:bg-red-50 border-2 border-red-200 rounded-2xl shadow-sm text-center transition"
          >
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="font-bold text-sm text-red-700 leading-tight">Report Incident</span>
            <span className="text-[11px] text-red-600 mt-0.5">Log location & message</span>
          </button>

        </div>

        {/* 6. SECONDARY CONTACT & DOCTOR IF AVAILABLE */}
        {(profile.secondaryContactPhone || profile.doctorName || profile.preferredHospital) && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-3 text-xs">
            <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">
              Additional Care Providers & Contacts
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
              {profile.secondaryContactPhone && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-500 block uppercase text-[10px]">
                    Secondary Family Contact
                  </span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">
                    {profile.secondaryContactName || 'Family'} ({profile.secondaryContactRelation || 'Relative'})
                  </p>
                  <a
                    href={`tel:${profile.secondaryContactPhone.replace(/[^0-9+]/g, '')}`}
                    className="text-blue-600 font-bold hover:underline mt-1 inline-block"
                  >
                    📞 Call {profile.secondaryContactPhone}
                  </a>
                </div>
              )}

              {profile.preferredHospital && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-500 block uppercase text-[10px]">
                    Preferred Hospital
                  </span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">
                    {profile.preferredHospital}
                  </p>
                  {profile.doctorName && (
                    <p className="text-slate-600 text-xs mt-1">
                      Doctor: {profile.doctorName} {profile.doctorContact ? `(${profile.doctorContact})` : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 7. DISCLAIMER & REGISTRY VERIFICATION */}
        <div className="p-5 bg-white rounded-3xl border border-slate-200 text-xs text-slate-500 space-y-2">
          <p className="leading-relaxed">
            <strong className="text-slate-800">SafeScan emergency profile</strong> — information provided by the registered user/caregiver.
          </p>
          <p className="italic bg-slate-50 p-3 rounded-2xl border border-slate-200 leading-relaxed text-slate-600">
            "This system is intended for emergency identification and assistance. It does not replace professional medical services."
          </p>
          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 font-mono">
            <span>Patient ID: {displayPatientId}</span>
            <span>Database Status: ACTIVE</span>
          </div>
        </div>

      </main>

      {/* --- MODAL 1: REPORT AN EMERGENCY --- */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-6">
            
            <div className="px-6 py-4 bg-red-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-extrabold text-base">Report an Emergency Incident</h3>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-white/80 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {reportSuccess ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h4 className="text-xl font-bold text-slate-900">Emergency Report Submitted!</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Your incident message has been stored in SafeScan. If immediate medical care is needed, please call 112 or the emergency contact directly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="p-6 space-y-4">
                <p className="text-xs text-slate-600">
                  Are you with <strong>{profile.fullName}</strong> right now? Submit details below to record where and when they were found.
                </p>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Your Name (Bystander / Responder)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh / Police Officer / Good Samaritan"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Your Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 98765 43210"
                    value={reporterPhone}
                    onChange={(e) => setReporterPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Situation / Condition Observation *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Found sitting on bench, confused and unable to remember home address. No physical bleeding."
                    value={reportMessage}
                    onChange={(e) => setReportMessage(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                {/* GPS Location Button */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Navigation className="w-3.5 h-3.5 text-blue-600" /> GPS Location Tag
                    </span>
                    <button
                      type="button"
                      onClick={handleRequestLocation}
                      disabled={gettingLocation}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
                    >
                      {gettingLocation ? 'Acquiring GPS...' : bystanderLocation.latitude ? 'GPS Attached ✓' : 'Attach My Location'}
                    </button>
                  </div>

                  {bystanderLocation.latitude ? (
                    <p className="text-[11px] text-emerald-700 font-mono font-semibold">
                      Latitude: {bystanderLocation.latitude}, Longitude: {bystanderLocation.longitude} (±{bystanderLocation.accuracy}m)
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Permission will be requested by your browser. No continuous tracking.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReport}
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submittingReport ? 'Submitting...' : 'Submit Emergency Report'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* --- MODAL 2: NEARBY HOSPITALS (Maps Grounded) --- */}
      {showHospitalsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-6">
            
            <div className="px-6 py-4 bg-blue-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hospital className="w-5 h-5" />
                <div>
                  <h3 className="font-extrabold text-base">Nearby Emergency Hospitals</h3>
                  <p className="text-xs text-blue-200">Grounded with Google Maps live directory</p>
                </div>
              </div>
              <button
                onClick={() => setShowHospitalsModal(false)}
                className="text-white/80 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {loadingHospitals ? (
                <div className="py-12 text-center text-slate-600 space-y-3">
                  <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-semibold">Finding 24/7 Emergency Rooms & Trauma Care...</p>
                </div>
              ) : nearbyHospitals.length > 0 ? (
                <div className="space-y-3">
                  {nearbyHospitals.map((h, i) => (
                    <div key={i} className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-sm leading-tight">{h.name}</h4>
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                            {h.type}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 mt-2 flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                        <span>{h.address}</span>
                      </p>

                      <div className="mt-3 flex items-center gap-2">
                        <a
                          href={`tel:${h.phone.replace(/[^0-9]/g, '') || '112'}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
                        >
                          <PhoneCall className="w-3 h-3" />
                          Call {h.phone}
                        </a>
                        <a
                          href={h.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Directions on Maps
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No local hospitals returned. Please call 112 or 108 immediately.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* --- MODAL 3: AI FIRST-AID / TRIAGE GUIDANCE --- */}
      {showTriageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-6">
            
            <div className="px-6 py-4 bg-purple-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-extrabold text-base">AI First-Aid Guidance</h3>
                  <p className="text-xs text-purple-200">Personalized for {profile.fullName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowTriageModal(false)}
                className="text-white/80 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              
              {loadingTriage ? (
                <div className="py-12 text-center text-slate-600 space-y-3">
                  <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-semibold">Analyzing condition and allergies for safe guidance...</p>
                </div>
              ) : triageGuidance ? (
                <div className="space-y-4">
                  {/* Immediate actions */}
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <h4 className="font-bold text-emerald-950 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600" /> Immediate Actions
                    </h4>
                    <ul className="space-y-2 text-xs text-emerald-900 font-medium">
                      {triageGuidance.immediateActions.map((act, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-emerald-200 text-emerald-900 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Critical warnings */}
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <h4 className="font-bold text-red-950 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600" /> Critical Warnings (DO NOT DO)
                    </h4>
                    <ul className="space-y-2 text-xs text-red-900 font-bold">
                      {triageGuidance.criticalWarnings.map((warn, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-red-600 font-black">•</span>
                          <span>{warn}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Calm tip */}
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900">
                    <span className="font-bold block text-[10px] uppercase tracking-wider text-purple-700">
                      Reassurance Tip:
                    </span>
                    <p className="mt-0.5">{triageGuidance.calmBystanderTip}</p>
                  </div>
                </div>
              ) : null}

              <p className="text-[11px] text-slate-500 italic text-center pt-2">
                This guidance is generated for supportive bystander care and does not replace emergency medical personnel.
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
