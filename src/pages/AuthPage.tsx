import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import {
  ShieldAlert,
  LogIn,
  Users,
  Shield,
  Heart,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

export const AuthPage: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const { signInWithGoogle, switchDemoRole, userAccount } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('caregiver');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle(selectedRole);
      if (selectedRole === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('Google Sign In failed:', err);
      setError(err?.message || 'Authentication was cancelled or failed. You can use the 1-Click Demo Login below to evaluate the system immediately.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (role: UserRole) => {
    switchDemoRole(role);
    if (role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-[85vh] bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-md w-full space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center mx-auto shadow-lg shadow-red-600/20">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            SafeScan Access Portal
          </h1>
          <p className="text-xs text-slate-500">
            Secure emergency identity registry for senior citizens and family caregivers
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
          
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Role Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Select Your Intended Account Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedRole('caregiver')}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                  selectedRole === 'caregiver'
                    ? 'border-blue-600 bg-blue-50/60 text-blue-800 font-bold shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-[11px] leading-tight">Caregiver</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('senior')}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                  selectedRole === 'senior'
                    ? 'border-blue-600 bg-blue-50/60 text-blue-800 font-bold shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Heart className="w-4 h-4 text-red-500" />
                <span className="text-[11px] leading-tight">Senior</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('admin')}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                  selectedRole === 'admin'
                    ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 font-bold shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Shield className="w-4 h-4 text-indigo-600" />
                <span className="text-[11px] leading-tight">Admin</span>
              </button>
            </div>
          </div>

          {/* Primary Action: Google Sign-in */}
          <div className="space-y-3">
            <button
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-3 border border-slate-800"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? 'Authenticating...' : 'Sign in with Google'}</span>
            </button>

            <p className="text-[11px] text-slate-400 text-center">
              Uses Firebase Authentication to securely verify user accounts without storing passwords.
            </p>
          </div>

          {/* Divider */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              Or Instant Demo Testing
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Quick Demo Logins for Examiner */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-600 block">
              1-Click Role Login (Instant Testing):
            </span>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('caregiver')}
                className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition flex items-center justify-between text-xs"
              >
                <div>
                  <strong className="text-slate-800 font-bold block">Caregiver Account</strong>
                  <span className="text-slate-500 text-[10px]">Registers & manages senior citizen emergency cards</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('senior')}
                className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition flex items-center justify-between text-xs"
              >
                <div>
                  <strong className="text-slate-800 font-bold block">Senior Citizen Account</strong>
                  <span className="text-slate-500 text-[10px]">Views own registered QR & emergency medical profile</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('admin')}
                className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 transition flex items-center justify-between text-xs"
              >
                <div>
                  <strong className="text-slate-800 font-bold block">CSP Administrator Account</strong>
                  <span className="text-slate-500 text-[10px]">Registry overview, audits & fraud protection</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
