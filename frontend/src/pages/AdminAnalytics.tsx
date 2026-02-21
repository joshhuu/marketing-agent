import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import {
  Activity, AlertCircle, Clock, TrendingUp,
  Download, FileJson, FileSpreadsheet, RefreshCw,
  Search, X, Terminal, Zap, Globe, CheckCircle2,
  ChevronRight, Filter, ToggleLeft, ToggleRight,
  BarChart2, Layers, MessageSquare
} from "lucide-react";

/* ─── types ─────────────────────────────────────────────── */
interface APIStat {
  total_calls: number;
  avg_response_time_ms: number;
  error_count: number;
  success_rate: number;
}

interface APILog {
  id: string;
  endpoint: string;
  method: string;
  user_role: string;
  status_code: number;
  response_time_ms: number;
  ip_address: string;
  prompt_preview: string | null;
  created_at: string;
}

/* ─── helpers ─────────────────────────────────────────────── */
const formatToIST = (utcDateString: string): string => {
  const date = new Date(utcDateString);
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const formatTimeAgo = (utcDateString: string): string => {
  const diffMs = Date.now() - new Date(utcDateString).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};

const METHOD_STYLE: Record<string, string> = {
  GET: "bg-blue-50 text-blue-700 border-blue-200",
  POST: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DELETE: "bg-red-50 text-red-700 border-red-200",
  PUT: "bg-amber-50 text-amber-700 border-amber-200",
  PATCH: "bg-orange-50 text-orange-700 border-orange-200",
};

const statusStyle = (code: number) => {
  if (code >= 200 && code < 300) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (code >= 400 && code < 500) return "bg-amber-50 text-amber-700 border-amber-200";
  if (code >= 500) return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
};

const responseTimeColor = (ms: number) => {
  if (ms <= 300) return "text-emerald-600";
  if (ms <= 1000) return "text-amber-600";
  return "text-red-600";
};

type Tab = "feed" | "endpoints" | "prompts";

/* ─── mini sparkline – pure CSS bars ─────────────────────── */
function MiniSparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-1.5 rounded-sm bg-indigo-400/60 flex-shrink-0"
          style={{ height: `${Math.max((v / max) * 100, 4)}%` }}
        />
      ))}
    </div>
  );
}

/* ─── status distribution bar ────────────────────────────── */
function StatusBar({ logs }: { logs: APILog[] }) {
  const total = logs.length || 1;
  const ok = logs.filter((l) => l.status_code >= 200 && l.status_code < 300).length;
  const warn = logs.filter((l) => l.status_code >= 400 && l.status_code < 500).length;
  const err = logs.filter((l) => l.status_code >= 500).length;

  return (
    <div className="space-y-1">
      <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
        {ok > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${(ok / total) * 100}%` }} />}
        {warn > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${(warn / total) * 100}%` }} />}
        {err > 0 && <div className="bg-red-500 transition-all" style={{ width: `${(err / total) * 100}%` }} />}
      </div>
      <div className="flex items-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{ok} 2xx</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{warn} 4xx</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{err} 5xx</span>
      </div>
    </div>
  );
}

/* ─── main page ──────────────────────────────────────────── */
const AdminAnalyticsPage = () => {
  const { userRole } = useAuth();
  const [stats, setStats] = useState<APIStat | null>(null);
  const [logs, setLogs] = useState<APILog[]>([]);
  const [promptLogs, setPromptLogs] = useState<APILog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [tab, setTab] = useState<Tab>("feed");
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("ALL");
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [liveIndicator, setLiveIndicator] = useState(false);

  /* ── blink the live indicator ── */
  useEffect(() => {
    const t = setInterval(() => setLiveIndicator((v) => !v), 1000);
    return () => clearInterval(t);
  }, []);

  /* ── export ── */
  const handleExport = async (format: "csv" | "json", promptsOnly = false) => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format, prompts_only: promptsOnly.toString() });
      const res = await fetch(`http://localhost:8000/admin/api-calls/export?${params}`, {
        headers: { "X-User-Role": userRole || "admin" },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `analytics_${promptsOnly ? "prompts_" : ""}${new Date().toISOString().split("T")[0]}.${format}`;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch { /* silent */ } finally { setExporting(false); }
  };

  /* ── fetch ── */
  const fetchAPILogs = useCallback(async () => {
    try {
      const [mainRes, promptRes] = await Promise.all([
        fetch("http://localhost:8000/admin/api-calls?limit=100", {
          headers: { "X-User-Role": userRole || "admin" },
        }),
        fetch("http://localhost:8000/admin/api-calls?limit=50&prompts_only=true", {
          headers: { "X-User-Role": userRole || "admin" },
        }),
      ]);

      if (mainRes.ok) {
        const data = await mainRes.json();
        setStats(data.statistics);
        setLogs(data.logs);
        setLastUpdate(new Date().toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit",
        }));
      }
      if (promptRes.ok) {
        const pd = await promptRes.json();
        setPromptLogs(pd.logs);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [userRole]);

  useEffect(() => {
    fetchAPILogs();
    if (!autoRefresh) return;
    const id = setInterval(fetchAPILogs, 5000);
    return () => clearInterval(id);
  }, [fetchAPILogs, autoRefresh]);

  /* ── derived data ── */
  const filteredLogs = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter((l) => {
      const matchSearch = !q || l.endpoint.toLowerCase().includes(q) ||
        l.user_role.toLowerCase().includes(q) || String(l.status_code).includes(q);
      const matchMethod = methodFilter === "ALL" || l.method === methodFilter;
      return matchSearch && matchMethod;
    });
  }, [logs, search, methodFilter]);

  const endpointStats = useMemo(() => {
    const map = new Map<string, { count: number; totalMs: number; errors: number }>();
    logs.forEach((l) => {
      const key = `${l.method} ${l.endpoint}`;
      const existing = map.get(key) || { count: 0, totalMs: 0, errors: 0 };
      map.set(key, {
        count: existing.count + 1,
        totalMs: existing.totalMs + l.response_time_ms,
        errors: existing.errors + (l.status_code >= 400 ? 1 : 0),
      });
    });
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v, avgMs: v.totalMs / v.count }))
      .sort((a, b) => b.count - a.count);
  }, [logs]);

  const methods = useMemo(() => ["ALL", ...new Set(logs.map((l) => l.method))], [logs]);
  const recentTimes = useMemo(() => logs.slice(0, 20).map((l) => l.response_time_ms).reverse(), [logs]);
  const uniqueEndpoints = useMemo(() => new Set(logs.map((l) => l.endpoint)).size, [logs]);

  if (loading) return (
    <div className="min-h-full bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading analytics…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">System Analytics</h1>
            <p className="text-slate-500 text-sm mt-0.5">Monitor API usage, performance metrics, and AI prompt logs</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Live indicator */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 shadow-sm">
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? (liveIndicator ? 'bg-emerald-500' : 'bg-emerald-300') : 'bg-slate-300'}`} />
              <span className="text-xs font-semibold text-slate-600">{autoRefresh ? 'Live' : 'Paused'}</span>
              <button onClick={() => setAutoRefresh((v) => !v)} className="ml-1 text-slate-400 hover:text-indigo-600 transition-colors">
                {autoRefresh ? <ToggleRight size={18} className="text-indigo-600" /> : <ToggleLeft size={18} />}
              </button>
            </div>

            {lastUpdate && (
              <span className="text-xs text-slate-400 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm">
                Updated: <span className="font-semibold text-slate-600">{lastUpdate} IST</span>
              </span>
            )}

            <button onClick={fetchAPILogs}
              className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-700 text-sm font-semibold px-3.5 py-2.5 rounded-xl shadow-sm transition-all">
              <RefreshCw size={14} /> Refresh
            </button>

            {/* Export group */}
            <div className="flex items-center gap-1.5">
              {[
                { label: "CSV", icon: FileSpreadsheet, fmt: "csv" as const },
                { label: "JSON", icon: FileJson, fmt: "json" as const },
              ].map(({ label, icon: Icon, fmt }) => (
                <button key={fmt}
                  onClick={() => handleExport(fmt)}
                  disabled={exporting}
                  className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold px-3 py-2.5 rounded-xl transition-all disabled:opacity-50">
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: "Total Calls", value: stats?.total_calls.toLocaleString() ?? "0", gradient: "from-indigo-500 to-violet-600", icon: Activity },
            { label: "Avg Response", value: `${(stats?.avg_response_time_ms ?? 0).toFixed(0)}ms`, gradient: "from-sky-500 to-blue-600", icon: Clock },
            { label: "Success Rate", value: `${(stats?.success_rate ?? 0).toFixed(1)}%`, gradient: "from-emerald-500 to-teal-600", icon: TrendingUp },
            { label: "Errors", value: String(stats?.error_count ?? 0), gradient: "from-rose-500 to-red-600", icon: AlertCircle },
            { label: "Unique Endpoints", value: String(uniqueEndpoints), gradient: "from-amber-500 to-orange-500", icon: Globe },
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
                    <p className="text-2xl font-extrabold">{s.value}</p>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Icon size={15} className="text-white" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Status Distribution + Sparkline overview ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Status Distribution</p>
            <StatusBar logs={logs} />
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Response Time Trend (Last 20)</p>
            {recentTimes.length > 0
              ? <MiniSparkline values={recentTimes} />
              : <p className="text-slate-400 text-sm">No data yet</p>
            }
            <p className="text-[11px] text-slate-400 mt-1">Each bar = one API call; taller = slower</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-slate-100 bg-slate-50 px-5 pt-4 gap-1">
            {([
              { key: "feed", label: "Live Feed", icon: Zap },
              { key: "endpoints", label: "Endpoint Breakdown", icon: BarChart2 },
              { key: "prompts", label: "Prompt Logs", icon: MessageSquare },
            ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold transition-all border-b-2 ${tab === key
                    ? "border-indigo-600 text-indigo-700 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}>
                <Icon size={14} /> {label}
                {key === "prompts" && promptLogs.length > 0 && (
                  <span className="ml-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {promptLogs.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab: Live Feed ── */}
          <AnimatePresence mode="wait">
            {tab === "feed" && (
              <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Filters */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-50 flex-wrap">
                  <div className="relative flex-1 min-w-48">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter by endpoint, role, status…"
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all" />
                    {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X size={13} /></button>}
                  </div>
                  {/* Method chips */}
                  <div className="flex items-center gap-1.5">
                    {methods.map((m) => (
                      <button key={m} onClick={() => setMethodFilter(m)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${methodFilter === m
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                          }`}>{m}</button>
                    ))}
                  </div>
                  <span className="text-xs text-slate-400 ml-auto">
                    {filteredLogs.length} / {logs.length} calls
                  </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {["Endpoint", "Method", "Status", "Time", "Role", "Response", "When"].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredLogs.slice(0, 50).map((log, i) => (
                        <motion.tr key={log.id}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.01, 0.5) }}
                          className="hover:bg-indigo-50/30 transition-colors group">
                          <td className="px-5 py-3 font-mono text-xs text-slate-700 max-w-48 truncate">{log.endpoint}</td>
                          <td className="px-5 py-3">
                            <span className={`text-[11px] font-bold border px-2 py-0.5 rounded-lg ${METHOD_STYLE[log.method] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                              {log.method}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-[11px] font-bold border px-2 py-0.5 rounded-lg ${statusStyle(log.status_code)}`}>
                              {log.status_code}
                            </span>
                          </td>
                          <td className={`px-5 py-3 font-mono text-xs font-bold ${responseTimeColor(log.response_time_ms)}`}>
                            {log.response_time_ms.toFixed(0)}ms
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-[11px] font-semibold bg-violet-50 border border-violet-200 text-violet-700 px-2 py-0.5 rounded-lg capitalize">{log.user_role}</span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${log.response_time_ms <= 300 ? 'bg-emerald-500' : log.response_time_ms <= 1000 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${Math.min((log.response_time_ms / 2000) * 100, 100)}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">{formatTimeAgo(log.created_at)}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredLogs.length === 0 && (
                    <div className="py-12 text-center text-slate-400">
                      <Terminal size={30} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No API calls match your filter</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-xs text-slate-400">Showing up to 50 of {filteredLogs.length} filtered results</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport("csv")} disabled={exporting}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-200 transition-all disabled:opacity-50">
                      <FileSpreadsheet size={12} /> Export CSV
                    </button>
                    <button onClick={() => handleExport("json")} disabled={exporting}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-200 transition-all disabled:opacity-50">
                      <FileJson size={12} /> Export JSON
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Tab: Endpoint Breakdown ── */}
            {tab === "endpoints" && (
              <motion.div key="endpoints" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Endpoints</p>
                      <p className="text-2xl font-extrabold text-slate-800">{endpointStats.length}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Busiest</p>
                      <p className="text-sm font-bold text-indigo-700 truncate">{endpointStats[0]?.key ?? "—"}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Slowest Avg</p>
                      <p className="text-sm font-bold text-amber-600">
                        {endpointStats.length > 0
                          ? `${Math.max(...endpointStats.map((e) => e.avgMs)).toFixed(0)}ms`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {endpointStats.map((ep, i) => {
                    const maxCount = endpointStats[0]?.count || 1;
                    const [method, ...rest] = ep.key.split(" ");
                    const endpoint = rest.join(" ");
                    return (
                      <div key={ep.key} className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-[11px] font-bold border px-2 py-0.5 rounded-lg shrink-0 ${METHOD_STYLE[method] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>{method}</span>
                            <span className="font-mono text-xs text-slate-700 truncate">{endpoint}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4 text-xs">
                            <span className="font-bold text-slate-800">{ep.count} calls</span>
                            <span className={`font-mono font-bold ${responseTimeColor(ep.avgMs)}`}>{ep.avgMs.toFixed(0)}ms avg</span>
                            {ep.errors > 0 && (
                              <span className="text-red-600 font-semibold">{ep.errors} err</span>
                            )}
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${(ep.count / maxCount) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}

                  {endpointStats.length === 0 && (
                    <div className="py-12 text-center text-slate-400">
                      <BarChart2 size={30} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No endpoint data yet</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Tab: Prompt Logs ── */}
            {tab === "prompts" && (
              <motion.div key="prompts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                  <p className="text-sm text-slate-500">AI prompts captured during campaign execution</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport("csv", true)} disabled={exporting}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-200 transition-all disabled:opacity-50">
                      <FileSpreadsheet size={12} /> Prompts CSV
                    </button>
                    <button onClick={() => handleExport("json", true)} disabled={exporting}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-200 transition-all disabled:opacity-50">
                      <FileJson size={12} /> Prompts JSON
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  {promptLogs.length > 0 ? (
                    promptLogs.map((log) => (
                      <div key={log.id}
                        className="bg-white border border-slate-100 rounded-2xl overflow-hidden hover:border-indigo-200 transition-all">
                        <div
                          className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => setExpandedPrompt(expandedPrompt === log.id ? null : log.id)}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`text-[11px] font-bold border px-2 py-0.5 rounded-lg shrink-0 ${METHOD_STYLE[log.method] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>{log.method}</span>
                            <span className="font-mono text-xs text-slate-700 truncate">{log.endpoint}</span>
                            <span className="text-xs text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-lg capitalize shrink-0">{log.user_role}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <span className="text-xs text-slate-400">{formatTimeAgo(log.created_at)}</span>
                            <ChevronRight size={14} className={`text-slate-400 transition-transform ${expandedPrompt === log.id ? 'rotate-90' : ''}`} />
                          </div>
                        </div>

                        <AnimatePresence>
                          {expandedPrompt === log.id && log.prompt_preview && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden border-t border-slate-100">
                              <div className="px-5 py-4 bg-slate-50">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Prompt Preview</p>
                                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-[system-ui] bg-white border border-slate-100 rounded-xl p-4 leading-relaxed max-h-60 overflow-y-auto">
                                  {log.prompt_preview}
                                </pre>
                                <p className="text-[11px] text-slate-400 mt-2">{formatToIST(log.created_at)} IST</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))
                  ) : (
                    <div className="py-16 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <MessageSquare size={24} className="text-slate-400" />
                      </div>
                      <p className="font-semibold text-slate-700 mb-1">No prompt logs yet</p>
                      <p className="text-slate-400 text-sm">Prompts will appear here when campaigns run</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
