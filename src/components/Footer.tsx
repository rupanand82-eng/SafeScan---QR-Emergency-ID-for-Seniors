import React from 'react';
import { ShieldAlert, PhoneCall, HeartHandshake, ShieldCheck, LifeBuoy } from 'lucide-react';

export const Footer: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-8 border-t border-slate-800 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Emergency Hotlines Bar */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 sm:p-6 mb-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Emergency Helpline Quick Numbers</h4>
              <p className="text-xs text-slate-400">Save or dial immediately during severe accidents or crises</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="tel:108"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-sm transition"
            >
              <span>🚑 108 Ambulance</span>
            </a>
            <a
              href="tel:112"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition"
            >
              <span>🚨 112 Emergency</span>
            </a>
            <a
              href="tel:14567"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm transition"
            >
              <span>👵 14567 Elder Line</span>
            </a>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-black text-sm">
                SS
              </div>
              <span className="font-extrabold text-lg text-white tracking-tight">
                Safe<span className="text-blue-400">Scan</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              SafeScan is a Community Service Project (CSP) designed to help identify senior citizens and provide essential emergency contact and medical information rapidly when they are lost, injured, or unable to speak.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold pt-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero-knowledge public QR • Privacy protected</span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h5 className="text-white text-xs font-bold uppercase tracking-wider mb-3">Quick Links</h5>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => navigate('/')} className="hover:text-white transition">
                  Home Overview
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/scan')} className="hover:text-white transition text-red-400 font-bold">
                  Camera QR Scanner
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/dashboard')} className="hover:text-white transition">
                  Caregiver Dashboard
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/seniors/new')} className="hover:text-white transition">
                  Register Senior Profile
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/about-csp')} className="hover:text-white transition">
                  CSP Project Documentation
                </button>
              </li>
            </ul>
          </div>

          {/* Compliance & Impact */}
          <div>
            <h5 className="text-white text-xs font-bold uppercase tracking-wider mb-3">Community Service</h5>
            <p className="text-xs text-slate-400 leading-relaxed">
              Designed as a social safety initiative for vulnerable seniors, Alzheimer's patients, and high-risk cardiac individuals.
            </p>
            <div className="mt-3 p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] text-slate-300">
              <span className="font-bold text-white block">Print formats:</span>
              Wristbands, wallet cards, pendants, iron-on labels.
            </div>
          </div>
        </div>

        {/* Legal Disclaimer */}
        <div className="pt-6 border-t border-slate-800 text-[11px] text-slate-400 space-y-2">
          <p className="bg-slate-800/40 p-3 rounded-lg border border-slate-800 leading-relaxed text-slate-300">
            <strong className="text-white">Emergency Disclaimer:</strong> SafeScan emergency profile information is provided by the registered user or authorized family caregiver. This system is intended for emergency identification and rapid contact assistance; it does not replace professional emergency medical triage, hospital dispatch, or police services.
          </p>
          <div className="flex flex-wrap items-center justify-between pt-2 text-slate-500 text-xs">
            <span>© {new Date().getFullYear()} SafeScan Emergency Identification System • B.Tech Community Service Project</span>
            <span>Empowering Senior Care & Compassionate Communities</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
