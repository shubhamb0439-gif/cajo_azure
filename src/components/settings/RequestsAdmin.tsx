import { useState, useEffect } from 'react';
import { Bug, Sparkles, Trash2, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface SystemRequest {
  id: string;
  type: 'bug' | 'feature';
  location: string;
  description: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  status_changed_at: string;
  status_changed_by: string | null;
  users?: {
    name: string;
  };
}

const STATUS_OPTIONS = [
  'New',
  'Received',
  'Under Review',
  'Rejected',
  'Accepted',
  'Under Development',
  'Deployed',
];

const STATUS_COLORS: Record<string, string> = {
  'New': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Received': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Under Review': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Rejected': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'Accepted': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Under Development': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  'Deployed': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const STATUS_ICONS: Record<string, any> = {
  'New': AlertCircle,
  'Received': Clock,
  'Under Review': Clock,
  'Rejected': XCircle,
  'Accepted': CheckCircle,
  'Under Development': Clock,
  'Deployed': CheckCircle,
};

export default function RequestsAdmin() {
  const { userProfile } = useAuth();
  const [requests, setRequests] = useState<SystemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'bug' | 'feature'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('system_requests_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_requests' },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('system_requests')
        .select(`
          *,
          users:created_by (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (requestId: string, newStatus: string) => {
    if (!userProfile) return;

    try {
      const { error } = await supabase
        .from('system_requests')
        .update({
          status: newStatus,
          status_changed_by: userProfile.id,
        })
        .eq('id', requestId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  const deleteRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this request?')) return;

    try {
      const { error } = await supabase
        .from('system_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting request:', error);
      alert('Failed to delete request. Please try again.');
    }
  };

  const calculateDaysSinceNew = (request: SystemRequest) => {
    if (request.status === 'Rejected' || request.status === 'Deployed') {
      const start = new Date(request.created_at);
      const end = new Date(request.status_changed_at);
      const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return days;
    }
    return null;
  };

  const filteredRequests = requests.filter((request) => {
    if (filterType !== 'all' && request.type !== filterType) return false;
    if (filterStatus !== 'all' && request.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: requests.length,
    bugs: requests.filter((r) => r.type === 'bug').length,
    features: requests.filter((r) => r.type === 'feature').length,
    new: requests.filter((r) => r.status === 'New').length,
    inProgress: requests.filter((r) => ['Received', 'Under Review', 'Accepted', 'Under Development'].includes(r.status)).length,
    completed: requests.filter((r) => r.status === 'Deployed').length,
    rejected: requests.filter((r) => r.status === 'Rejected').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500 dark:text-slate-400">Loading requests...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
          System Requests Management
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Review and manage bug reports and feature requests from users
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-lg">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
          <div className="text-xs text-slate-600 dark:text-slate-400">Total</div>
        </div>
        <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
          <div className="text-2xl font-bold text-red-900 dark:text-red-300">{stats.bugs}</div>
          <div className="text-xs text-red-700 dark:text-red-400">Bugs</div>
        </div>
        <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">{stats.features}</div>
          <div className="text-xs text-blue-700 dark:text-blue-400">Features</div>
        </div>
        <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
          <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-300">{stats.new}</div>
          <div className="text-xs text-yellow-700 dark:text-yellow-400">New</div>
        </div>
        <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
          <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-300">{stats.inProgress}</div>
          <div className="text-xs text-indigo-700 dark:text-indigo-400">In Progress</div>
        </div>
        <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
          <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">{stats.completed}</div>
          <div className="text-xs text-emerald-700 dark:text-emerald-400">Deployed</div>
        </div>
        <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
          <div className="text-2xl font-bold text-red-900 dark:text-red-300">{stats.rejected}</div>
          <div className="text-xs text-red-700 dark:text-red-400">Rejected</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as 'all' | 'bug' | 'feature')}
          className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
        >
          <option value="all">All Types</option>
          <option value="bug">Bugs Only</option>
          <option value="feature">Features Only</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Location
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Created By
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Days
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  No requests found
                </td>
              </tr>
            ) : (
              filteredRequests.map((request) => {
                const StatusIcon = STATUS_ICONS[request.status] || AlertCircle;
                const daysSinceNew = calculateDaysSinceNew(request);

                return (
                  <tr key={request.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {request.type === 'bug' ? (
                          <Bug className="w-4 h-4 text-red-600 dark:text-red-400" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        )}
                        <span className="text-sm text-slate-900 dark:text-white capitalize">
                          {request.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-900 dark:text-white">
                        {request.location}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs">
                        <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                          {request.description}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <select
                        value={request.status}
                        onChange={(e) => updateStatus(request.id, e.target.value)}
                        className={`px-2 py-1 text-xs font-medium rounded-full border-0 ${STATUS_COLORS[request.status]}`}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-slate-900 dark:text-white">
                        {request.users?.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {new Date(request.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {daysSinceNew !== null && (
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {daysSinceNew} {daysSinceNew === 1 ? 'day' : 'days'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => deleteRequest(request.id)}
                        className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Delete request"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
