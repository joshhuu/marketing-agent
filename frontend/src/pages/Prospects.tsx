import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, TrendingUp, Target, Star, Search,
  ChevronUp, ChevronDown, AlertCircle,
  ChevronLeft, ChevronRight, X, BarChart2
} from 'lucide-react';
import { ApiClient, ProspectHistory } from '../lib/api';
import { ProspectDetailModal } from '../components/ProspectDetailModal';

/* ─── helpers ─────────────────────────────────────────────── */
type SortKey = 'priority' | 'name' | 'company';
type SortDir = 'asc' | 'desc';

const priorityStyle = (score: number) => {
  if (score >= 0.85) return { text: 'text-emerald-600', bar: 'bg-emerald-500', label: 'High' };
  if (score >= 0.70) return { text: 'text-amber-600', bar: 'bg-amber-500', label: 'Mid' };
  return { text: 'text-slate-400', bar: 'bg-slate-300', label: 'Low' };
};

const formatLastContacted = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const diffDays = (Date.now() - date.getTime()) / 86_400_000;
  if (diffDays < 1) return 'Today';
  if (diffDays < 2) return 'Yesterday';
  if (diffDays < 7) return 'This week';
  return date.toLocaleDateString();
};

// Deterministic avatar color from name
const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-blue-500',
  'bg-emerald-500', 'bg-pink-500', 'bg-amber-500', 'bg-sky-500',
];
const avatarColor = (name: string) =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

/* ─── type ───────────────────────────────────────────────── */
interface Prospect {
  id: string;
  name: string;
  title: string;
  company: string;
  industry: string;
  priority: number;
  timesContacted: number;
  lastContacted: string;
  fromCampaign?: boolean;
}

/* ─── page ───────────────────────────────────────────────── */
export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProspects, setTotalProspects] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setError(null);
        const response = await ApiClient.getRecentCampaignProspects(50, currentPage);
        setProspects(response.prospects.map((item: ProspectHistory) => ({
          id: item.id,
          name: item.name,
          title: item.job_title,
          company: item.company_name,
          industry: item.industry,
          priority: item.priority_score,
          timesContacted: item.times_contacted,
          lastContacted: formatLastContacted(item.last_contacted_at),
          fromCampaign: item.from_campaign || false,
        })));
        setTotalProspects(response.total);
        setTotalPages(response.total_pages);
      } catch {
        setError('Failed to load prospects. Make sure the backend is running.');
      } finally {
        setLoading(false);
      }
    })();
  }, [currentPage]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return prospects
      .filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.company.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.industry.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const m = sortDir === 'asc' ? 1 : -1;
        if (sortKey === 'priority') return m * (a.priority - b.priority);
        if (sortKey === 'name') return m * a.name.localeCompare(b.name);
        return m * a.company.localeCompare(b.company);
      });
  }, [prospects, search, sortKey, sortDir]);

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronUp size={12} className="text-slate-300" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-indigo-500" />
      : <ChevronDown size={12} className="text-indigo-500" />;
  };

  const highPriority = prospects.filter((p) => p.priority >= 0.85).length;
  const contacted = prospects.filter((p) => p.timesContacted > 0).length;
  const avgPriority = prospects.length > 0
    ? (prospects.reduce((a, p) => a + p.priority, 0) / prospects.length).toFixed(2)
    : '0.00';

  const STAT_CARDS = [
    { label: 'Total Prospects', value: totalProspects, icon: Users, gradient: 'from-indigo-500 to-violet-600' },
    { label: 'High Priority', value: highPriority, icon: Target, gradient: 'from-emerald-500 to-teal-600' },
    { label: 'Contacted', value: contacted, icon: TrendingUp, gradient: 'from-amber-500 to-orange-500' },
    { label: 'Avg Score', value: avgPriority, icon: BarChart2, gradient: 'from-blue-500 to-sky-500' },
  ];

  return (
    <div className="min-h-full bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Prospects</h1>
          <p className="text-slate-500 text-sm mt-0.5">Browse all ICP-matched prospects in your database</p>
        </motion.div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {STAT_CARDS.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-md bg-gradient-to-br ${s.gradient}`}
              >
                <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10 blur-xl" />
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <p className="text-white/70 text-xs font-medium mb-1">{s.label}</p>
                    <p className="text-3xl font-extrabold">{s.value}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                    <Icon size={17} className="text-white" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Search ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-5">
          <div className="relative max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, company, title, industry…"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent shadow-sm transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                <X size={14} />
              </button>
            )}
          </div>
        </motion.div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-500 text-sm">Loading prospects…</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex gap-3 mb-5">
            <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-red-700 text-sm">Error loading prospects</p>
              <p className="text-red-600 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        {!loading && !error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Table head */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {[
                        { key: 'name' as SortKey, label: 'Name' },
                        { key: null, label: 'Title' },
                        { key: 'company' as SortKey, label: 'Company' },
                        { key: null, label: 'Industry' },
                        { key: 'priority' as SortKey, label: 'Priority' },
                        { key: null, label: 'Last Contact' },
                      ].map((col) => (
                        <th
                          key={col.label}
                          onClick={col.key ? () => handleSort(col.key!) : undefined}
                          className={`text-left px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest ${col.key ? 'cursor-pointer hover:text-slate-700 select-none' : ''}`}
                        >
                          <span className="flex items-center gap-1">
                            {col.label}
                            {col.key && <SortIcon k={col.key} />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <AnimatePresence>
                      {filtered.map((p, i) => {
                        const ps = priorityStyle(p.priority);
                        return (
                          <motion.tr
                            key={p.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: Math.min(i * 0.02, 0.4) }}
                            onClick={() => setSelectedProspectId(p.id)}
                            className="hover:bg-indigo-50/50 transition-colors group cursor-pointer"
                          >
                            {/* Name + avatar */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-xl ${avatarColor(p.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                                  {p.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">{p.name}</span>
                              </div>
                            </td>

                            {/* Title */}
                            <td className="px-5 py-3.5 text-sm text-slate-500">{p.title}</td>

                            {/* Company */}
                            <td className="px-5 py-3.5">
                              <span className="text-sm font-medium text-slate-800">{p.company}</span>
                            </td>

                            {/* Industry + badge */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg">{p.industry}</span>
                                {p.fromCampaign && (
                                  <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-lg font-medium">📊 Campaign</span>
                                )}
                              </div>
                            </td>

                            {/* Priority */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${ps.bar}`}
                                    style={{ width: `${p.priority * 100}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-mono font-bold ${ps.text}`}>{p.priority.toFixed(2)}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${p.priority >= 0.85 ? 'bg-emerald-50 text-emerald-600' :
                                    p.priority >= 0.70 ? 'bg-amber-50 text-amber-600' :
                                      'bg-slate-100 text-slate-500'
                                  }`}>{ps.label}</span>
                              </div>
                            </td>

                            {/* Last contact */}
                            <td className="px-5 py-3.5">
                              <div className="text-xs text-slate-500">
                                {p.lastContacted}
                                {p.timesContacted > 0 && (
                                  <span className="ml-1.5 font-semibold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                                    ×{p.timesContacted}
                                  </span>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* Empty state inside table */}
              {filtered.length === 0 && (
                <div className="py-16 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    <Users size={24} className="text-slate-400" />
                  </div>
                  <p className="font-semibold text-slate-700 mb-1">No prospects found</p>
                  <p className="text-slate-400 text-sm">Try adjusting your search query</p>
                </div>
              )}

              {/* Pagination */}
              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Page <span className="font-semibold text-slate-600">{currentPage}</span> of <span className="font-semibold text-slate-600">{totalPages}</span>
                  <span className="ml-1.5">({totalProspects.toLocaleString()} total)</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-white hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${currentPage === page
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-100'
                          }`}
                      >
                        {page}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-white hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Prospect Detail Modal ── */}
      <ProspectDetailModal
        prospectId={selectedProspectId}
        onClose={() => setSelectedProspectId(null)}
      />
    </div>
  );
}
