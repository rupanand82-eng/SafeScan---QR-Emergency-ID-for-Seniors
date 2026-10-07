import React, { useEffect, useState } from 'react';
import { SeniorProfile, EmergencyReport } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  getSeniorsByUserId,
  updateSeniorStatus,
  deleteSeniorProfile,
  cleanupDemoProfiles,
  getEmergencyReports,
} from '../services/seniorService';
import { QRDisplayModal } from '../components/QRDisplayModal';
import { EmergencyCard } from '../components/EmergencyCard';
import {
  Users,
  QrCode,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Printer,
  Edit,
  Trash2,
  Eye,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Search,
} from 'lucide-react';

export const DashboardPage: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const { userAccount, role } = useAuth();
  const [seniors, setSeniors] = useState<SeniorProfile[]>([]);
  const [reports, setReports] = useState<EmergencyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedSeniorForQr, setSelectedSeniorForQr] = useState<SeniorProfile | null>(null);
  const [selectedSeniorForPrint, setSelectedSeniorForPrint] = useState<SeniorProfile | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      await cleanupDemoProfiles();
      const userId = userAccount?.id;
      let list: SeniorProfile[] = [];
      if (userId) {
        list = await getSeniorsByUserId(userId);
      } else {
        list = await getSeniorsByUserId('demo-caregiver-user-id');
      }
      setSeniors((list || []).filter((s) => !s.isDemo));

      const allReports = await getEmergencyReports();
      setReports(allReports || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userAccount]);

  const handleToggleStatus = async (senior: SeniorProfile) => {
    const nextStatus = senior.status === 'active' ? 'disabled' : 'active';
    try {
      await updateSeniorStatus(senior.id, nextStatus);
      setSeniors((prev) =>
        prev.map((s) => (s.id === senior.id ? { ...s, status: nextStatus } : s))
      );
    } catch (e) {
      alert('Failed to update status');
    }
  };

  const handleDelete = async (senior: SeniorProfile) => {
    if (!confirm(`Are you sure you want to delete ${senior.fullName}'s profile? The QR code will stop functioning.`)) {
      return;
    }
    try {
      await deleteSeniorProfile(senior.id);
      setSeniors((prev) => prev.filter((s) => s.id !== senior.id));
    } catch (e) {
      alert('Failed to delete profile');
    }
  };

  // Metrics calculation
  const totalSeniors = seniors.length;
  const activeQrs = seniors.filter((s) => s.status === 'active').length;
  const totalContacts = seniors.reduce((acc, s) => acc + (s.secondaryContactPhone ? 2 : 1), 0);
  const avgCompletion = seniors.length
    ? Math.round(
        (seniors.reduce((acc, s) => {
          let score = 50;
          if (s.photoUrl) score += 10;
          if (s.allergies) score += 15;
          if (s.medicalConditions) score += 15;
          if (s.emergencyInstructions) score += 10;
          return acc + score;
        }, 0) /
          seniors.length)
      )
    : 100;

  const filteredSeniors = seniors.filter(
    (s) =>
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.bloodGroup.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.safeScanId && s.safeScanId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.patientId && s.patientId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.qrToken.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>SafeScan Family & Caregiver Hub</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Welcome, {userAccount?.name || 'Caregiver'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                Manage your registered senior family members, print wearable emergency ID cards, and review bystander emergency incident alerts.
              </p>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => navigate('/seniors/new')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition"
              >
                <Plus className="w-4 h-4" />
                Add Senior
              </button>
              <button
                onClick={() => navigate('/scan')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition"
              >
                <QrCode className="w-4 h-4" />
                Scan QR
              </button>
            </div>
          </div>
        </div>

        {/* 4 Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Registered Seniors</span>
              <span className="text-2xl font-black text-slate-900">{totalSeniors}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Active QR Codes</span>
              <span className="text-2xl font-black text-slate-900">{activeQrs}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
              <PhoneCall className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Emergency Contacts</span>
              <span className="text-2xl font-black text-slate-900">{totalContacts}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Profile Completeness</span>
              <span className="text-2xl font-black text-slate-900">{avgCompletion}%</span>
            </div>
          </div>
        </div>

        {/* Printable Card Modal if chosen */}
        {selectedSeniorForPrint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-2xl">
              <EmergencyCard
                senior={selectedSeniorForPrint}
                onClose={() => setSelectedSeniorForPrint(null)}
              />
            </div>
          </div>
        )}

        {/* Single QR Modal */}
        {selectedSeniorForQr && (
          <QRDisplayModal
            senior={selectedSeniorForQr}
            isOpen={Boolean(selectedSeniorForQr)}
            onClose={() => setSelectedSeniorForQr(null)}
          />
        )}

        {/* Managed Seniors List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Senior Emergency Profiles</h2>
              <p className="text-xs text-slate-500">Each senior has an individual wearable QR code & printable card</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, blood, token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredSeniors.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-600">No senior citizens registered yet.</p>
              <button
                onClick={() => navigate('/seniors/new')}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
              >
                Register Your First Senior
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredSeniors.map((senior) => (
                <div
                  key={senior.id}
                  className="p-5 sm:p-6 hover:bg-slate-50/80 transition flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                >
                  {/* Left: Avatar & Identity */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                        {senior.photoUrl ? (
                          <img src={senior.photoUrl} alt={senior.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-bold text-slate-400 text-lg">{senior.fullName.charAt(0)}</span>
                        )}
                      </div>
                      <span className="absolute -bottom-1 -right-1 bg-red-600 text-white font-black text-[10px] px-1.5 py-0.2 rounded shadow">
                        {senior.bloodGroup}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-900 text-base">{senior.fullName}</h3>
                      </div>

                      <p className="text-xs text-slate-500 mt-0.5">
                        Age {senior.age} • Contact: <strong className="text-slate-700">{senior.primaryContactName}</strong> ({senior.primaryContactPhone})
                      </p>

                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 font-mono">
                        <span>SafeScan ID: <strong className="text-red-600 font-bold">{senior.safeScanId || senior.patientId || senior.qrToken || senior.id}</strong></span>
                        <span>•</span>
                        <span className={senior.status === 'active' ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {senior.status === 'active' ? '● QR Active' : '● QR Deactivated'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <button
                      onClick={() => setSelectedSeniorForQr(senior)}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1 border border-blue-200 transition"
                      title="View QR Code & Test"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      View QR
                    </button>

                    <button
                      onClick={() => setSelectedSeniorForPrint(senior)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition"
                      title="Print SafeScan ID Card"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Card
                    </button>

                    <button
                      onClick={() => navigate(`/emergency/${senior.safeScanId || senior.patientId || senior.qrToken || senior.id}`)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 shadow-sm transition"
                      title="Preview public emergency page"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Public View
                    </button>

                    <button
                      onClick={() => navigate(`/seniors/edit/${senior.id}`)}
                      className="p-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition"
                      title="Edit Profile"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleToggleStatus(senior)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                        senior.status === 'active'
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                      title={senior.status === 'active' ? 'Deactivate QR (e.g. if badge lost)' : 'Activate QR'}
                    >
                      {senior.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>

                    <button
                      onClick={() => handleDelete(senior)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Delete Profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Emergency Reports / Alerts Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <div>
                <h2 className="text-base font-black text-slate-900">Recent Bystander Incident Reports</h2>
                <p className="text-xs text-slate-500">Alerts filed by volunteers or responders who scanned SafeScan tags</p>
              </div>
            </div>
            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
              {reports.length} Reports Logged
            </span>
          </div>

          {reports.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No emergency incidents reported. All seniors are currently safe.
            </p>
          ) : (
            <div className="space-y-3">
              {reports.slice(0, 5).map((rep) => (
                <div key={rep.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      Senior: {rep.seniorName || rep.seniorId}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {new Date(rep.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-700 font-medium bg-white p-2.5 rounded-lg border border-slate-200">
                    "{rep.message}"
                  </p>
                  <div className="flex flex-wrap items-center justify-between text-slate-500 gap-2">
                    <span>
                      Reporter: <strong className="text-slate-800">{rep.reporterName}</strong> ({rep.reporterPhone})
                    </span>
                    {rep.latitude && (
                      <a
                        href={`https://www.google.com/maps?q=${rep.latitude},${rep.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 font-bold hover:underline flex items-center gap-1"
                      >
                        📍 View Bystander Coordinates on Maps
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
