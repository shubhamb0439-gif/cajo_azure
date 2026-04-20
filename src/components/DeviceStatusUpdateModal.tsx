import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Warehouse, Truck, MapPin, Settings, Wifi, WifiOff, CheckCircle, XCircle } from 'lucide-react';

interface Device {
  id: string;
  device_serial_number: string;
  status: string;
  location: string | null;
  customer_id: string;
}

interface DeviceStatusUpdateModalProps {
  device: Device;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeviceStatusUpdateModal({ device, onClose, onSuccess }: DeviceStatusUpdateModalProps) {
  const { userProfile } = useAuth();
  const [newStatus, setNewStatus] = useState(device.status);
  const [location, setLocation] = useState(device.location || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusOptions = [
    { value: 'ready_for_dispatch', label: 'Ready for Dispatch', icon: Warehouse, color: 'bg-blue-500' },
    { value: 'dispatched', label: 'Dispatched', icon: Truck, color: 'bg-purple-500' },
    { value: 'delivered', label: 'Delivered', icon: MapPin, color: 'bg-orange-500' },
    { value: 'online', label: 'Online', icon: Wifi, color: 'bg-green-500' },
    { value: 'offline', label: 'Offline', icon: WifiOff, color: 'bg-red-500' },
  ];

  const handleStatusUpdate = async () => {
    if (newStatus === device.status) {
      setError('Device is already in this status');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const updateData: any = {
        status: newStatus,
        location: location || null,
        updated_at: now,
      };

      switch (newStatus) {
        case 'ready_for_dispatch':
          updateData.dispatch_ready_date = now;
          break;
        case 'dispatched':
          updateData.dispatch_date = now;
          break;
        case 'delivered':
          updateData.delivered_date = now;
          break;
        case 'installed':
          updateData.installed_date = now;
          break;
        case 'online':
          updateData.last_online_at = now;
          break;
      }

      const { error: updateError } = await supabase
        .from('devices')
        .update(updateData)
        .eq('id', device.id);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from('device_history')
        .insert({
          device_id: device.id,
          status: newStatus,
          changed_by: userProfile?.id,
          notes: `Status updated to ${newStatus} by ${userProfile?.full_name || 'user'}`,
          location: location || null,
        });

      if (historyError) throw historyError;

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Update Device Status</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm text-slate-500 dark:text-slate-400">Serial Number</label>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {device.device_serial_number}
            </p>
          </div>

          <div>
            <label className="text-sm text-slate-500 dark:text-slate-400">Current Status</label>
            <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">
              {device.status.replace(/_/g, ' ')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              New Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setNewStatus(option.value)}
                    className={`flex flex-col items-center justify-center gap-2 px-3 py-3 rounded-lg border-2 transition-all ${
                      newStatus === option.value
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <div className={`p-2 rounded-full ${option.color}`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs font-medium text-slate-900 dark:text-white text-center">
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Location (Optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Warehouse A, Customer Site"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStatusUpdate}
              disabled={loading || newStatus === device.status}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                'Updating...'
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Update Status
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
