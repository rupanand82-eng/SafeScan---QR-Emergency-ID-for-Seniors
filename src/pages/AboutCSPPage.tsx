import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Heart,
  Users,
  Clock,
  QrCode,
  Lock,
  Sparkles,
  Award,
  CheckCircle2,
  PhoneCall,
  Server,
  Database,
  ArrowRight,
} from 'lucide-react';

export const AboutCSPPage: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* Hero Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200">
            <Award className="w-3.5 h-3.5 text-blue-600" />
            <span>Community Service Project (CSP) Documentation</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            About SafeScan Project
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            A comprehensive, technology-assisted community care initiative designed to protect senior citizens through secure QR-based emergency identification.
          </p>
        </div>

        {/* 1. Problem Statement */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">1. Problem Statement</h2>
              <p className="text-xs text-slate-500">The Social & Healthcare Challenge</p>
            </div>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed">
            Millions of senior citizens suffer from age-related memory vulnerabilities, including Alzheimer's disease, dementia, cardiovascular instability, diabetes, and speech impairments. When an elderly person wanders, falls, or faints in public:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-red-50/60 border border-red-100 text-xs text-red-900 space-y-1">
              <strong className="block text-red-950 font-bold">Communication Barrier:</strong>
              They are often unable to state their identity, home address, or telephone number.
            </div>
            <div className="p-3.5 rounded-2xl bg-red-50/60 border border-red-100 text-xs text-red-900 space-y-1">
              <strong className="block text-red-950 font-bold">Accidental Medical Hazard:</strong>
              First responders might unknowingly administer contraindicated drugs (e.g. penicillin anaphylaxis).
            </div>
            <div className="p-3.5 rounded-2xl bg-red-50/60 border border-red-100 text-xs text-red-900 space-y-1">
              <strong className="block text-red-950 font-bold">Prolonged Anxiety:</strong>
              Family members spend stressful hours or days attempting to locate lost elderly parents.
            </div>
            <div className="p-3.5 rounded-2xl bg-red-50/60 border border-red-100 text-xs text-red-900 space-y-1">
              <strong className="block text-red-950 font-bold">Bystander Helplessness:</strong>
              Citizens who want to help do not know who to call without invading private belongings.
            </div>
          </div>
        </div>

        {/* 2. Proposed Solution */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">2. The SafeScan Proposed Solution</h2>
              <p className="text-xs text-slate-500">Universal, Accessible, Zero-Login Emergency Identification</p>
            </div>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed">
            SafeScan empowers families and caregivers to generate a standardized, privacy-preserving emergency ID card for senior citizens. The wearable card carries a resilient QR code that directs any smartphone camera directly to an instantaneous public emergency profile.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                1
              </div>
              <strong className="block font-bold text-slate-900">Wearable Mediums</strong>
              <p className="text-slate-600">Laminated wallet cards, silicone wristbands, necklace pendants, or iron-on tags.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                2
              </div>
              <strong className="block font-bold text-slate-900">Zero App Requirement</strong>
              <p className="text-slate-600">No special app required. Standard iPhone or Android camera opens the verified profile.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                3
              </div>
              <strong className="block font-bold text-slate-900">Privacy Safeguards</strong>
              <p className="text-slate-600">Sensitive home addresses are hidden unless authorized; medical notes are prioritized.</p>
            </div>
          </div>
        </div>

        {/* 3. Social Impact & Community Benefits */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
              <Heart className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">3. Social Impact</h2>
              <p className="text-xs text-slate-500">Positive Community Transformation</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {[
              { title: 'Helps Identify Vulnerable Seniors', desc: 'Instantly identifies lost seniors who are confused or unable to speak.' },
              { title: 'Drastically Reduces Response Time', desc: 'Allows first responders and good Samaritans to contact kin within seconds.' },
              { title: 'Reunites Families Rapidly', desc: 'Prevents unnecessary police missing-person filings through direct phone dialing.' },
              { title: 'Empowers Community Volunteers', desc: 'Enables bystanders, shopkeepers, and transit workers to assist with confidence.' },
              { title: 'Provides Safe Medical Triage', desc: 'Alerts hospital EMTs about critical allergies, blood group, and chronic ailments.' },
              { title: 'Technology-Assisted Community Care', desc: 'Bridges modern mobile technology with grassroots humanitarian eldercare.' },
            ].map((impact, i) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/40 border border-emerald-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block font-bold">{impact.title}</strong>
                  <p className="text-slate-600 mt-0.5">{impact.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Technical Architecture */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
              <Server className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">4. Technical Architecture</h2>
              <p className="text-xs text-slate-500">Full-Stack Modern Web Engineering</p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-slate-700">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <strong className="text-slate-900 block mb-1">Frontend Layer:</strong>
              React 19 + TypeScript + Vite + Tailwind CSS with high-contrast accessibility toggles and mobile camera-based QR scanning via html5-qrcode.
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <strong className="text-slate-900 block mb-1">Backend & Server Routes:</strong>
              Express full-stack backend with Google GenAI (@google/genai SDK) utilizing gemini-2.5-flash with Google Maps Grounding for real emergency hospital lookups and triage guidance.
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <strong className="text-slate-900 block mb-1">Database & Authentication:</strong>
              Google Cloud Firestore for real-time document persistence (users, senior_profiles, emergency_reports) and Firebase Authentication for secure role-based access.
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="p-6 rounded-3xl bg-blue-600 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-blue-600/20">
          <div>
            <h3 className="font-extrabold text-lg">Ready to test the SafeScan workflow?</h3>
            <p className="text-xs text-blue-100 mt-0.5">Register a senior citizen profile or test the live camera scanner.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/scan')}
              className="px-4 py-2 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs shadow-md transition"
            >
              Test Scanner
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 rounded-xl bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs transition"
            >
              Go to Dashboard
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
