import React, { useEffect, useState } from 'react';
import { SeniorProfile, EmergencyReport } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  getAllSeniors,
  updateSeniorStatus,
  getEmergencyReports,
  cleanupDemoProfiles,
} from '../services/seniorService';
import {
  Shield,
  Users,
  QrCode,
  AlertTriangle,
  Search,
  ExternalLink,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  FileText,
} from 'lucide-react';

export const AdminDashboardPage: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const { isAdmin, userAccount } = useAuth();
  const [seniors, setSeniors] = useState<SeniorProfile[]>([]);
  const [reports, setReports] = useState<EmergencyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'seniors' | 'reports'>('seniors');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        await cleanupDemoProfiles();
        const all = await getAllSeniors();
        setSeniors((all || []).filter((s) => !s.isDemo));

        const repList = await getEmergencyReports();
        setReports(repList || []);
      } catch (err) {
        console.error('Admin data load failed:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleToggleStatus = async (senior: SeniorProfile) => {
    const nextStatus = senior.status === 'active' ? 'disabled' : 'active';
    try {
      await updateSeniorStatus(senior.id, nextStatus);
      setSeniors((prev) =>
        prev.map((s) => (s.id === senior.id ? { ...s, status: nextStatus } : s))
      );
    } catch (e) {
      alert('Failed to change status');
    }
  };

  const filtered = seniors.filter(
    (s) =>
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.bloodGroup.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.safeScanId && s.safeScanId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.patientId && s.patientId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.qrToken.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.city && s.city.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Admin Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-600/30">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight">
                  SafeScan Administrative Console
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  Master Security
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Community Service Project Oversight • System Registry & Emergency Alerts Log
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
            >
              Caregiver View
            </button>
            <button
              onClick={() => navigate('/scan')}
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition"
            >
              Emergency Scanner
            </button>
          </div>
        </div>

        {/* 4 Admin Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Registered Seniors</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-3xl font-black text-white">{seniors.length}</p>
            <p className="text-[11px] text-slate-400">Protected identity cards</p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Active QR Codes</span>
              <QrCode className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-black text-emerald-400">
              {seniors.filter((s) => s.status === 'active').length}
            </p>
            <p className="text-[11px] text-slate-400">Scannable in emergencies</p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Emergency Reports</span>
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-3xl font-black text-red-400">{reports.length}</p>
            <p className="text-[11px] text-slate-400">Bystander submissions</p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Platform Status</span>
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-xl font-black text-indigo-300">Operational 100%</p>
            <p className="text-[11px] text-slate-400">Firestore & GenAI live</p>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('seniors')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'seniors'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Registered Seniors Registry ({seniors.length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'reports'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Bystander Incident Reports ({reports.length})
          </button>
        </div>

        {/* TAB 1: SENIORS REGISTRY */}
        {activeTab === 'seniors' && (
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by name, blood group, token, city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                />
              </div>
              <span className="text-xs text-slate-400">
                Displaying {filtered.length} senior records
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No matching senior citizen records found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Senior Name</th>
                      <th className="py-3 px-4">Age / Blood</th>
                      <th className="py-3 px-4">Emergency Contact</th>
                      <th className="py-3 px-4">SafeScan ID</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {filtered.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-750 transition">
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                          <span>{s.fullName}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {s.age} yrs • <span className="font-bold text-red-400">{s.bloodGroup}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <div>{s.primaryContactName} ({s.primaryContactRelation})</div>
                          <div className="text-[11px] font-mono text-slate-400">{s.primaryContactPhone}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-red-400 font-bold">
                          {s.safeScanId || s.patientId || s.qrToken || s.id}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.status === 'active'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}
                          >
                            {s.status === 'active' ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => navigate(`/emergency/${s.safeScanId || s.patientId || s.qrToken || s.id}`)}
                            className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-semibold transition"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleToggleStatus(s)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                              s.status === 'active'
                                ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                            }`}
                          >
                            {s.status === 'active' ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: EMERGENCY REPORTS AUDIT */}
        {activeTab === 'reports' && (
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl overflow-hidden shadow-xl p-6 space-y-4">
            <div>
              <h3 className="font-extrabold text-base text-white">Emergency Incident Log</h3>
              <p className="text-xs text-slate-400">
                Audited list of reports submitted by citizens when finding lost seniors
              </p>
            </div>

            {reports.length === 0 ? (
              <p className="text-center py-10 text-xs text-slate-400">
                No emergency incidents logged yet.
              </p>
            ) : (
              <div className="space-y-3">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-bold text-white text-sm">
                        Senior: {rep.seniorName || rep.seniorId}
                      </span>
                      <span className="font-mono text-[11px]">
                        {new Date(rep.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-800/80 rounded-lg text-slate-200 border border-slate-700/60 leading-relaxed font-sans">
                      "{rep.message}"
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-slate-400 pt-1">
                      <div>
                        Reporter: <strong className="text-white">{rep.reporterName}</strong> • Phone: <span className="font-mono text-indigo-300">{rep.reporterPhone}</span>
                      </div>

                      {rep.latitude && rep.longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${rep.latitude},${rep.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-bold hover:underline"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          GPS: {rep.latitude}, {rep.longitude} (Maps)
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
