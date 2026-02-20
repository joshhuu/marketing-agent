import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertCircle, Clock, TrendingUp, Download, FileJson, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

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

// Helper function to convert UTC to IST
const formatToIST = (utcDateString: string): string => {
  const date = new Date(utcDateString);
  // Convert to IST (UTC+5:30)
  const istOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };
  return date.toLocaleString('en-IN', istOptions);
};

const AdminAnalyticsPage = () => {
  const { userRole } = useAuth();
  const [stats, setStats] = useState<APIStat | null>(null);
  const [logs, setLogs] = useState<APILog[]>([]);
  const [promptLogs, setPromptLogs] = useState<APILog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: "csv" | "json", promptsOnly: boolean = false) => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        format,
        prompts_only: promptsOnly.toString()
      });
      
      const response = await fetch(`http://localhost:8000/admin/api-calls/export?${params}`, {
        headers: {
          "X-User-Role": userRole || "admin",
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `api_logs_${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Failed to export logs:", error);
    } finally {
      setExporting(false);
    }
  };

  const fetchAPILogs = async () => {
    try {
      // Fetch all API calls for the table
      const response = await fetch("http://localhost:8000/admin/api-calls?limit=20", {
        headers: {
          "X-User-Role": userRole || "admin",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.statistics);
        setLogs(data.logs);
        setLastUpdate(new Date().toLocaleTimeString('en-IN', { 
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }));
      }

      // Fetch prompt logs separately (won't get pushed out by other API calls)
      const promptResponse = await fetch("http://localhost:8000/admin/api-calls?limit=50&prompts_only=true", {
        headers: {
          "X-User-Role": userRole || "admin",
        },
      });

      if (promptResponse.ok) {
        const promptData = await promptResponse.json();
        setPromptLogs(promptData.logs);
      }
    } catch (error) {
      console.error("Failed to fetch API logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchAPILogs();

    // Set up auto-refresh every 5 seconds
    const intervalId = setInterval(() => {
      fetchAPILogs();
    }, 5000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [userRole]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Loading analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">System Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor API usage, performance metrics, and system health
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdate && (
            <div className="text-sm text-gray-500">
              Last updated: <span className="font-semibold">{lastUpdate} IST</span>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => handleExport("csv", false)}
              disabled={exporting}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export CSV
            </Button>
            <Button
              onClick={() => handleExport("json", false)}
              disabled={exporting}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <FileJson className="w-4 h-4" />
              Export JSON
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_calls.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avg_response_time_ms.toFixed(0) || 0}ms</div>
            <p className="text-xs text-muted-foreground">Average latency</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.success_rate.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">Successful requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Count</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.error_count || 0}</div>
            <p className="text-xs text-muted-foreground">Failed requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent API Calls Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent API Calls</CardTitle>
          <CardDescription>Last 20 API requests to the system (Indian Standard Time)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Endpoint</th>
                  <th className="text-left p-2">Method</th>
                  <th className="text-left p-2">Role</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-right p-2">Response Time</th>
                  <th className="text-left p-2 min-w-[180px]">Time (IST)</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="p-2 font-mono text-sm">{log.endpoint}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          log.method === "GET"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : log.method === "POST"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : log.method === "DELETE"
                                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                        }`}
                      >
                        {log.method}
                      </span>
                    </td>
                    <td className="p-2">
                      <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        {log.user_role}
                      </span>
                    </td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          log.status_code >= 200 && log.status_code < 300
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : log.status_code >= 400
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                        }`}
                      >
                        {log.status_code}
                      </span>
                    </td>
                    <td className="p-2 text-right font-mono text-sm">
                      {log.response_time_ms.toFixed(0)}ms
                    </td>
                    <td className="p-2 text-sm text-gray-600 dark:text-gray-400">
                      {formatToIST(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Prompt Logs Section */}
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Prompt Logs</CardTitle>
              <CardDescription>AI prompts sent to the system for campaign generation</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleExport("csv", true)}
                disabled={exporting}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export Prompts CSV
              </Button>
              <Button
                onClick={() => handleExport("json", true)}
                disabled={exporting}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export Prompts JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {promptLogs.length > 0 ? (
              promptLogs.map((log) => (
                  <div
                    key={log.id}
                    className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-primary">
                          {log.endpoint}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            log.method === "POST"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          }`}
                        >
                          {log.method}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          {log.user_role}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatToIST(log.created_at)}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded p-3 border border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                        {log.prompt_preview}
                      </p>
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No prompts logged yet</p>
                <p className="text-xs mt-2">Prompts will appear here when campaigns are executed</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAnalyticsPage;
