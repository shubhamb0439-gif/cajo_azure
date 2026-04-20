import { useState, useEffect } from 'react';
import { X, Camera, Keyboard, Clock, Calendar, Wifi, WifiOff, TrendingUp, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import QRScanner from './QRScanner';

interface Device {
  id: string;
  device_serial_number: string;
  status: string;
  location: string | null;
  installed_date: string | null;
  last_online_at: string | null;
  total_online_minutes: number | null;
  total_offline_minutes: number | null;
  last_status_change_at: string | null;
  current_offline_start: string | null;
  customer_id: string;
}

interface Ticket {
  id: string;
  ticket_number: string;
  ticket_type: string;
  status: string;
  priority: string;
  description: string | null;
  raised_at: string;
  closed_at: string | null;
  is_device_online: boolean | null;
}

interface DeviceSupportHistoryModalProps {
  onClose: () => void;
  device?: Device | null;
}

export default function DeviceSupportHistoryModal({ onClose, device }: DeviceSupportHistoryModalProps) {
  const { userProfile } = useAuth();
  const [step, setStep] = useState<'scan' | 'history'>(device ? 'history' : 'scan');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(device || null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (device) {
      loadTicketsForDevice(device.id);
    }
  }, [device]);

  const loadTicketsForDevice = async (deviceId: string) => {
    try {
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('*')
        .eq('device_id', deviceId)
        .order('raised_at', { ascending: false });

      if (ticketsError) throw ticketsError;
      setTickets(ticketsData || []);
    } catch (err) {
      console.error('Error loading tickets:', err);
    }
  };

  const handleQRScan = async (qrCode: string) => {
    setShowQRScanner(false);
    setManualInput(qrCode);
    await handleScan(qrCode);
  };

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

      const { data: deviceData, error: fetchError } = await query.maybeSingle();

      if (fetchError) {
        console.error('Device fetch error:', fetchError);
        throw fetchError;
      }

      if (!deviceData) {
        const message = userProfile?.customer_id
          ? 'Device not found or you do not have access to this device.'
          : 'Device not found. Please check the serial number or QR code.';
        setError(message);
        setLoading(false);
        return;
      }

      setSelectedDevice(deviceData);

      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('*')
        .eq('device_id', deviceData.id)
        .order('raised_at', { ascending: false });

      if (ticketsError) {
        console.error('Tickets fetch error:', ticketsError);
        throw ticketsError;
      }

      setTickets(ticketsData || []);
      setStep('history');
    } catch (err: any) {
      console.error('Error fetching device:', err);
      setError(err?.message || 'Failed to find device. Please try again.');
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

  const formatUptime = (minutes: number | null) => {
    if (!minutes) return '0m';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  const calculateCurrentUptime = () => {
    if (!selectedDevice?.last_status_change_at) {
      return { time: '0m', isOnline: selectedDevice?.status === 'online' };
    }
    const start = new Date(selectedDevice.last_status_change_at);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - start.getTime()) / (1000 * 60));
    return {
      time: formatUptime(diffMinutes),
      isOnline: selectedDevice.status === 'online'
    };
  };

  if (showQRScanner) {
    return (
      <QRScanner
        onScan={handleQRScan}
        onClose={() => setShowQRScanner(false)}
        title="Scan Device QR Code"
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-start justify-center p-2 md:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-3xl w-full my-2 md:my-8">
        <div className="flex items-center justify-between p-3 md:p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {step === 'scan' ? 'Device Support History' : `History: ${selectedDevice?.device_serial_number}`}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <div className="p-4 md:p-6">
          {step === 'scan' ? (
            <div className="space-y-4">
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Device Serial Number
                  </label>
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Enter device serial number or scan QR code..."
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!manualInput.trim() || loading}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    {loading ? 'Searching...' : 'View History'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQRScanner(true)}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    Scan
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {calculateCurrentUptime().isOnline ? (
                      <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {calculateCurrentUptime().isOnline ? 'Online for' : 'Offline for'}
                    </p>
                  </div>
                  <p className={`text-2xl font-bold ${
                    calculateCurrentUptime().isOnline
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {calculateCurrentUptime().time}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Status: <span className={`font-medium capitalize ${
                      selectedDevice?.status === 'online' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {selectedDevice?.status}
                    </span>
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Lifetime Uptime
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatUptime(selectedDevice?.total_online_minutes || 0)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Total online time
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Lifetime Downtime
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {formatUptime(selectedDevice?.total_offline_minutes || 0)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Total offline time
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Installed Date
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {selectedDevice?.installed_date
                      ? new Date(selectedDevice.installed_date).toLocaleDateString('en-IN')
                      : 'Not installed'
                    }
                  </p>
                  {selectedDevice?.location && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {selectedDevice.location}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Support Ticket History
                </h3>

                {tickets.length === 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-8 text-center">
                    <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 dark:text-slate-400">
                      No support tickets found for this device
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {tickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className={`border rounded-lg p-4 ${
                          ticket.status === 'open'
                            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30'
                            : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900 dark:text-white">
                              {ticket.ticket_number}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              ticket.status === 'open'
                                ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                                : 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                            }`}>
                              {ticket.status}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              ticket.priority === 'critical'
                                ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                                : ticket.priority === 'high'
                                ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400'
                                : ticket.priority === 'medium'
                                ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400'
                                : 'bg-slate-100 dark:bg-slate-900/20 text-slate-800 dark:text-slate-400'
                            }`}>
                              {ticket.priority}
                            </span>
                          </div>
                          {ticket.is_device_online !== null && (
                            ticket.is_device_online ? (
                              <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
                            )
                          )}
                        </div>

                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 capitalize">
                          {ticket.ticket_type.replace(/_/g, ' ')}
                        </p>

                        {ticket.description && (
                          <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 line-clamp-2">
                            {ticket.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Raised: {new Date(ticket.raised_at).toLocaleString('en-IN', {
                              dateStyle: 'short',
                              timeStyle: 'short'
                            })}
                          </div>
                          {ticket.closed_at && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Closed: {new Date(ticket.closed_at).toLocaleString('en-IN', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('scan');
                    setSelectedDevice(null);
                    setTickets([]);
                    setManualInput('');
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Scan Another Device
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
