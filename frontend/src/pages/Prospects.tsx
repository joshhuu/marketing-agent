import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Target, Clock, Search, ChevronUp, ChevronDown, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { ApiClient, ProspectHistory } from '../lib/api';
import { ProspectDetailModal } from '../components/ProspectDetailModal';

const STATUS_COLORS: Record<string, string> = {
  'New': 'bg-muted text-muted-foreground',
  'Contacted': 'bg-primary/10 text-primary',
  'Replied': 'bg-warning/10 text-warning',
  'Meeting Booked': 'bg-success/10 text-success',
};

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

type SortKey = 'priority' | 'name' | 'company';
type SortDir = 'asc' | 'desc';

const PRIORITY_COLOR = (score: number) => {
  if (score >= 0.85) return 'text-success font-bold';
  if (score >= 0.70) return 'text-warning font-semibold';
  return 'text-muted-foreground';
};

const formatLastContacted = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  if (diffDays < 1) return 'Today';
  if (diffDays < 2) return 'Yesterday';
  if (diffDays < 7) return 'This week';
  return date.toLocaleDateString();
};

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
    const fetchProspects = async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch paginated prospects from database
        const response = await ApiClient.getRecentCampaignProspects(50, currentPage);
        
        const mapped: Prospect[] = response.prospects.map((item: ProspectHistory) => ({
          id: item.id,
          name: item.name,
          title: item.job_title,
          company: item.company_name,
          industry: item.industry,
          priority: item.priority_score,
          timesContacted: item.times_contacted,
          lastContacted: formatLastContacted(item.last_contacted_at),
          fromCampaign: item.from_campaign || false,
        }));
        
        setProspects(mapped);
        setTotalProspects(response.total);
        setTotalPages(response.total_pages);
      } catch (err) {
        console.error('Failed to fetch prospects:', err);
        setError('Failed to load prospects. Make sure the backend is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchProspects();
  }, [currentPage]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = prospects
    .filter(p => {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || 
             p.company.toLowerCase().includes(q) || 
             p.title.toLowerCase().includes(q) || 
             p.industry.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const mult = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'priority') return mult * (a.priority - b.priority);
      if (sortKey === 'name') return mult * a.name.localeCompare(b.name);
      return mult * a.company.localeCompare(b.company);
    });

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return null;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const stats = [
    { label: 'Total Prospects', value: totalProspects, icon: Users, color: 'text-primary', bg: 'bg-accent' },
    { label: 'High Priority', value: prospects.filter(p => p.priority >= 0.85).length, icon: Target, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Contacted', value: prospects.filter(p => p.timesContacted > 0).length, icon: TrendingUp, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Avg Priority', value: prospects.length > 0 ? (prospects.reduce((a, p) => a + p.priority, 0) / prospects.length).toFixed(2) : '0.00', icon: Clock, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  return (
    <div className="min-h-screen gradient-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Prospects Dashboard</h1>
          </div>
          <p className="text-muted-foreground">Browse all prospects in your database with pagination</p>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {stats.map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.06 }}
              className="card-glass rounded-xl p-4">
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, company, title, industry..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
        </motion.div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground mt-4">Loading prospects...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="card-glass rounded-xl p-6 border border-destructive/20 bg-destructive/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-1">Error Loading Prospects</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Prospects Table */}
        {!loading && !error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="card-glass rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    {[
                      { key: 'name' as SortKey, label: 'Name' },
                      { key: null, label: 'Title' },
                      { key: 'company' as SortKey, label: 'Company' },
                      { key: null, label: 'Industry' },
                      { key: 'priority' as SortKey, label: 'Priority' },
                      { key: null, label: 'Last Contact' },
                    ].map(col => (
                      <th key={col.label}
                        onClick={col.key ? () => handleSort(col.key!) : undefined}
                        className={`text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${col.key ? 'cursor-pointer hover:text-foreground select-none' : ''}`}>
                        <span className="flex items-center gap-1">
                          {col.label}
                          {col.key && <SortIcon k={col.key} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtered.map((prospect, i) => (
                    <motion.tr key={prospect.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.02 * i }}
                      onClick={() => setSelectedProspectId(prospect.id)}
                      className="hover:bg-accent/20 transition-colors group cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
                            {prospect.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-foreground">{prospect.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{prospect.title}</td>
                      <td className="px-4 py-3 text-sm text-foreground font-medium">{prospect.company}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{prospect.industry}</span>
                          {prospect.fromCampaign && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">📊 Campaign</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-16">
                            <div className="h-full bg-gradient-primary rounded-full" style={{ width: `${prospect.priority * 100}%` }} />
                          </div>
                          <span className={`text-xs font-mono ${PRIORITY_COLOR(prospect.priority)}`}>{prospect.priority.toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {prospect.lastContacted}
                          {prospect.timesContacted > 0 && ` (${prospect.timesContacted}x)`}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="px-4 py-3 border-t border-border/40 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Showing page {currentPage} of {totalPages} ({totalProspects} total prospects)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {filtered.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No prospects match your search</p>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Prospect Detail Modal */}
      <ProspectDetailModal
        prospectId={selectedProspectId}
        onClose={() => setSelectedProspectId(null)}
      />
    </div>
  );
}
