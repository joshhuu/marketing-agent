import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { History, ExternalLink, Search, Filter, Trash2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiClient, ExecutionHistory } from '../lib/api';
import { CampaignDetailModal } from '../components/CampaignDetailModal';

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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays < 2) return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function HistoryPage() {
  const [campaigns, setCampaigns] = useState<CampaignHistoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await ApiClient.getExecutionHistory(50, 0);
        
        const mapped: CampaignHistoryItem[] = data.map((item: ExecutionHistory) => ({
          id: item.id,
          prompt: item.business_behavior || item.user_intent || 'Unknown campaign',
          createdAt: item.created_at,
          category: item.category,
          confidence: item.confidence,
          tone: item.tone || 'N/A',
          ctaType: item.cta_type || 'N/A',
          urgencyLevel: item.urgency_level || 'N/A',
        }));
        
        setCampaigns(mapped);
      } catch (err) {
        console.error('Failed to fetch execution history:', err);
        setError('Failed to load campaign history. Make sure the backend is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const handleDeleteClick = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;

    setDeleting(true);
    try {
      await ApiClient.deleteExecution(deleteConfirmId);
      
      // Remove from UI
      const updated = campaigns.filter(c => c.id !== deleteConfirmId);
      setCampaigns(updated);
      
      // Show success message
      setSuccessMessage('Successfully deleted');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete execution:', err);
      setError('Failed to delete campaign. Please try again.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmId(null);
  };

  const filtered = campaigns.filter(c =>
    c.prompt.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase()) ||
    c.tone.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-full gradient-bg">
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3"
          >
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold">✓</span>
            </div>
            <p className="font-medium">{successMessage}</p>
          </motion.div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center">
              <History className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Campaign History</h1>
          </div>
          <p className="text-muted-foreground">View and manage your past AI-generated campaigns</p>
        </motion.div>

        {/* Search + filter */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search campaigns..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total Campaigns', value: campaigns.length, icon: '📊' },
            { label: 'Avg Confidence', value: campaigns.length > 0 ? `${Math.round(campaigns.reduce((a, c) => a + c.confidence, 0) / campaigns.length * 100)}%` : '0%', icon: '🎯' },
            { label: 'Categories', value: new Set(campaigns.map(c => c.category)).size, icon: '🏷️' },
          ].map((stat, i) => (
            <div key={i} className="card-glass rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground mt-4">Loading campaign history...</p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground mt-4">Loading campaign history...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="card-glass rounded-xl p-6 border border-destructive/20 bg-destructive/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-1">Error Loading History</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Campaign list */}
        {!loading && !error && (
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No campaigns found</p>
                <p className="text-sm mt-1">Try a different search or <Link to="/" className="text-primary hover:underline">create a new campaign</Link></p>
              </div>
            ) : (
              filtered.map((campaign, i) => (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.06 }}
                  className="card-glass rounded-xl p-4 group hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setSelectedExecutionId(campaign.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                        🕐 {formatDate(campaign.createdAt)}
                      </p>
                      <p className="text-sm font-medium text-foreground leading-relaxed mb-2 line-clamp-2">
                        "{campaign.prompt}"
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full">{campaign.category}</span>
                        <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">🎯 {Math.round(campaign.confidence * 100)}% confident</span>
                        <span className="text-xs bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full">Tone: {campaign.tone}</span>
                        <span className="text-xs bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full">CTA: {campaign.ctaType}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(campaign.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="text-center mt-8">
            <Link to="/" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold">
              + New Campaign
            </Link>
          </div>
        )}
      </div>

      {/* Campaign Detail Modal */}
      <CampaignDetailModal
        executionId={selectedExecutionId}
        onClose={() => setSelectedExecutionId(null)}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete this record?</h3>
            <p className="text-gray-600 mb-6">
              This will permanently delete the campaign execution and all associated data. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDeleteCancel}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
