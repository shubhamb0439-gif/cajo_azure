import { useState, useEffect } from 'react';
import { X, Camera, Package, CheckCircle, Wifi, WifiOff, Truck, Settings, PlayCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Device {
  id: string;
  device_serial_number: string;
  qr_code: string | null;
  status: string;
  customer_id: string;
}

interface DeviceStatusModalProps {
  onClose: () => void;
}

export default function DeviceStatusModal({ onClose }: DeviceStatusModalProps) {
  const { userProfile } = useAuth();
  const [step, setStep] = useState<'scan' | 'status'>('scan');
  const [manualInput, setManualInput] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isAdminOrUser = userProfile?.role === 'admin' || userProfile?.role === 'user';

  const clientStatusOptions = [
    { value: 'received', label: 'Received', icon: Package },
    { value: 'online', label: 'Online', icon: Wifi },
    { value: 'offline', label: 'Offline', icon: WifiOff },
  ];

  const adminStatusOptions = [
    { value: 'ready_for_dispatch', label: 'Ready for Dispatch', icon: Package },
    { value: 'dispatched', label: 'Dispatched', icon: Truck },
    { value: 'received', label: 'Received', icon: CheckCircle },
    { value: 'installed', label: 'Installed', icon: Settings },
    { value: 'online', label: 'Online', icon: Wifi },
    { value: 'offline', label: 'Offline', icon: WifiOff },
  ];

  const statusOptions = isAdminOrUser ? adminStatusOptions : clientStatusOptions;

  const handleScan = async (identifier: string) => {
    if (!identifier.trim()) return;

    setLoading(true);
    setError('');

    try {
      let query = supabase
        .from('devices')
        .select('*')
        .or(`qr_code.eq.${identifier},device_serial_number.eq.${identifier}`);

      if (userProfile?.customer_id) {
        query = query.eq('customer_id', userProfile.customer_id);
      }

      const { data, error: fetchError } = await query.maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        const message = userProfile?.customer_id
          ? 'Device not found or you do not have access to this device.'
          : 'Device not found. Please check the serial number or QR code.';
        setError(message);
        setLoading(false);
        return;
      }

      setSelectedDevice(data);
      setStep('status');
    } catch (err) {
      console.error('Error fetching device:', err);
      setError('Failed to find device. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleScan(manualInput.trim());
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedDevice || !selectedStatus) return;

    setLoading(true);
    setError('');

    try {
      const now = new Date().toISOString();
      const updates: any = {
        status: selectedStatus,
        updated_at: now,
      };

      switch (selectedStatus) {
        case 'ready_for_dispatch':
          updates.dispatch_ready_date = now;
          break;
        case 'dispatched':
          updates.dispatch_date = now;
          break;
        case 'received':
          updates.delivered_date = now;
          break;
        case 'installed':
          updates.installation_date = now;
          break;
        case 'online':
          updates.last_online_at = now;
          break;
      }

      const { error: updateError } = await supabase
        .from('devices')
        .update(updates)
        .eq('id', selectedDevice.id);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error updating device status:', err);
      setError(err.message || 'Failed to update device status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const option = statusOptions.find(opt => opt.value === status);
    return option ? option.icon : CheckCircle;
  };

  const StatusIcon = selectedStatus ? getStatusIcon(selectedStatus) : CheckCircle;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {step === 'scan' ? 'Scan Device' : 'Update Status'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                Status Updated Successfully!
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Device status has been updated to {selectedStatus}.
              </p>
            </div>
          ) : step === 'scan' ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Device Serial Number
                </label>
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Enter device serial number..."
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!manualInput.trim() || loading}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {loading ? 'Searching...' : 'Find Device'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Device Serial Number
                </p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {selectedDevice?.device_serial_number}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Current Status: <span className="font-medium capitalize">{selectedDevice?.status}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Update Status To
                </label>
                <div className="space-y-2">
                  {statusOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedStatus(option.value)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                          selectedStatus === option.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${
                          selectedStatus === option.value
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-slate-400'
                        }`} />
                        <span className={`font-medium ${
                          selectedStatus === option.value
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}>
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('scan');
                    setSelectedDevice(null);
                    setSelectedStatus('');
                    setManualInput('');
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleStatusUpdate}
                  disabled={!selectedStatus || loading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                >
                  {loading ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
