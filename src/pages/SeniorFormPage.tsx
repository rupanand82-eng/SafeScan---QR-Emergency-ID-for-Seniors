import React, { useState, useEffect, useRef } from 'react';
import { SeniorProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { getSeniorProfile, saveSeniorProfile, getNextPatientId, generateSafeScanId } from '../services/seniorService';
import {
  User,
  Heart,
  Phone,
  Hospital,
  AlertTriangle,
  Eye,
  Sparkles,
  Save,
  ArrowLeft,
  CheckCircle2,
  ShieldAlert,
  Upload,
  Camera,
  Image as ImageIcon,
  Trash2,
  Link as LinkIcon,
} from 'lucide-react';

interface SeniorFormPageProps {
  seniorId?: string; // If editing
  navigate: (path: string) => void;
}

export const SeniorFormPage: React.FC<SeniorFormPageProps> = ({ seniorId, navigate }) => {
  const { userAccount } = useAuth();
  const isEditing = Boolean(seniorId);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [assignedPatientId, setAssignedPatientId] = useState<string>(seniorId || generateSafeScanId());

  // Form State
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [age, setAge] = useState<number>(68);
  const [gender, setGender] = useState('Male');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoFileName, setPhotoFileName] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMode, setPhotoMode] = useState<'upload' | 'url'>('upload');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  // Medical
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');
  const [emergencyInstructions, setEmergencyInstructions] = useState('');
  const [mobilityAssistance, setMobilityAssistance] = useState('');
  const [communicationDifficulties, setCommunicationDifficulties] = useState('');
  const [identificationMarks, setIdentificationMarks] = useState('');
  const [languagesSpoken, setLanguagesSpoken] = useState('English, Hindi');

  // Contacts
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [primaryContactRelation, setPrimaryContactRelation] = useState('Child (Son/Daughter)');
  const [primaryContactPhone, setPrimaryContactPhone] = useState('');
  const [secondaryContactName, setSecondaryContactName] = useState('');
  const [secondaryContactRelation, setSecondaryContactRelation] = useState('');
  const [secondaryContactPhone, setSecondaryContactPhone] = useState('');

  // Medical care
  const [preferredHospital, setPreferredHospital] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [doctorContact, setDoctorContact] = useState('');

  // Visibility Toggles
  const [publicVisibility, setPublicVisibility] = useState({
    showPhoto: true,
    showAge: true,
    showBloodGroup: true,
    showConditions: true,
    showAllergies: true,
    showMedications: true,
    showHospital: true,
    showSecondaryContact: true,
    showAddress: false, // Default private for safety
  });

  // Load existing profile if editing or assign next Patient ID
  useEffect(() => {
    if (seniorId) {
      async function load() {
        try {
          setLoading(true);
          const data = await getSeniorProfile(seniorId!);
          if (data) {
            setAssignedPatientId(data.safeScanId || data.patientId || data.id);
            setFullName(data.fullName);
            setDateOfBirth(data.dateOfBirth || '');
            setAge(data.age || 68);
            setGender(data.gender || 'Male');
            setPhotoUrl(data.photoUrl || '');
            setPhone(data.phone || '');
            setAddress(data.address || '');
            setCity(data.city || '');
            setState(data.state || '');
            setPincode(data.pincode || '');
            setBloodGroup(data.bloodGroup || 'O+');
            setMedicalConditions(data.medicalConditions || '');
            setAllergies(data.allergies || '');
            setMedications(data.medications || '');
            setEmergencyInstructions(data.emergencyInstructions || '');
            setMobilityAssistance(data.mobilityAssistance || '');
            setCommunicationDifficulties(data.communicationDifficulties || '');
            setIdentificationMarks(data.identificationMarks || '');
            setLanguagesSpoken(data.languagesSpoken || 'English, Hindi');
            setPrimaryContactName(data.primaryContactName);
            setPrimaryContactRelation(data.primaryContactRelation);
            setPrimaryContactPhone(data.primaryContactPhone);
            setSecondaryContactName(data.secondaryContactName || '');
            setSecondaryContactRelation(data.secondaryContactRelation || '');
            setSecondaryContactPhone(data.secondaryContactPhone || '');
            setPreferredHospital(data.preferredHospital || '');
            setDoctorName(data.doctorName || '');
            setDoctorContact(data.doctorContact || '');
            if (data.publicVisibility) {
              setPublicVisibility(data.publicVisibility);
            }
          }
        } catch (e) {
          console.error('Error loading senior profile:', e);
        } finally {
          setLoading(false);
        }
      }
      load();
    } else {
      getNextPatientId().then((nextId) => {
        setAssignedPatientId(nextId);
      });
      // Prepopulate default medical action instructions
      if (!emergencyInstructions) {
        setEmergencyInstructions(
`1. Check whether the person is conscious and breathing normally.
2. Call 112 if the situation is serious.
3. Do not give food, water, or medicine to an unconscious person.
4. Keep the person safe and avoid unnecessary movement.
5. Inform medical professionals about the patient's known conditions and medications.
6. Stay with the person until medical help arrives.`
        );
      }
    }
  }, [seniorId]);

  // Handle Media File Upload & Compression
  const handlePhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image media file (JPG, PNG, WEBP, etc.).');
      return;
    }

    setPhotoUploading(true);
    setPhotoFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const resultDataUrl = event.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        // Compress and resize to max 360x360 so it fits comfortably in Firestore and loads fast
        const MAX_SIZE = 360;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setPhotoUrl(compressedDataUrl);
        } else {
          setPhotoUrl(resultDataUrl);
        }
        setPhotoUploading(false);
      };
      img.onerror = () => {
        setPhotoUrl(resultDataUrl);
        setPhotoUploading(false);
      };
      img.src = resultDataUrl;
    };
    reader.onerror = () => {
      alert('Failed to read the selected media file.');
      setPhotoUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // AI Note Enhancer Call
  const handleEnhanceWithAI = async () => {
    try {
      setAiEnhancing(true);
      const res = await fetch('/api/ai/enhance-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicalConditions,
          allergies,
          medications,
          customNotes: emergencyInstructions,
        }),
      });
      const data = await res.json();
      if (data.enhancedInstructions) {
        setEmergencyInstructions(data.enhancedInstructions);
      }
    } catch (e) {
      console.error('AI enhance note error:', e);
      alert('AI assistant unavailable; please write instructions manually.');
    } finally {
      setAiEnhancing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !primaryContactName.trim() || !primaryContactPhone.trim()) {
      alert('Please fill out the Senior Full Name and Primary Emergency Contact information.');
      return;
    }

    try {
      setSaving(true);
      const now = new Date().toISOString();
      const finalPatientId = (assignedPatientId || seniorId || generateSafeScanId()).toUpperCase().trim();

      const profile: SeniorProfile = {
        id: finalPatientId,
        safeScanId: finalPatientId,
        patientId: finalPatientId,
        qrToken: finalPatientId,
        qrId: finalPatientId,
        userId: userAccount?.id || 'demo-user-id',
        fullName,
        dateOfBirth,
        age: Number(age) || 68,
        gender,
        photoUrl: photoUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400',
        bloodGroup,
        phone,
        address,
        city,
        state,
        pincode,
        medicalConditions,
        allergies: allergies || 'None',
        medications,
        emergencyInstructions: emergencyInstructions || `1. Check whether the person is conscious and breathing normally.
2. Call 112 if the situation is serious.
3. Do not give food, water, or medicine to an unconscious person.
4. Keep the person safe and avoid unnecessary movement.
5. Inform medical professionals about the patient's known conditions and medications.
6. Stay with the person until medical help arrives.`,
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
        status: 'active',
        publicVisibility,
        createdAt: now,
        updatedAt: now,
      };

      await saveSeniorProfile(profile);
      setSaveSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err: any) {
      console.error('Save profile error:', err);
      alert('Failed to save senior profile. Please check connection.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Top Back bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <span className="text-xs text-slate-400 font-mono">
            {isEditing ? `Editing: ${fullName}` : 'New Registration'}
          </span>
        </div>

        {/* Form Title Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {isEditing ? 'Update Patient Emergency Profile' : 'Register Patient Emergency Profile'}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Saved data is stored in the database and linked to this unique Patient ID.
                </p>
              </div>
            </div>

            {assignedPatientId && (
              <div className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white font-mono text-xs font-bold flex items-center gap-2 self-start sm:self-center shadow-sm">
                <span className="text-slate-400 uppercase text-[10px]">SafeScan ID:</span>
                <span className="text-red-400 text-sm font-black tracking-wide">{assignedPatientId}</span>
              </div>
            )}
          </div>
        </div>

        {saveSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-sm font-bold animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>Profile and Emergency QR code saved successfully! Redirecting to Dashboard...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* 1. PERSONAL INFORMATION */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="w-5 h-5 text-blue-600" />
              <h2 className="font-extrabold text-base text-slate-900">1. Personal Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Age (Years) *
                </label>
                <input
                  type="number"
                  required
                  min={40}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Senior Personal Phone (If carrying mobile)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Profile Photo Media Upload & URL Selector */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Senior Profile Photo (Upload Media File, Camera, or Link)
                  </label>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setPhotoMode('upload')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition ${
                        photoMode === 'upload'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <ImageIcon className="w-3 h-3" />
                      Select Media File
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoMode('url')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition ${
                        photoMode === 'url'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <LinkIcon className="w-3 h-3" />
                      Image URL
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center gap-4">
                  {/* Live Photo Preview */}
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-white border-2 border-slate-200 shadow-sm flex items-center justify-center flex-shrink-0">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt="Senior Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-9 h-9 text-slate-300" />
                    )}
                    {photoUploading && (
                      <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Upload Controls or URL Input */}
                  <div className="flex-1 w-full space-y-2.5">
                    {photoMode === 'upload' ? (
                      <div className="space-y-2">
                        {/* Hidden File Inputs for Media Library & Camera */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoFileSelect}
                          className="hidden"
                        />
                        <input
                          ref={cameraInputRef}
                          type="file"
                          accept="image/*"
                          capture="user"
                          onChange={handlePhotoFileSelect}
                          className="hidden"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Browse Media / Gallery
                          </button>

                          <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                          >
                            <Camera className="w-3.5 h-3.5 text-blue-600" />
                            Take Photo
                          </button>

                          {photoUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setPhotoUrl('');
                                setPhotoFileName('');
                                if (fileInputRef.current) fileInputRef.current.value = '';
                                if (cameraInputRef.current) cameraInputRef.current.value = '';
                              }}
                              className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500">
                          {photoFileName
                            ? `Selected media: ${photoFileName}`
                            : photoUrl
                            ? 'Photo attached and ready for emergency ID card.'
                            : 'Select a photo from your device media files (JPG, PNG, WEBP) or capture directly with camera.'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            placeholder="https://... paste direct photo image link"
                            value={photoUrl.startsWith('data:') ? '' : photoUrl}
                            onChange={(e) => {
                              setPhotoFileName('');
                              setPhotoUrl(e.target.value);
                            }}
                            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                          {photoUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setPhotoUrl('');
                                setPhotoFileName('');
                              }}
                              className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition flex-shrink-0"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Paste a public image URL or switch to "Select Media File" to upload from your device.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Residential Address
                </label>
                <input
                  type="text"
                  placeholder="Street / House Number, Apartment, Locality"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hyderabad"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  State & Pincode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="State"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Pincode"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. EMERGENCY CONTACTS */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Phone className="w-5 h-5 text-emerald-600" />
              <h2 className="font-extrabold text-base text-slate-900">2. Emergency Contacts (Vital)</h2>
            </div>

            <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl">
              <span className="text-[11px] font-bold text-emerald-800 uppercase block">
                Primary Contact (Will be dialed first in emergency) *
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Contact Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Suresh Kumar"
                    value={primaryContactName}
                    onChange={(e) => setPrimaryContactName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Relationship *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Son / Daughter / Spouse"
                    value={primaryContactRelation}
                    onChange={(e) => setPrimaryContactRelation(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 98765 43210"
                    value={primaryContactPhone}
                    onChange={(e) => setPrimaryContactPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold text-slate-600 uppercase block">
                Secondary Contact (Backup)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Anita Sharma"
                    value={secondaryContactName}
                    onChange={(e) => setSecondaryContactName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Relationship</label>
                  <input
                    type="text"
                    placeholder="e.g. Daughter-in-law / Neighbor"
                    value={secondaryContactRelation}
                    onChange={(e) => setSecondaryContactRelation(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98111 22233"
                    value={secondaryContactPhone}
                    onChange={(e) => setSecondaryContactPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Preferred Hospital
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apollo Jubilee Hills"
                  value={preferredHospital}
                  onChange={(e) => setPreferredHospital(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Treating Doctor Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. K. Rao"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Doctor Phone
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 94400 11223"
                  value={doctorContact}
                  onChange={(e) => setDoctorContact(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. MEDICAL & HEALTH DETAILS */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-600" />
                <h2 className="font-extrabold text-base text-slate-900">3. Medical Alerts & Health Data</h2>
              </div>
              <button
                type="button"
                onClick={handleEnhanceWithAI}
                disabled={aiEnhancing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 transition disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                {aiEnhancing ? 'AI Enhancing...' : 'AI Enhance Notes'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Blood Group *
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-bold text-red-700 outline-none bg-white"
                >
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-red-700 block mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Severe Allergies (Penicillin, Nuts, etc.)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Sulfa drugs, Shellfish"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border-2 border-red-200 bg-red-50/30 text-red-950 font-bold outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Chronic Medical Conditions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hypertension (High BP), Type 2 Diabetes, Alzheimer's / Dementia, Cardiac Stent"
                  value={medicalConditions}
                  onChange={(e) => setMedicalConditions(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Regular Critical Medications
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amlodipine 5mg (morning), Metformin 500mg, Blood thinners"
                  value={medications}
                  onChange={(e) => setMedications(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Emergency Action Instructions for First Responders & Bystanders
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Senior suffers from memory loss and gets panicked easily. Please speak softly in Hindi or Telugu. Contact son Suresh immediately. Do NOT leave alone."
                  value={emergencyInstructions}
                  onChange={(e) => setEmergencyInstructions(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Mobility Assistance
                </label>
                <input
                  type="text"
                  placeholder="e.g. Uses walking cane, wheelchair dependent"
                  value={mobilityAssistance}
                  onChange={(e) => setMobilityAssistance(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Communication Difficulties & Languages
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hearing impaired on left ear; speaks Hindi & Telugu"
                  value={communicationDifficulties}
                  onChange={(e) => setCommunicationDifficulties(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Distinct Identification Marks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scar on left forehead, wears silver bracelet"
                  value={identificationMarks}
                  onChange={(e) => setIdentificationMarks(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 4. PRIVACY & PUBLIC VISIBILITY CONTROLS */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Eye className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="font-extrabold text-base text-slate-900">4. Privacy & Public QR Visibility Controls</h2>
                <p className="text-xs text-slate-500">
                  Select which items are visible to anyone scanning the emergency QR code.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                { key: 'showPhoto', label: 'Display Profile Photo' },
                { key: 'showAge', label: 'Display Age & Gender' },
                { key: 'showBloodGroup', label: 'Display Blood Group' },
                { key: 'showConditions', label: 'Display Medical Conditions' },
                { key: 'showAllergies', label: 'Display Critical Allergies' },
                { key: 'showMedications', label: 'Display Medications' },
                { key: 'showHospital', label: 'Display Preferred Hospital' },
                { key: 'showSecondaryContact', label: 'Display Secondary Contact' },
                { key: 'showAddress', label: 'Display Residential Address (Disabled by default)' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100 cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    checked={(publicVisibility as any)[item.key]}
                    onChange={(e) =>
                      setPublicVisibility({
                        ...publicVisibility,
                        [item.key]: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Profile...' : isEditing ? 'Update Emergency Profile' : 'Generate & Save Emergency Profile'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
