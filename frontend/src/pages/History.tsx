import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, ExternalLink, Search, Trash2, AlertCircle,
  Plus, Calendar, Tag, Zap, TrendingUp, X, ChevronRight
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiClient, ExecutionHistory } from '../lib/api';
import { useAuth } from '@/contexts/AuthContext';

/* ─── helpers ─────────────────────────────────────────────── */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays < 2) return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

const URGENCY_STYLES: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const URGENCY_DOT: Record<string, string> = {
  high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-emerald-500',
};

/* ─── item type ──────────────────────────────────────────── */
interface CampaignHistoryItem {
  id: string;
  prompt: string;
  createdAt: string;
  category: string;
  confidence: number;
  tone: string;
  ctaType: string;
  urgencyLevel: string;
}

/* ─── page ───────────────────────────────────────────────── */
export default function HistoryPage() {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignHistoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canDelete = userRole === 'admin' || userRole === 'user';
  const canCreateCampaign = userRole === 'admin' || userRole === 'user';

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await ApiClient.getExecutionHistory(50, 0);
        setCampaigns(data.map((item: ExecutionHistory) => ({
          id: item.id,
          prompt: item.business_behavior || item.user_intent || 'Unknown campaign',
          createdAt: item.created_at,
          category: item.category,
          confidence: item.confidence,
          tone: item.tone || 'N/A',
          ctaType: item.cta_type || 'N/A',
          urgencyLevel: item.urgency_level || 'medium',
        })));
      } catch {
        setError('Failed to load campaign history. Make sure the backend is running.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await ApiClient.deleteExecution(deleteConfirmId);
      setCampaigns((p) => p.filter((c) => c.id !== deleteConfirmId));
      setSuccessMsg('Campaign deleted successfully');
      setTimeout(() => setSuccessMsg(null), 3000);
      setDeleteConfirmId(null);
    } catch {
      setError('Failed to delete campaign.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() =>
    campaigns.filter((c) => {
      const matchSearch = !search || [c.prompt, c.category, c.tone].some((v) =>
        v.toLowerCase().includes(search.toLowerCase())
      );
      const matchUrgency = !urgencyFilter || c.urgencyLevel === urgencyFilter;
      return matchSearch && matchUrgency;
    }), [campaigns, search, urgencyFilter]);

  /* stats */
  const stats = useMemo(() => ({
    total: campaigns.length,
    avgConf: campaigns.length > 0
      ? Math.round(campaigns.reduce((a, c) => a + c.confidence, 0) / campaigns.length * 100) : 0,
    highUrgency: campaigns.filter((c) => c.urgencyLevel === 'high').length,
  }), [campaigns]);

  return (
    <div className="min-h-full bg-slate-50">
      {/* ── Success toast ── */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold"
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">✓</span>
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Campaign History</h1>
            <p className="text-slate-500 text-sm mt-0.5">View and manage your past AI-generated campaigns</p>
          </div>
          {canCreateCampaign && (
            <Link
              to="/campaign"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              <Plus size={15} /> New Campaign
            </Link>
          )}
        </motion.div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Campaigns', value: stats.total, icon: History, gradient: 'bg-gradient-to-br from-indigo-500 to-violet-600' },
            { label: 'Avg ICP Confidence', value: `${stats.avgConf}%`, icon: TrendingUp, gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600' },
            { label: 'High Urgency', value: stats.highUrgency, icon: Zap, gradient: 'bg-gradient-to-br from-red-500 to-rose-600' },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-md ${s.gradient}`}
              >
                <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <p className="text-white/70 text-xs font-medium mb-1">{s.label}</p>
                    <p className="text-3xl font-extrabold">{s.value}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Icon size={18} className="text-white" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Search + Urgency filter ── */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="flex items-center gap-3 mb-5 flex-wrap"
        >
          <div className="relative flex-1 min-w-52">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by prompt, category, or tone…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent shadow-sm transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Urgency filter chips */}
          <div className="flex items-center gap-2">
            {[null, 'high', 'medium', 'low'].map((u) => (
              <button
                key={u ?? 'all'}
                onClick={() => setUrgencyFilter(u)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${urgencyFilter === u
                    ? u === 'high' ? 'bg-red-600 border-red-600 text-white' :
                      u === 'medium' ? 'bg-amber-500 border-amber-500 text-white' :
                        u === 'low' ? 'bg-emerald-600 border-emerald-600 text-white' :
                          'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
              >
                {u ? u.charAt(0).toUpperCase() + u.slice(1) : 'All'}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-500 text-sm">Loading campaign history…</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3 mb-5">
            <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-red-700 text-sm">Error loading history</p>
              <p className="text-red-600 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* ── Campaign list ── */}
        {!loading && !error && (
          <>
            {filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <History size={28} className="text-slate-400" />
                </div>
                <p className="font-semibold text-slate-700 mb-1">No campaigns found</p>
                <p className="text-slate-400 text-sm">
                  {search || urgencyFilter ? 'Try adjusting your search or filters' : 'You haven\'t run any campaigns yet'}
                </p>
                {canCreateCampaign && !search && !urgencyFilter && (
                  <Link to="/campaign" className="mt-4 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all">
                    <Plus size={14} /> Create your first campaign
                  </Link>
                )}
              </motion.div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <div className="col-span-5">Campaign</div>
                  <div className="col-span-2">Category</div>
                  <div className="col-span-1 text-center">Confidence</div>
                  <div className="col-span-2">Urgency</div>
                  <div className="col-span-1">Date</div>
                  <div className="col-span-1" />
                </div>

                <div className="divide-y divide-slate-50">
                  <AnimatePresence>
                    {filtered.map((c, i) => (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: i * 0.04 }}
                        className="grid grid-cols-12 gap-4 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer group items-center"
                        onClick={() => navigate(`/history/${c.id}`)}
                      >
                        {/* Prompt */}
                        <div className="col-span-5 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 line-clamp-1 group-hover:text-indigo-700 transition-colors">
                            {c.prompt}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <Tag size={10} /> Tone: {c.tone} &nbsp;·&nbsp; CTA: {c.ctaType}
                          </p>
                        </div>

                        {/* Category */}
                        <div className="col-span-2">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg truncate max-w-full">
                            {c.category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                          </span>
                        </div>

                        {/* Confidence */}
                        <div className="col-span-1 flex flex-col items-center gap-1">
                          <span className={`text-xs font-bold ${c.confidence >= 0.8 ? 'text-emerald-600' :
                              c.confidence >= 0.6 ? 'text-amber-600' : 'text-red-600'
                            }`}>
                            {Math.round(c.confidence * 100)}%
                          </span>
                          <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${c.confidence >= 0.8 ? 'bg-emerald-500' :
                                  c.confidence >= 0.6 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                              style={{ width: `${c.confidence * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Urgency */}
                        <div className="col-span-2">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold border px-2.5 py-1 rounded-lg capitalize ${URGENCY_STYLES[c.urgencyLevel] ?? 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${URGENCY_DOT[c.urgencyLevel] ?? 'bg-slate-400'}`} />
                            {c.urgencyLevel}
                          </span>
                        </div>

                        {/* Date */}
                        <div className="col-span-1">
                          <p className="text-xs text-slate-400 flex items-center gap-1 whitespace-nowrap">
                            <Calendar size={10} />
                            {formatDate(c.createdAt)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/history/${c.id}`); }}
                            className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
                            title="View details"
                          >
                            <ExternalLink size={14} />
                          </button>
                          {canDelete && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(c.id); }}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          <ChevronRight size={14} className="text-slate-300" />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Table footer */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
                  Showing {filtered.length} of {campaigns.length} campaigns
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Delete confirmation ── */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-7"
            >
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Delete this campaign?</h3>
              <p className="text-slate-500 text-sm mb-6">
                This will permanently delete the campaign execution and all associated data. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Deleting…</>
                  ) : (
                    <><Trash2 size={14} /> Delete</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
