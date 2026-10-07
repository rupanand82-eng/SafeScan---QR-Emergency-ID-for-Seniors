import React, { useState } from 'react';
import {
  ShieldAlert,
  QrCode,
  Heart,
  PhoneCall,
  Clock,
  ShieldCheck,
  Users,
  Building2,
  Ambulance,
  ArrowRight,
  Sparkles,
  Printer,
  ChevronRight,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';

export const HomePage: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900 text-white pt-16 pb-20 sm:pt-24 sm:pb-28">
        
        {/* Subtle decorative grid background */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-600/20 border border-red-500/40 text-red-300 text-xs font-bold uppercase tracking-widest shadow-sm">
              <span className="animate-pulse w-2 h-2 rounded-full bg-red-400" />
              Community Service Project • Senior Citizen Safety
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white">
              One Scan Can Help <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-rose-300 to-amber-300">Save a Life.</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-2xl mx-auto">
              SafeScan provides senior citizens with a secure QR-based emergency identity that helps people quickly access essential emergency information and contact their family.
            </p>

            {/* Hero CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
              <button
                onClick={() => navigate('/scan')}
                className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-base shadow-xl shadow-red-600/30 transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2.5"
              >
                <QrCode className="w-5 h-5" />
                <span>Scan a SafeScan QR</span>
              </button>

              <button
                onClick={() => navigate('/auth')}
                className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-base border border-white/20 backdrop-blur-sm transition flex items-center justify-center gap-2"
              >
                <span>Get Started (Register)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* 2. LIVE INTERACTIVE EMERGENCY STRIP */}
      <section className="max-w-5xl mx-auto px-4 -mt-10 relative z-20">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 font-bold p-2 shadow-inner">
              <QrCode className="w-full h-full text-blue-400" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-red-600 tracking-wider">
                Emergency QR Response
              </span>
              <h3 className="text-lg font-black text-slate-900">
                SafeScan Wearable Emergency Tag
              </h3>
              <p className="text-xs text-slate-500">
                Point camera at any registered SafeScan QR code to immediately open the emergency medical profile.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => navigate('/scan')}
              className="flex-1 md:flex-initial px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5" />
              Open Camera Scanner
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="flex-1 md:flex-initial px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition"
            >
              Register Senior
            </button>
          </div>
        </div>
      </section>

      {/* 3. HOW SAFESCAN WORKS */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <span className="text-xs font-extrabold uppercase tracking-widest text-blue-600">
            Simple 6-Step Workflow
          </span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight sm:text-4xl">
            How SafeScan Works
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            A frictionless life-saving pipeline designed for elderly non-tech users and helpful community responders.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { step: '1', title: 'Register', desc: 'Caregiver or senior registers securely via Google Auth or role-based account.' },
            { step: '2', title: 'Create Emergency Profile', desc: 'Add blood group, critical allergies, medications, and primary family contact numbers.' },
            { step: '3', title: 'Generate QR', desc: 'System automatically generates a cryptographically unique random SafeScan QR token.' },
            { step: '4', title: 'Wear / Carry QR', desc: 'Print standard wallet ID cards, laminate badges, or attach to wristbands and pendants.' },
            { step: '5', title: 'Scan During Emergency', desc: 'Any bystander, volunteer, or EMT scans the badge with any mobile camera (zero login).' },
            { step: '6', title: 'Contact Family', desc: 'Instant 1-tap phone dialing connects the bystander directly to the panicked family.' },
          ].map((item) => (
            <div
              key={item.step}
              className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition space-y-3 relative overflow-hidden"
            >
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 font-black text-base flex items-center justify-center border border-blue-200/60">
                {item.step}
              </div>
              <h3 className="font-extrabold text-base text-slate-900">{item.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. WHY SAFESCAN? */}
      <section className="py-16 bg-slate-100/70 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-600">
              Key Advantages
            </span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Why SafeScan?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Designed specifically with eldercare psychology and emergency triage speed in mind.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Clock, title: 'Faster Identification', desc: 'No digging through lost wallets or searching locked phones. Information appears in 2 seconds.' },
              { icon: PhoneCall, title: 'Direct Contact Access', desc: 'Immediate direct 1-tap dial buttons for son, daughter, spouse, or treating physician.' },
              { icon: Users, title: 'Senior-Friendly Design', desc: 'Elderly individuals do not have to operate smartphones during a crisis; the bystander does.' },
              { icon: QrCode, title: 'Resilient QR System', desc: 'High-error-correction QR codes scan reliably even when printed on badges with scratches.' },
              { icon: ShieldCheck, title: 'Privacy-Focused', desc: 'Home addresses are hidden by default; no passwords, bank info, or tracking cookies stored.' },
              { icon: Building2, title: 'Accessible Anywhere', desc: 'Universal responsive web platform works on iOS, Android, laptops, and tablets without installing apps.' },
            ].map((f, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-900">{f.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. WHO CAN USE SAFESCAN? */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-widest text-blue-600">
            Community Stakeholders
          </span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Who Can Use SafeScan?
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
          {[
            { icon: '👵', label: 'Senior Citizens', desc: 'Vulnerable elders' },
            { icon: '👨‍👩‍👦', label: 'Families & Kin', desc: 'Peace of mind' },
            { icon: '🧑‍⚕️', label: 'Caregivers', desc: 'Profile managers' },
            { icon: '🤝', label: 'Volunteers', desc: 'Good Samaritans' },
            { icon: '🏥', label: 'Hospitals & EMTs', desc: 'Accident casualty' },
            { icon: '👮', label: 'Police & Helplines', desc: 'Missing reuniting' },
          ].map((item, i) => (
            <div key={i} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1.5 hover:border-blue-400 transition">
              <span className="text-3xl block">{item.icon}</span>
              <h4 className="font-bold text-xs text-slate-900">{item.label}</h4>
              <p className="text-[10px] text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. BOTTOM CALL TO ACTION */}
      <section className="bg-slate-900 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-white">
            Protect Your Senior Loved Ones Today
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Free community service platform. Create an emergency profile in under 2 minutes, download your printable ID badge, and ensure immediate protection.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm shadow-lg shadow-blue-600/30 transition"
            >
              Access Dashboard
            </button>
            <button
              onClick={() => navigate('/about-csp')}
              className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 transition"
            >
              Read Project Documentation
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};
