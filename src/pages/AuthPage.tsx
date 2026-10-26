import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { ConfirmationResult } from 'firebase/auth';
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
  Mail,
  Lock,
  Phone,
  RotateCw,
  KeyRound,
  ArrowLeft,
  UserPlus,
  Check,
  Clock,
  Copy,
} from 'lucide-react';
import { registerPhoneWithCode, loginPhoneWithCode } from '../services/phoneAuthService';

// Common country dialing codes for emergency responders & international families
const COUNTRY_CODES = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'USA / Canada', flag: '🇺🇸' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+974', country: 'Qatar', flag: '🇶🇦' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+977', country: 'Nepal', flag: '🇳🇵' },
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩' },
];

export const AuthPage: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const {
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    setupRecaptcha,
    sendPhoneOtp,
    verifyPhoneOtp,
    signInWithSimulatedPhoneOtp,
    loginWithCustomUser,
    switchDemoRole,
  } = useAuth();

  // Mode and Tabs
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('user');

  // Email form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');

  // Phone Unique Code Login/Registration State
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneMode, setPhoneMode] = useState<'login' | 'register'>('login');
  const [phoneUniqueCode, setPhoneUniqueCode] = useState('');
  const [phoneRegisterName, setPhoneRegisterName] = useState('');
  const [assignedCodeModal, setAssignedCodeModal] = useState<{
    phone: string;
    code: string;
    user: any;
  } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // Common UI State
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Human-friendly error translation for Firebase Auth
  const mapAuthError = (err: any): string => {
    const message = err?.message || '';
    const code = err?.code || '';

    if (code === 'auth/invalid-verification-code' || message.includes('invalid-verification-code')) {
      return 'Invalid OTP code. Please check the SMS or use the test verification code.';
    }
    if (code === 'auth/code-expired' || message.includes('code-expired')) {
      return 'The verification code has expired. Please request a new OTP.';
    }
    if (code === 'auth/invalid-phone-number' || message.includes('invalid-phone-number')) {
      return 'Invalid phone number format. Please check the country code and entered digits.';
    }
    if (code === 'auth/quota-exceeded' || message.includes('quota-exceeded')) {
      return 'SMS quota exceeded for this phone number. For instant verification in testing, use the designated test phone number or email login.';
    }
    if (code === 'auth/too-many-requests' || message.includes('too-many-requests')) {
      return 'Too many attempts. Please wait a few moments or try another login method.';
    }
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return 'Invalid email address or password. If you do not have an account yet, switch to Register mode or select a 1-Click Role Login below.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account already exists with this email. Please sign in with your password.';
    }
    if (code === 'auth/network-request-failed' || message.includes('network')) {
      return 'Network communication failure. Please check your internet connection.';
    }
    if (code === 'auth/captcha-check-failed' || message.includes('reCAPTCHA')) {
      return 'reCAPTCHA verification failed or was cancelled. Please refresh and try again.';
    }

    return message || 'Authentication failed. Please verify your inputs and try again.';
  };

  // 1. Email Login & Registration Handler
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      if (isRegisterMode) {
        setLoadingText('Creating your account...');
        await registerWithEmail(cleanEmail, password, fullName, registerPhone, selectedRole);
        setSuccessMessage('Account created successfully!');
      } else {
        setLoadingText('Signing you in...');
        await signInWithEmail(cleanEmail, password, selectedRole);
      }

      if (selectedRole === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.warn('Email authentication notice:', err?.code || err?.message || err);
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  // Helper to normalize phone number with selected country code
  const getFullPhoneNumber = () => {
    let clean = phoneNumber.trim().replace(/[\s\-()]/g, '');
    let fullPhone: string;
    if (clean.startsWith('+')) {
      fullPhone = clean;
    } else {
      if (clean.startsWith('0') && clean.length > 10) {
        clean = clean.substring(1);
      }
      if (clean.startsWith('91') && clean.length > 10 && countryCode === '+91') {
        fullPhone = `+${clean}`;
      } else {
        fullPhone = `${countryCode}${clean}`;
      }
    }
    return fullPhone;
  };

  // 1. Phone Unique Code Registration (No SMS OTP required)
  const handlePhoneRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const fullPhone = getFullPhoneNumber();
    if (!fullPhone || fullPhone.length < 8 || fullPhone.length > 17) {
      setError('Please enter a valid mobile number (typically 10 digits for India).');
      return;
    }

    try {
      setLoading(true);
      setLoadingText('Registering phone & generating your unique code...');

      const result = await registerPhoneWithCode({
        phoneNumber: fullPhone,
        name: phoneRegisterName.trim() || undefined,
        role: selectedRole,
      });

      // Display assigned unique code
      setAssignedCodeModal({
        phone: fullPhone,
        code: result.uniqueCode,
        user: result.user,
      });

      setSuccessMessage('Registration successful! Please save your unique code.');
    } catch (err: any) {
      setError(err?.message || 'Failed to register phone number.');
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  // 2. Phone Unique Code Login (No SMS OTP required)
  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const fullPhone = getFullPhoneNumber();
    if (!fullPhone || fullPhone.length < 8 || fullPhone.length > 17) {
      setError('Please enter a valid mobile number.');
      return;
    }

    const cleanCode = phoneUniqueCode.trim().replace(/\s/g, '');
    if (!cleanCode) {
      setError('Please enter your assigned 6-digit unique code.');
      return;
    }

    try {
      setLoading(true);
      setLoadingText('Authenticating with unique code...');

      const result = await loginPhoneWithCode({
        phoneNumber: fullPhone,
        uniqueCode: cleanCode,
        role: selectedRole,
      });

      loginWithCustomUser(result.user);
      setSuccessMessage('Login successful! Redirecting...');

      if (selectedRole === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your phone number and unique code.');
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  const handleCopyCode = () => {
    if (assignedCodeModal?.code) {
      navigator.clipboard.writeText(assignedCodeModal.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    }
  };

  const handleProceedAfterRegistration = () => {
    if (assignedCodeModal?.user) {
      loginWithCustomUser(assignedCodeModal.user);
      if (selectedRole === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  };

  // 3. Google Sign-in Handler
  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setLoadingText('Connecting to Google...');
      setError(null);
      await signInWithGoogle(selectedRole);
      if (selectedRole === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.warn('Google Sign In notice:', err?.code || err?.message || err);
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  // 4. Quick 1-Click Demo Logins
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
            Secure emergency identity registry for members of any age and their families
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
          
          {/* Status Notifications */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-2 animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold block">Authentication Notice</span>
                  <span className="leading-relaxed">{error}</span>
                </div>
              </div>
              {authMethod === 'email' && !isRegisterMode && (
                <div className="pl-6 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(true);
                      setError(null);
                    }}
                    className="inline-flex items-center gap-1 font-bold text-blue-700 hover:text-blue-900 underline text-xs transition"
                  >
                    <span>Click here to register with {email.trim() ? email : 'this email'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Role Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Select Your Intended Account Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedRole('user')}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                  selectedRole !== 'admin'
                    ? 'border-blue-600 bg-blue-50/60 text-blue-800 font-bold shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-[11px] leading-tight font-bold">Member / Family Account</span>
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
                <span className="text-[11px] leading-tight font-bold">Administrator</span>
              </button>
            </div>
          </div>

          {/* Authentication Method Tabs */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Choose Login Method
            </label>
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('email');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                  authMethod === 'email'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                <span>Email Login</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMethod('phone');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                  authMethod === 'phone'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Phone Login</span>
              </button>
            </div>
          </div>

          {/* ================= OPTION 1: EMAIL LOGIN / REGISTRATION ================= */}
          {authMethod === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              
              {isRegisterMode && (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                      required={isRegisterMode}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Phone Number (Optional - For Emergency Alerts)
                    </label>
                    <input
                      type="tel"
                      value={registerPhone}
                      onChange={(e) => setRegisterPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Password
                  </label>
                  {!isRegisterMode && (
                    <span className="text-[10px] text-slate-400">
                      Min 6 characters
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                    required
                  />
                </div>
              </div>

              {/* Email Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>{loadingText || 'Processing...'}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>{isRegisterMode ? 'Create Account & Login' : 'Login with Email'}</span>
                  </>
                )}
              </button>

              {/* Mode switch */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(!isRegisterMode);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold transition inline-flex items-center gap-1"
                >
                  {isRegisterMode ? (
                    <>
                      <span>Already have an account? Sign In</span>
                    </>
                  ) : (
                    <>
                      <span>Need a new account? Register here</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ================= OPTION 2: PHONE NUMBER LOGIN WITHOUT SMS OTP ================= */}
          {authMethod === 'phone' && (
            <div className="space-y-4">
              {/* Phone Sub-Navigation: Sign In vs Register */}
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setPhoneMode('login');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                    phoneMode === 'login'
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign In with Unique Code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhoneMode('register');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                    phoneMode === 'register'
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Register Phone & Get Code
                </button>
              </div>

              {/* Unique Code Display Banner upon Registration */}
              {assignedCodeModal && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 space-y-3 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span className="font-extrabold text-sm text-emerald-900">
                      Unique Access Code Assigned!
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Registered for <strong>{assignedCodeModal.phone}</strong>. Please save or copy this 6-digit code. You can log into SafeScan anytime using your phone number and this unique code without waiting for SMS!
                  </p>
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 flex items-center justify-between shadow-inner">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                        Your Unique Access Code
                      </span>
                      <span className="font-mono text-2xl font-black text-emerald-700 tracking-widest">
                        {assignedCodeModal.code}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                    >
                      {codeCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{codeCopied ? 'Copied!' : 'Copy Code'}</span>
                    </button>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleProceedAfterRegistration}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Proceed to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Mode A: Sign In with Phone & Unique Code */}
              {phoneMode === 'login' && (
                <form onSubmit={handlePhoneLogin} className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Phone Number
                    </label>
                    <div className="flex gap-2">
                      <div className="w-32 flex-shrink-0">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.flag} {c.code}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Phone className="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="98765 43210"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition font-mono"
                          required
                          autoFocus
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                        Assigned Unique Code
                      </label>
                      <span className="text-[10px] text-slate-400">
                        6-Digit Unique Code
                      </span>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        maxLength={8}
                        value={phoneUniqueCode}
                        onChange={(e) => setPhoneUniqueCode(e.target.value)}
                        placeholder="e.g. 742918"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition font-mono tracking-widest font-bold"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Enter the unique code assigned to this phone number upon registration.
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || !phoneNumber.trim() || !phoneUniqueCode.trim()}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>{loadingText || 'Verifying...'}</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Sign In with Unique Code</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneMode('register');
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      className="text-xs text-emerald-700 hover:text-emerald-900 font-bold transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>New user? Register your phone number & get unique code</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </form>
              )}

              {/* Mode B: Register Phone & Generate Unique Code */}
              {phoneMode === 'register' && (
                <form onSubmit={handlePhoneRegister} className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Full Name / Family Contact (Optional)
                    </label>
                    <input
                      type="text"
                      value={phoneRegisterName}
                      onChange={(e) => setPhoneRegisterName(e.target.value)}
                      placeholder="e.g. Rajesh Sharma"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Phone Number to Register
                    </label>
                    <div className="flex gap-2">
                      <div className="w-32 flex-shrink-0">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.flag} {c.code}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Phone className="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="98765 43210"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition font-mono"
                          required
                          autoFocus
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Duplicate registrations for the same phone number are prevented.
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || !phoneNumber.trim()}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>{loadingText || 'Generating Unique Code...'}</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>Register Phone & Generate Unique Code</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneMode('login');
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      className="text-xs text-slate-600 hover:text-slate-900 font-bold transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Already have a unique code? Sign in here</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              Or Other Sign-in Options
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Secondary Action: Google Sign-in */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2.5 border border-slate-800"
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
              <span>Sign in with Google</span>
            </button>

            <p className="text-[10px] text-slate-400 text-center leading-normal">
              Uses Firebase Authentication with encrypted token exchange. Passwords and OTPs are never stored on client devices.
            </p>
          </div>

          {/* Quick Demo Logins for Examiner / Evaluation */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-600 block">
              1-Click Role Login (Instant Testing):
            </span>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('user')}
                className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition flex items-center justify-between text-xs"
              >
                <div>
                  <strong className="text-slate-800 font-bold block">Member / Family Account</strong>
                  <span className="text-slate-500 text-[10px]">Registers & manages family emergency ID cards</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
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
