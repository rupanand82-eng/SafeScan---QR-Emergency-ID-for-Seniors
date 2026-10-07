import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  QrCode,
  Users,
  LayoutDashboard,
  Shield,
  LogOut,
  LogIn,
  Info,
  Menu,
  X,
  Type,
  ChevronDown,
} from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  navigate: (path: string) => void;
  isLargeText: boolean;
  setIsLargeText: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, navigate, isLargeText, setIsLargeText }) => {
  const { userAccount, role, isAdmin, logout, switchDemoRole } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const handleNav = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNav('/')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center shadow-md shadow-red-500/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900 flex items-center gap-1.5">
                Safe<span className="text-blue-600">Scan</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                  CSP
                </span>
              </span>
              <p className="text-[11px] font-medium text-slate-500 hidden sm:block">
                Senior Emergency Identification
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => handleNav('/')}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                currentPath === '/' ? 'text-blue-600 bg-blue-50' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Home
            </button>

            <button
              onClick={() => handleNav('/scan')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold transition ${
                currentPath === '/scan'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200'
              }`}
            >
              <QrCode className="w-4 h-4" />
              Scan QR
            </button>

            {userAccount && (
              <button
                onClick={() => handleNav('/dashboard')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                  currentPath === '/dashboard' ? 'text-blue-600 bg-blue-50' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </button>
            )}

            {userAccount && (
              <button
                onClick={() => handleNav('/seniors/new')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                  currentPath === '/seniors/new' ? 'text-blue-600 bg-blue-50' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4" />
                Add Senior
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => handleNav('/admin')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                  currentPath === '/admin' ? 'text-indigo-700 bg-indigo-50 font-bold' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Shield className="w-4 h-4 text-indigo-600" />
                Admin
              </button>
            )}

            <button
              onClick={() => handleNav('/about-csp')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                currentPath === '/about-csp' ? 'text-blue-600 bg-blue-50' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Info className="w-4 h-4" />
              About Project
            </button>
          </nav>

          {/* Right Side: Accessibility Toggle & User Profile / Login */}
          <div className="hidden md:flex items-center gap-3">
            {/* Senior A+ Font Toggle */}
            <button
              onClick={() => setIsLargeText(!isLargeText)}
              title="Toggle Large Senior-Friendly Text"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition border ${
                isLargeText
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              {isLargeText ? 'Large Text: ON' : 'A+ Font'}
            </button>

            {userAccount ? (
              <div className="relative">
                <button
                  onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                  className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 transition"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    {userAccount.name.charAt(0)}
                  </div>
                  <div className="text-left text-xs">
                    <p className="font-bold text-slate-800 leading-tight truncate max-w-[100px]">
                      {userAccount.name.split(' ')[0]}
                    </p>
                    <p className="text-[10px] text-blue-600 font-semibold uppercase">
                      {role}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {roleDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-800">{userAccount.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{userAccount.email}</p>
                    </div>

                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Switch Role (Demo)
                    </div>
                    <button
                      onClick={() => { switchDemoRole('senior'); setRoleDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-50 flex items-center justify-between ${role === 'senior' ? 'text-blue-600 font-bold' : 'text-slate-700'}`}
                    >
                      <span>Senior Citizen</span>
                      {role === 'senior' && <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">Active</span>}
                    </button>
                    <button
                      onClick={() => { switchDemoRole('caregiver'); setRoleDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-50 flex items-center justify-between ${role === 'caregiver' ? 'text-blue-600 font-bold' : 'text-slate-700'}`}
                    >
                      <span>Caregiver / Family</span>
                      {role === 'caregiver' && <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">Active</span>}
                    </button>
                    <button
                      onClick={() => { switchDemoRole('admin'); setRoleDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-50 flex items-center justify-between ${role === 'admin' ? 'text-indigo-600 font-bold' : 'text-slate-700'}`}
                    >
                      <span>Administrator</span>
                      {role === 'admin' && <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded">Active</span>}
                    </button>

                    <div className="border-t border-slate-100 mt-2 pt-1">
                      <button
                        onClick={() => { logout(); setRoleDropdownOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Log Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => handleNav('/auth')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => handleNav('/scan')}
              className="p-2 rounded-lg bg-red-600 text-white"
              title="Scan Emergency QR"
            >
              <QrCode className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-700 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-2">
          <button
            onClick={() => handleNav('/')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            Home
          </button>
          <button
            onClick={() => handleNav('/scan')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-bold text-red-600 bg-red-50"
          >
            Scan Emergency QR Code
          </button>
          {userAccount && (
            <button
              onClick={() => handleNav('/dashboard')}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              Dashboard
            </button>
          )}
          {userAccount && (
            <button
              onClick={() => handleNav('/seniors/new')}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              Add Senior Profile
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => handleNav('/admin')}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-indigo-700 bg-indigo-50"
            >
              Administrator Console
            </button>
          )}
          <button
            onClick={() => handleNav('/about-csp')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            About CSP Project
          </button>

          <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
            <button
              onClick={() => setIsLargeText(!isLargeText)}
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 text-slate-800"
            >
              {isLargeText ? 'Disable Large Font' : 'Enable Large Font (Senior-Friendly)'}
            </button>
            {userAccount ? (
              <button
                onClick={() => { logout(); setMobileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-red-600 bg-red-50"
              >
                Log Out ({userAccount.name})
              </button>
            ) : (
              <button
                onClick={() => handleNav('/auth')}
                className="w-full text-center px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm"
              >
                Sign In / Register
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
