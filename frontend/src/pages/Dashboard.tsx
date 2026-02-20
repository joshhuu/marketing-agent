import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, Users, Zap, Target, ArrowRight, 
  Mail, Phone, Linkedin, Calendar 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  totalCampaigns: number;
  totalProspects: number;
  avgConfidence: number;
  recentActivity: number;
}

interface ChannelData {
  name: string;
  value: number;
  icon: string;
}

interface UrgencyData {
  name: string;
  count: number;
}

interface CampaignTrend {
  date: string;
  campaigns: number;
}

const COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b', '#10b981'];

export default function Dashboard() {
  const { userRole } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalCampaigns: 0,
    totalProspects: 0,
    avgConfidence: 0,
    recentActivity: 0
  });
  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [urgencyData, setUrgencyData] = useState<UrgencyData[]>([]);
  const [campaignTrends, setCampaignTrends] = useState<CampaignTrend[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const canCreateCampaign = userRole === 'admin' || userRole === 'user';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch execution history
      const history = await ApiClient.getExecutionHistory(100);
      
      // Fetch prospects data
      const prospectsResponse = await ApiClient.getRecentCampaignProspects(1, 10);
      
      // Calculate stats
      const totalCampaigns = history.length;
      const totalProspects = prospectsResponse.total || 0;
      const avgConfidence = history.length > 0
        ? history.reduce((sum, h) => sum + h.confidence, 0) / history.length
        : 0;
      
      // Recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentActivity = history.filter(h => 
        new Date(h.created_at) > sevenDaysAgo
      ).length;
      
      setStats({
        totalCampaigns,
        totalProspects,
        avgConfidence,
        recentActivity
      });
      
      // Recent campaigns for the list
      setRecentCampaigns(history.slice(0, 5));
      
      // Process channel distribution (mock data based on categories)
      const channelCounts: Record<string, number> = {};
      for (const campaign of history) {
        // In real scenario, get from execution details
        // For now, distribute across channels based on category
        const channel = getChannelFromCategory(campaign.category);
        channelCounts[channel] = (channelCounts[channel] || 0) + 1;
      }
      
      const channels: ChannelData[] = Object.entries(channelCounts).map(([name, value]) => ({
        name,
        value,
        icon: getChannelIcon(name)
      }));
      
      setChannelData(channels);
      
      // Process urgency distribution
      const urgencyCounts: Record<string, number> = {
        high: 0,
        medium: 0,
        low: 0
      };
      
      for (const campaign of history) {
        const urgency = campaign.urgency_level || 'medium';
        urgencyCounts[urgency] = (urgencyCounts[urgency] || 0) + 1;
      }
      
      const urgency: UrgencyData[] = Object.entries(urgencyCounts).map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count
      }));
      
      setUrgencyData(urgency);
      
      // Campaign trends (last 30 days)
      const trends = generateTrendData(history);
      setCampaignTrends(trends);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTrendData = (history: any[]): CampaignTrend[] => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date;
    });
    
    return last30Days.map(date => {
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const campaigns = history.filter(h => {
        const campaignDate = new Date(h.created_at);
        return campaignDate.toDateString() === date.toDateString();
      }).length;
      
      return { date: dateStr, campaigns };
    });
  };

  const getChannelFromCategory = (category: string): string => {
    if (category.includes('lead_gen')) return 'LinkedIn';
    if (category.includes('retention')) return 'Email';
    if (category.includes('urgent')) return 'Phone';
    return 'Email';
  };

  const getChannelIcon = (channel: string): string => {
    const icons: Record<string, string> = {
      'LinkedIn': 'linkedin',
      'Email': 'mail',
      'Phone': 'phone',
    };
    return icons[channel] || 'mail';
  };

  const StatCard = ({ icon: Icon, label, value, trend, color }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium mb-1">{label}</p>
          <h3 className="text-3xl font-bold text-foreground">{value}</h3>
          {trend && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {trend}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </motion.div>
  );

  const ChannelIcon = ({ name }: { name: string }) => {
    if (name === 'LinkedIn') return <Linkedin className="w-4 h-4" />;
    if (name === 'Email') return <Mail className="w-4 h-4" />;
    if (name === 'Phone') return <Phone className="w-4 h-4" />;
    return <Mail className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-bg min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of your marketing campaigns and performance metrics
            </p>
          </div>
          {canCreateCampaign && (
            <Link 
              to="/campaign"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              <Zap className="w-4 h-4" />
              New Campaign
            </Link>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={Zap}
            label="Total Campaigns"
            value={stats.totalCampaigns}
            trend={stats.recentActivity > 0 ? `${stats.recentActivity} this week` : null}
            color="bg-gradient-to-br from-violet-500 to-purple-600"
          />
          <StatCard
            icon={Users}
            label="Total Prospects"
            value={stats.totalProspects.toLocaleString()}
            color="bg-gradient-to-br from-pink-500 to-rose-600"
          />
          <StatCard
            icon={Target}
            label="Avg Confidence"
            value={`${(stats.avgConfidence * 100).toFixed(1)}%`}
            color="bg-gradient-to-br from-cyan-500 to-blue-600"
          />
          <StatCard
            icon={TrendingUp}
            label="Recent Activity"
            value={stats.recentActivity}
            trend="Last 7 days"
            color="bg-gradient-to-br from-amber-500 to-orange-600"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Campaign Trends */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl border border-border p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-foreground mb-4">Campaign Activity</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={campaignTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="campaigns" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Channel Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl border border-border p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-foreground mb-4">Channel Distribution</h3>
            {channelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No campaign data yet
              </div>
            )}
          </motion.div>

          {/* Urgency Levels */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-xl border border-border p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-foreground mb-4">Urgency Levels</h3>
            {urgencyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={urgencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No urgency data yet
              </div>
            )}
          </motion.div>

          {/* Recent Campaigns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card rounded-xl border border-border p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Recent Campaigns</h3>
              <Link 
                to="/history" 
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View All
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {recentCampaigns.length > 0 ? (
                recentCampaigns.map((campaign, idx) => (
                  <div
                    key={campaign.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {campaign.category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(campaign.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <div className={`w-2 h-2 rounded-full ${
                        campaign.urgency_level === 'high' 
                          ? 'bg-red-500' 
                          : campaign.urgency_level === 'low'
                          ? 'bg-green-500'
                          : 'bg-yellow-500'
                      }`} />
                      <span className="text-muted-foreground capitalize">
                        {campaign.urgency_level || 'medium'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                  <Zap className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No campaigns yet</p>
                  {canCreateCampaign && (
                    <Link 
                      to="/campaign" 
                      className="text-xs text-primary hover:underline mt-2"
                    >
                      Create your first campaign
                    </Link>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        {canCreateCampaign && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-xl p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Ready to launch your next campaign?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Let AI agents handle prospect research, content creation, and platform selection
                </p>
              </div>
              <Link
                to="/campaign"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-lg"
              >
                <Zap className="w-4 h-4" />
                Create Campaign
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
