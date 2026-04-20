import { useState, useEffect } from 'react';
import { X, Send, Bug, Sparkles, AlertCircle, CheckCircle, Clock, XCircle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ReportsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

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
  users?: {
    name: string;
  };
}

const SYSTEM_LOCATIONS = [
  'Dashboard',
  'Sales - Leads',
  'Sales - Prospects',
  'Sales - Customers',
  'Sales - Orders',
  'Sales - Sales',
  'Sales - Deliveries',
  'Inventory - Vendors',
  'Inventory - Items',
  'Inventory - Purchases',
  'Manufacturing - BOM Builder',
  'Manufacturing - Assembly',
  'Manufacturing - Traceability',
  'Support',
  'Activity Log',
  'Settings - User Management',
  'Settings - Data Setup',
  'Settings - Bulk Upload',
  'Settings - Messages',
  'Settings - Danger Zone',
  'Other',
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

export default function ReportsPanel({ isOpen, onClose }: ReportsPanelProps) {
  const { userProfile } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<SystemRequest[]>([]);
  const [formData, setFormData] = useState({
    type: 'bug' as 'bug' | 'feature',
    location: '',
    description: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchRequests();
    }
  }, [isOpen]);

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
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !formData.location || !formData.description.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('system_requests')
        .insert({
          type: formData.type,
          location: formData.location,
          description: formData.description.trim(),
          created_by: userProfile.id,
        });

      if (error) throw error;

      setFormData({ type: 'bug', location: '', description: '' });
      setShowForm(false);
      fetchRequests();
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (requestId: string) => {
    if (!confirm('Are you sure you want to cancel this request?')) return;

    try {
      const { error } = await supabase
        .from('system_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      fetchRequests();
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

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/50 z-[80]"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 bottom-0 w-full md:w-[600px] bg-white dark:bg-slate-800 shadow-xl z-[90] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            System Reports & Requests
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!showForm ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setFormData({ ...formData, type: 'bug' });
                    setShowForm(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <Bug className="w-5 h-5" />
                  Report Bug
                </button>
                <button
                  onClick={() => {
                    setFormData({ ...formData, type: 'feature' });
                    setShowForm(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <Sparkles className="w-5 h-5" />
                  Request Feature
                </button>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  All Requests ({requests.length})
                </h3>
                <div className="space-y-3">
                  {requests.map((request) => {
                    const StatusIcon = STATUS_ICONS[request.status] || AlertCircle;
                    const daysSinceNew = calculateDaysSinceNew(request);

                    return (
                      <div
                        key={request.id}
                        className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {request.type === 'bug' ? (
                              <Bug className="w-4 h-4 text-red-600 dark:text-red-400" />
                            ) : (
                              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            )}
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {request.type === 'bug' ? 'Bug Report' : 'Feature Request'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${STATUS_COLORS[request.status]}`}>
                              <StatusIcon className="w-3 h-3" />
                              {request.status}
                            </span>
                            {userProfile && request.created_by === userProfile.id && (
                              <button
                                onClick={() => handleDelete(request.id)}
                                className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Cancel request"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          <span className="font-medium">Location:</span> {request.location}
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                          {request.description}
                        </p>
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>
                            By {request.users?.name} on {new Date(request.created_at).toLocaleDateString()}
                          </span>
                          {daysSinceNew !== null && (
                            <span className="font-medium">
                              {daysSinceNew} {daysSinceNew === 1 ? 'day' : 'days'} to {request.status.toLowerCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {requests.length === 0 && (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                      No requests yet. Be the first to report a bug or request a feature!
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Request Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'bug' | 'feature' })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  required
                >
                  <option value="bug">Report Bug</option>
                  <option value="feature">Request New Feature/Function</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Location in System
                </label>
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  required
                >
                  <option value="">Select where in the system...</option>
                  {SYSTEM_LOCATIONS.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={6}
                  placeholder="Please describe the issue or feature request in detail..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white resize-none"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ type: 'bug', location: '', description: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  <Send className="w-4 h-4" />
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
