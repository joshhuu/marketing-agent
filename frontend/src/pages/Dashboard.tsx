import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Zap, Users, Target, Mail, ArrowRight, ArrowUpRight,
  Calendar, ChevronRight, Activity, Bot, Cpu, Filter, Send, CheckCircle2, Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../lib/api';
import { useAuth } from '@/contexts/AuthContext';

/* ─── Types ─────────────────────────────────────────────── */
interface DashboardStats {
  totalCampaigns: number;
  totalProspects: number;
  avgConfidence: number;
  emailsSent: number;
  recentActivity: number;
  highUrgency: number;
}

interface ChannelData { name: string; value: number; }
interface UrgencyData { name: string; count: number; }
interface TrendData { date: string; campaigns: number; }

/* ─── Constants ─────────────────────────────────────────── */
const CHART_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b'];

const URGENCY_COLORS: Record<string, string> = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#22c55e',
};

const AGENTS = [
  { icon: Bot, label: 'Input Parser', sub: 'Parses intent & context' },
  { icon: Cpu, label: 'Classifier', sub: 'Category + confidence' },
  { icon: Target, label: 'Strategy', sub: 'Tone, CTA, urgency' },
  { icon: Filter, label: 'ICP Matcher', sub: 'Ranks prospects' },
  { icon: Activity, label: 'Platform Decision', sub: 'Selects channel' },
  { icon: Zap, label: 'Content Generator', sub: 'Personalized copy' },
  { icon: Send, label: 'Sender', sub: 'Email / Call / LinkedIn' },
];

/* ─── Animated Counter ──────────────────────────────────── */
function AnimatedCounter({ value, prefix = '', suffix = '', decimals = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    let start = 0;
    const duration = 1200;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(parseFloat((eased * value).toFixed(decimals)));
      if (progress < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [value, decimals]);

  return <>{prefix}{decimals > 0 ? display.toFixed(decimals) : Math.round(display)}{suffix}</>;
}

/* ─── KPI Card ──────────────────────────────────────────── */
function KpiCard({ gradient, icon: Icon, label, value, sub, prefix = '', suffix = '', decimals = 0, delay = 0 }: {
  gradient: string; icon: any; label: string; value: number;
  sub: string; prefix?: string; suffix?: string; decimals?: number; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
      className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg ${gradient}`}
    >
      {/* Decorative blob */}
      <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -right-2 -bottom-4 w-20 h-20 rounded-full bg-white/10" />

      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-white/70 text-sm font-medium mb-1">{label}</p>
          <p className="text-4xl font-extrabold tracking-tight leading-none">
            <AnimatedCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
          </p>
          <p className="text-white/60 text-xs mt-2 flex items-center gap-1">
            <ArrowUpRight size={12} className="text-white/80" /> {sub}
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Custom Tooltip ────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 shadow-xl text-white text-xs">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

/* ─── Dashboard ─────────────────────────────────────────── */
export default function Dashboard() {
  const { userRole } = useAuth();
  const canCreateCampaign = userRole === 'admin' || userRole === 'user';

  const [stats, setStats] = useState<DashboardStats>({
    totalCampaigns: 0, totalProspects: 0, avgConfidence: 0,
    emailsSent: 0, recentActivity: 0, highUrgency: 0,
  });
  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [urgencyData, setUrgencyData] = useState<UrgencyData[]>([]);
  const [campaignTrends, setCampaignTrends] = useState<TrendData[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [history, prospectsRes, sentEmailsRes] = await Promise.all([
        ApiClient.getExecutionHistory(100),
        ApiClient.getRecentCampaignProspects(1, 10),
        ApiClient.getSentEmails(undefined, undefined, 200, 0).catch(() => ({ total_count: 0 })),
      ]);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentActivity = history.filter(h => new Date(h.created_at) > sevenDaysAgo).length;
      const highUrgency = history.filter(h => h.urgency_level === 'high').length;
      const avgConfidence = history.length > 0
        ? history.reduce((s, h) => s + h.confidence, 0) / history.length : 0;

      setStats({
        totalCampaigns: history.length,
        totalProspects: prospectsRes.total || 0,
        avgConfidence,
        emailsSent: (sentEmailsRes as any).total_count ?? 0,
        recentActivity,
        highUrgency,
      });

      setRecentCampaigns(history.slice(0, 5));

      // Channel distribution
      const chanMap: Record<string, number> = {};
      for (const c of history) {
        const ch = c.category?.includes('lead_gen') ? 'LinkedIn'
          : c.category?.includes('urgent') ? 'Call' : 'Email';
        chanMap[ch] = (chanMap[ch] || 0) + 1;
      }
      setChannelData(Object.entries(chanMap).map(([name, value]) => ({ name, value })));

      // Urgency distribution
      const urg: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
      for (const c of history) {
        const k = (c.urgency_level || 'medium');
        const key = k.charAt(0).toUpperCase() + k.slice(1);
        if (key in urg) urg[key]++;
      }
      setUrgencyData(Object.entries(urg).map(([name, count]) => ({ name, count })));

      // Trend (last 14 days)
      const days = Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        return d;
      });
      setCampaignTrends(days.map(d => ({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        campaigns: history.filter(h => new Date(h.created_at).toDateString() === d.toDateString()).length,
      })));
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-medium">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="min-h-full bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">Campaign intelligence &amp; real-time performance</p>
          </div>
          {canCreateCampaign && (
            <Link
              to="/campaign"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              <Zap size={15} /> New Campaign <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {/* ── KPI Cards (4 best metrics) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
          <KpiCard
            gradient="bg-gradient-to-br from-indigo-500 to-violet-600"
            icon={Zap} label="Campaigns Executed"
            value={stats.totalCampaigns}
            sub={`${stats.recentActivity} this week`}
            delay={0}
          />
          <KpiCard
            gradient="bg-gradient-to-br from-sky-500 to-blue-600"
            icon={Users} label="Prospects Matched"
            value={stats.totalProspects}
            sub="Across all campaigns"
            delay={0.08}
          />
          <KpiCard
            gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
            icon={Mail} label="Emails Sent"
            value={stats.emailsSent}
            sub="Via Maileroo"
            delay={0.16}
          />
          <KpiCard
            gradient="bg-gradient-to-br from-amber-500 to-orange-500"
            icon={Target} label="Avg ICP Confidence"
            value={stats.avgConfidence * 100}
            suffix="%"
            decimals={1}
            sub={`${stats.highUrgency} high-urgency campaigns`}
            delay={0.24}
          />
        </div>

        {/* ── Agent Pipeline Strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white border border-slate-100 rounded-2xl p-6 mb-8 shadow-sm overflow-x-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">AI Agent Pipeline</h2>
              <p className="text-xs text-slate-400">7-agent execution flow powering every campaign</p>
            </div>
            <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full border border-indigo-100">
              Live Architecture
            </span>
          </div>
          <div className="flex items-center gap-0 min-w-max">
            {AGENTS.map((agent, i) => {
              const Icon = agent.icon;
              return (
                <div key={agent.label} className="flex items-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.32 + i * 0.06 }}
                    className="flex flex-col items-center gap-2 px-3"
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${i === 0 ? 'bg-indigo-600' :
                        i === 1 ? 'bg-violet-600' :
                          i === 2 ? 'bg-blue-600' :
                            i === 3 ? 'bg-sky-600' :
                              i === 4 ? 'bg-cyan-600' :
                                i === 5 ? 'bg-emerald-600' : 'bg-amber-600'
                      }`}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-bold text-slate-800 whitespace-nowrap">{agent.label}</p>
                      <p className="text-[10px] text-slate-400 whitespace-nowrap">{agent.sub}</p>
                    </div>
                  </motion.div>
                  {i < AGENTS.length - 1 && (
                    <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Charts Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">

          {/* Campaign Trend – 2/3 width */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Campaign Activity</h3>
                <p className="text-xs text-slate-400">Last 14 days</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-1 rounded-full">
                <Activity size={11} /> Campaigns
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={campaignTrends}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="campaigns" name="Campaigns" stroke="#6366f1" strokeWidth={2.5}
                  fill="url(#areaGrad)" dot={false} activeDot={{ r: 5, fill: '#6366f1' }} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Channel Distribution – 1/3 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm"
          >
            <div className="mb-5">
              <h3 className="text-sm font-bold text-slate-900">Channel Mix</h3>
              <p className="text-xs text-slate-400">Campaign channel distribution</p>
            </div>
            {channelData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={channelData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                      paddingAngle={3} dataKey="value">
                      {channelData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-2">
                  {channelData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-slate-600 font-medium">{d.name}</span>
                      </div>
                      <span className="font-bold text-slate-800">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
            )}
          </motion.div>
        </div>

        {/* ── Bottom Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">

          {/* Urgency Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm"
          >
            <div className="mb-5">
              <h3 className="text-sm font-bold text-slate-900">Urgency Levels</h3>
              <p className="text-xs text-slate-400">AI-classified urgency distribution</p>
            </div>
            {urgencyData.some(u => u.count > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={urgencyData} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Count" radius={[8, 8, 0, 0]}>
                    {urgencyData.map((u) => (
                      <Cell key={u.name} fill={URGENCY_COLORS[u.name] ?? '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
            )}
          </motion.div>

          {/* Recent Campaigns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Campaigns</h3>
                <p className="text-xs text-slate-400">Latest 5 executions</p>
              </div>
              <Link to="/history" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                View all <ArrowRight size={12} />
              </Link>
            </div>

            {recentCampaigns.length > 0 ? (
              <div className="space-y-2">
                {recentCampaigns.map((c) => (
                  <div key={c.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <Calendar size={14} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {c.category?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock size={10} />
                        {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.urgency_level === 'high' ? 'bg-red-500' :
                          c.urgency_level === 'low' ? 'bg-green-500' : 'bg-amber-500'
                        }`} />
                      <span className="text-[11px] text-slate-500 capitalize font-medium">{c.urgency_level || 'med'}</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">
                      {(c.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2">
                <CheckCircle2 size={28} className="opacity-30" />
                <p className="text-sm">No campaigns yet</p>
                {canCreateCampaign && (
                  <Link to="/campaign" className="text-xs text-indigo-600 hover:underline font-medium">
                    Create your first →
                  </Link>
                )}
              </div>
            )}
          </motion.div>
        </div>

        {/* ── CTA Band ── */}
        {canCreateCampaign && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 rounded-2xl p-8 text-white shadow-xl"
          >
            <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute right-20 bottom-0 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold mb-1">Ready for your next campaign?</h3>
                <p className="text-indigo-200 text-sm">
                  Let 7 AI agents handle research, content, and delivery — end to end.
                </p>
              </div>
              <Link
                to="/campaign"
                className="flex-shrink-0 inline-flex items-center gap-2 bg-white text-indigo-700 font-bold px-6 py-3 rounded-xl shadow-md hover:shadow-lg hover:bg-slate-50 transition-all"
              >
                <Zap size={16} /> Launch Campaign <ArrowRight size={15} />
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
