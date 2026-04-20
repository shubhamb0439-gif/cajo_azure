import { useState, useEffect } from 'react';
import { X, AlertCircle, Camera, Keyboard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import QRScanner from './QRScanner';

interface TicketFormProps {
  mode: 'raise' | 'close';
  onClose: () => void;
  onSuccess: () => void;
}

interface IssueType {
  id: string;
  drop_value: string;
}

interface Ticket {
  id: string;
  ticket_number: string;
  device_serial_number: string | null;
  ticket_type: string;
  priority: string;
  description: string | null;
  raised_at: string;
}

export default function TicketForm({ mode, onClose, onSuccess }: TicketFormProps) {
  const { userProfile } = useAuth();
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);
  const [selectedIssueType, setSelectedIssueType] = useState('');
  const [hasDevice, setHasDevice] = useState(false);
  const [deviceSerialNumber, setDeviceSerialNumber] = useState('');
  const [isDeviceOffline, setIsDeviceOffline] = useState(false);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [actionsBeforeOffline, setActionsBeforeOffline] = useState('');
  const [suspectedReason, setSuspectedReason] = useState('');
  const [actionsTakenToFix, setActionsTakenToFix] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [inputMethod, setInputMethod] = useState<'scan' | 'manual'>('scan');

  const [openTickets, setOpenTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    if (mode === 'raise') {
      fetchIssueTypes();
    } else {
      fetchOpenTickets();
    }
  }, [mode]);

  const fetchIssueTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('dropdown_values')
        .select('id, drop_value')
        .eq('drop_type', 'device_issue_type')
        .order('drop_value');

      if (error) throw error;
      setIssueTypes(data || []);
    } catch (err) {
      console.error('Error fetching issue types:', err);
    }
  };

  const fetchOpenTickets = async () => {
    if (!userProfile?.customer_id) return;

    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_number, device_serial_number, ticket_type, priority, description, raised_at')
        .eq('customer_id', userProfile.customer_id)
        .eq('status', 'open')
        .order('raised_at', { ascending: false });

      if (error) throw error;
      setOpenTickets(data || []);
    } catch (err) {
      console.error('Error fetching open tickets:', err);
    }
  };

  const handleQRScan = async (qrCode: string) => {
    setDeviceSerialNumber(qrCode);
    setShowQRScanner(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.customer_id) return;

    setLoading(true);
    setError(null);

    try {
      if (mode === 'raise') {
        let deviceId: string | null = null;
        let willAutoCreateTicket = false;

        if (hasDevice && deviceSerialNumber) {
          const { data: device } = await supabase
            .from('devices')
            .select('id, status')
            .eq('device_serial_number', deviceSerialNumber)
            .eq('customer_id', userProfile.customer_id)
            .maybeSingle();

          if (!device) {
            const { data: saleItem, error: saleError } = await supabase
              .from('sale_items')
              .select(`
                serial_number,
                sale_id,
                sales!inner(customer_id)
              `)
              .eq('serial_number', deviceSerialNumber)
              .eq('sales.customer_id', userProfile.customer_id)
              .maybeSingle();

            console.log('Sale item query result:', { saleItem, saleError, deviceSerialNumber, customerId: userProfile.customer_id });

            if (!saleItem) {
              setError('Device not found. Please check the serial number and try again.');
              setLoading(false);
              return;
            }
          } else {
            deviceId = device.id;

            if (isDeviceOffline && device.status !== 'offline') {
              willAutoCreateTicket = true;

              await supabase
                .from('devices')
                .update({ status: 'offline' })
                .eq('id', deviceId);

              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }

        if (willAutoCreateTicket) {
          const additionalInfo = [
            selectedIssueType ? `Issue Type: ${selectedIssueType}` : '',
            actionsBeforeOffline ? `Actions Before: ${actionsBeforeOffline}` : '',
            suspectedReason ? `Suspected Reason: ${suspectedReason}` : '',
            actionsTakenToFix ? `Actions Taken: ${actionsTakenToFix}` : '',
            description || ''
          ].filter(Boolean).join('\n\n');

          const { data: existingTicket } = await supabase
            .from('tickets')
            .select('id, description')
            .eq('device_id', deviceId)
            .eq('status', 'open')
            .eq('ticket_type', 'device_offline')
            .order('raised_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingTicket && additionalInfo.trim()) {
            const updatedDescription = existingTicket.description + '\n\n--- Additional Details ---\n' + additionalInfo;

            await supabase
              .from('tickets')
              .update({
                description: updatedDescription,
                priority: priority,
                device_serial_number: deviceSerialNumber
              })
              .eq('id', existingTicket.id);
          } else if (existingTicket && priority !== 'high') {
            await supabase
              .from('tickets')
              .update({
                priority: priority,
                device_serial_number: deviceSerialNumber
              })
              .eq('id', existingTicket.id);
          }
        } else {
          const ticketDescription = [
            selectedIssueType ? `Issue Type: ${selectedIssueType}` : '',
            hasDevice && isDeviceOffline ? 'Device Status: Offline' : hasDevice ? 'Device Status: Online' : '',
            actionsBeforeOffline ? `Actions Before: ${actionsBeforeOffline}` : '',
            suspectedReason ? `Suspected Reason: ${suspectedReason}` : '',
            actionsTakenToFix ? `Actions Taken: ${actionsTakenToFix}` : '',
            description || ''
          ].filter(Boolean).join('\n\n');

          const { error: ticketError } = await supabase.from('tickets').insert({
            device_id: deviceId,
            device_serial_number: hasDevice ? deviceSerialNumber : null,
            customer_id: userProfile.customer_id,
            ticket_type: hasDevice ? (selectedIssueType || 'device_issue') : 'general',
            status: 'open',
            priority,
            description: ticketDescription || 'Issue reported',
            is_device_online: hasDevice ? !isDeviceOffline : null,
            raised_by: userProfile.id,
          });

          if (ticketError) throw ticketError;
        }

      } else {
        if (!selectedTicketId) {
          setError('Please select a ticket to close.');
          setLoading(false);
          return;
        }

        const selectedTicket = openTickets.find(t => t.id === selectedTicketId);

        const { error: ticketError } = await supabase
          .from('tickets')
          .update({
            status: 'closed',
            closed_by: userProfile.id,
            closed_at: new Date().toISOString(),
            resolution_notes: resolutionNotes || 'Issue resolved',
          })
          .eq('id', selectedTicketId);

        if (ticketError) throw ticketError;

        if (selectedTicket?.device_serial_number) {
          const { data: device } = await supabase
            .from('devices')
            .select('id')
            .eq('device_serial_number', selectedTicket.device_serial_number)
            .eq('customer_id', userProfile.customer_id)
            .maybeSingle();

          if (device) {
            await supabase
              .from('devices')
              .update({
                status: 'online',
                last_online_at: new Date().toISOString(),
              })
              .eq('id', device.id);
          }
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error submitting ticket:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit ticket');
    } finally {
      setLoading(false);
    }
  };

  if (showQRScanner) {
    return (
      <QRScanner
        mode="offline"
        onScan={handleQRScan}
        onClose={() => setShowQRScanner(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-start justify-center p-2 md:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full my-2 md:my-8">
        <div className="flex items-center justify-between p-3 md:p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {mode === 'raise' ? 'Raise Ticket' : 'Close Ticket'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
          {mode === 'raise' ? (
            <>
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                <input
                  type="checkbox"
                  id="hasDevice"
                  checked={hasDevice}
                  onChange={(e) => {
                    setHasDevice(e.target.checked);
                    if (!e.target.checked) {
                      setDeviceSerialNumber('');
                      setIsDeviceOffline(false);
                    }
                  }}
                  className="w-4 h-4 text-blue-600 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="hasDevice" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  This ticket is for a specific device
                </label>
              </div>

              {hasDevice && (
                <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setInputMethod('scan')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        inputMethod === 'scan'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      <Camera className="w-4 h-4" />
                      Scan QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMethod('manual')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        inputMethod === 'manual'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      <Keyboard className="w-4 h-4" />
                      Enter Manually
                    </button>
                  </div>

                  {inputMethod === 'scan' ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowQRScanner(true)}
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Camera className="w-5 h-5" />
                        Open QR Scanner
                      </button>
                      {deviceSerialNumber && (
                        <div className="mt-2 text-sm text-green-600 dark:text-green-400">
                          Device scanned: {deviceSerialNumber}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Device Serial Number <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={deviceSerialNumber}
                        onChange={(e) => setDeviceSerialNumber(e.target.value)}
                        placeholder="Enter device serial number"
                        required={hasDevice}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg">
                    <input
                      type="checkbox"
                      id="deviceOffline"
                      checked={isDeviceOffline}
                      onChange={(e) => setIsDeviceOffline(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="deviceOffline" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      Device is currently offline
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {hasDevice ? 'Type of Issue' : 'Type of Request'} <span className="text-red-600">*</span>
                </label>
                <select
                  value={selectedIssueType}
                  onChange={(e) => setSelectedIssueType(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  required
                >
                  <option value="">Select {hasDevice ? 'issue' : 'request'} type...</option>
                  {issueTypes.map((type) => (
                    <option key={type.id} value={type.drop_value}>
                      {type.drop_value}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {hasDevice && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Actions Before Issue (Optional)
                    </label>
                    <textarea
                      value={actionsBeforeOffline}
                      onChange={(e) => setActionsBeforeOffline(e.target.value)}
                      placeholder="What actions were taken before the issue occurred?"
                      rows={2}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Suspected Reason (Optional)
                    </label>
                    <textarea
                      value={suspectedReason}
                      onChange={(e) => setSuspectedReason(e.target.value)}
                      placeholder="What do you think caused the issue?"
                      rows={2}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Actions Taken to Fix (Optional)
                    </label>
                    <textarea
                      value={actionsTakenToFix}
                      onChange={(e) => setActionsTakenToFix(e.target.value)}
                      placeholder="What steps have you taken to try to fix the issue?"
                      rows={2}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Additional Details (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Any additional information..."
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Select Ticket to Close <span className="text-red-600">*</span>
                </label>
                <select
                  value={selectedTicketId}
                  onChange={(e) => setSelectedTicketId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  required
                >
                  <option value="">Select a ticket...</option>
                  {openTickets.map((ticket) => (
                    <option key={ticket.id} value={ticket.id}>
                      {ticket.ticket_number} - {ticket.device_serial_number || 'General'} - {ticket.ticket_type} ({ticket.priority})
                    </option>
                  ))}
                </select>
                {openTickets.length === 0 && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    No open tickets found.
                  </p>
                )}
              </div>

              {selectedTicketId && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                  {(() => {
                    const ticket = openTickets.find(t => t.id === selectedTicketId);
                    if (!ticket) return null;
                    return (
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium text-slate-700 dark:text-slate-300">Device:</span>
                          <span className="ml-2 text-slate-900 dark:text-white">
                            {ticket.device_serial_number || 'General Ticket'}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-700 dark:text-slate-300">Raised:</span>
                          <span className="ml-2 text-slate-900 dark:text-white">
                            {new Date(ticket.raised_at).toLocaleString('en-IN')}
                          </span>
                        </div>
                        {ticket.description && (
                          <div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">Description:</span>
                            <p className="mt-1 text-slate-900 dark:text-white whitespace-pre-wrap">
                              {ticket.description}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Resolution Notes (Optional)
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add any notes about the resolution..."
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none"
                />
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (mode === 'raise' && !selectedIssueType) || (mode === 'close' && !selectedTicketId)}
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                mode === 'raise'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {loading ? 'Submitting...' : mode === 'raise' ? 'Raise Ticket' : 'Close Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
