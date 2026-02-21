import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Search, Calendar, User, Building2, Eye,
  RefreshCw, X, CheckCircle, Clock, Send, Filter,
  ChevronDown, AlertCircle
} from 'lucide-react';
import { ApiClient, SentEmail } from '../lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

/* ─── helpers ─────────────────────────────────────────────── */
type DateRange = 'all' | 'today' | 'week' | 'month';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const diffHours = (Date.now() - date.getTime()) / 3_600_000;
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diffHours < 48) return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString([], {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Avatar color from name
const AVATAR_COLORS = ['bg-indigo-500', 'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-pink-500', 'bg-amber-500'];
const avatarBg = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const STATUS_STYLE: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  delivered: 'bg-blue-50 text-blue-700 border-blue-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
};

const ROLE_STYLE: Record<string, string> = {
  admin: 'bg-violet-50 text-violet-700 border-violet-200',
  user: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

/* ──────────────────────────────────────────────────────────── */
export default function SentEmailsPage() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [selectedEmail, setSelectedEmail] = useState<SentEmail | null>(null);

  /* ── fetch ── */
  const fetchSentEmails = async () => {
    try {
      setLoading(true);
      const res = await ApiClient.getSentEmails();
      setEmails(res.sent_emails);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load sent emails.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSentEmails(); }, []);

  /* ── filtered list ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const now = Date.now();
    const CUTOFF: Record<DateRange, number> = {
      all: 0,
      today: new Date().setHours(0, 0, 0, 0),
      week: now - 7 * 86_400_000,
      month: now - 30 * 86_400_000,
    };
    return emails.filter((e) => {
      const matchSearch = !q ||
        e.prospect_name.toLowerCase().includes(q) ||
        e.prospect_company.toLowerCase().includes(q) ||
        e.email_subject.toLowerCase().includes(q);
      const matchDate = dateRange === 'all' || new Date(e.sent_at).getTime() >= CUTOFF[dateRange];
      return matchSearch && matchDate;
    });
  }, [emails, search, dateRange]);

  /* ── stats ── */
  const stats = useMemo(() => ({
    total: emails.length,
    today: emails.filter((e) => new Date(e.sent_at).toDateString() === new Date().toDateString()).length,
    sent: emails.filter((e) => (e.status || '').toLowerCase() === 'sent').length,
    contacts: new Set(emails.map((e) => e.prospect_name)).size,
  }), [emails]);

  /* ── close on Escape ── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedEmail(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="min-h-full bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sent Emails</h1>
            <p className="text-slate-500 text-sm mt-0.5">Track all outbound emails sent from your campaigns</p>
          </div>
          <button
            onClick={fetchSentEmails}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-700 text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </motion.div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Sent', value: stats.total, gradient: 'from-indigo-500 to-violet-600', icon: Send },
            { label: 'Sent Today', value: stats.today, gradient: 'from-sky-500 to-blue-600', icon: Calendar },
            { label: 'Delivered', value: stats.sent, gradient: 'from-emerald-500 to-teal-600', icon: CheckCircle },
            { label: 'Unique Contacts', value: stats.contacts, gradient: 'from-amber-500 to-orange-500', icon: User },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-md bg-gradient-to-br ${s.gradient}`}>
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

        {/* ── Filters ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="flex items-center gap-3 mb-5 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-60">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, company, or subject…"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent shadow-sm transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date chips */}
          <div className="flex items-center gap-1.5">
            {(['all', 'today', 'week', 'month'] as DateRange[]).map((range) => (
              <button key={range} onClick={() => setDateRange(range)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${dateRange === range
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'
                  }`}>
                {range === 'all' ? 'All Time' : range === 'today' ? 'Today' : range === 'week' ? 'Last 7d' : 'Last 30d'}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-500 text-sm">Loading sent emails…</p>
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && filtered.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Mail size={28} className="text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700 mb-1">No emails found</p>
            <p className="text-slate-400 text-sm">
              {search || dateRange !== 'all' ? 'Try adjusting your filters' : 'Emails sent from campaigns will appear here'}
            </p>
          </motion.div>
        )}

        {/* ── Table ── */}
        {!loading && filtered.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['Prospect', 'Company', 'Subject', 'Sent', 'Role', 'Status', ''].map((h) => (
                        <th key={h} className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <AnimatePresence>
                      {filtered.map((email, i) => (
                        <motion.tr
                          key={email.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: Math.min(i * 0.02, 0.5) }}
                          className="hover:bg-indigo-50/40 transition-colors group cursor-pointer"
                          onClick={() => setSelectedEmail(email)}
                        >
                          {/* Prospect */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl ${avatarBg(email.prospect_name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                {email.prospect_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">{email.prospect_name}</p>
                                <p className="text-xs text-slate-400">{email.prospect_job_title}</p>
                              </div>
                            </div>
                          </td>

                          {/* Company */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="text-sm font-medium text-slate-700">{email.prospect_company}</span>
                          </td>

                          {/* Subject */}
                          <td className="px-5 py-3.5 max-w-xs">
                            <p className="text-sm text-slate-600 truncate">{email.email_subject}</p>
                          </td>

                          {/* Sent at */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="text-xs text-slate-500">{formatDate(email.sent_at)}</span>
                          </td>

                          {/* Role */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className={`text-xs font-semibold border px-2.5 py-1 rounded-lg capitalize ${ROLE_STYLE[email.sent_by_role] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                              {email.sent_by_role}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold border px-2.5 py-1 rounded-lg capitalize ${STATUS_STYLE[(email.status || 'sent').toLowerCase()] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${(email.status || '').toLowerCase() === 'sent' ? 'bg-emerald-500' :
                                  (email.status || '').toLowerCase() === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                                }`} />
                              {email.status || 'Sent'}
                            </span>
                          </td>

                          {/* View button */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedEmail(email); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200"
                            >
                              <Eye size={12} /> View
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* Table footer */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
                Showing <span className="font-semibold text-slate-600">{filtered.length}</span> of <span className="font-semibold text-slate-600">{emails.length}</span> emails
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Email Viewer Modal ── */}
      <AnimatePresence>
        {selectedEmail && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelectedEmail(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 28, stiffness: 380 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-indigo-200 text-xs font-semibold uppercase tracking-widest mb-1">Subject</p>
                    <h2 className="text-white font-extrabold text-lg leading-snug truncate">
                      {selectedEmail.email_subject}
                    </h2>
                  </div>
                  <button onClick={() => setSelectedEmail(null)}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0">
                    <X size={17} />
                  </button>
                </div>

                {/* Meta row */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-white/10 rounded-xl px-4 py-2.5">
                    <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mb-0.5">To</p>
                    <p className="text-white text-sm font-semibold truncate">{selectedEmail.prospect_name}</p>
                    <p className="text-indigo-200 text-xs truncate">{selectedEmail.prospect_email || selectedEmail.recipient_email}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl px-4 py-2.5">
                    <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mb-0.5">Company</p>
                    <p className="text-white text-sm font-semibold truncate">{selectedEmail.prospect_company}</p>
                    <p className="text-indigo-200 text-xs truncate">{selectedEmail.prospect_job_title}</p>
                  </div>
                </div>

                {/* Badges row */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="bg-white/15 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Calendar size={11} /> {formatDateFull(selectedEmail.sent_at)}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${(selectedEmail.status || '').toLowerCase() === 'sent'
                      ? 'bg-emerald-400/30 text-emerald-100'
                      : 'bg-white/20 text-white'
                    }`}>
                    ● {selectedEmail.status || 'Sent'}
                  </span>
                  <span className="bg-white/15 text-white text-xs font-semibold px-2.5 py-1 rounded-full capitalize">
                    {selectedEmail.sent_by_role}
                  </span>
                </div>
              </div>

              {/* Email body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-[system-ui] bg-slate-50 rounded-xl border border-slate-100 p-5">
                  {selectedEmail.email_body}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
                <a
                  href={`mailto:${selectedEmail.prospect_email || selectedEmail.recipient_email}`}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Mail size={14} /> Reply
                </a>
                <button onClick={() => setSelectedEmail(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors">
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
