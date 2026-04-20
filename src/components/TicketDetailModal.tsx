import { X, CheckCircle, Calendar, User, AlertCircle, Send, MessageSquare } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Ticket {
  id: string;
  ticket_number: string;
  ticket_type: string;
  description: string;
  status: string;
  priority: string;
  customer_id: string;
  device_id: string | null;
  device_serial_number: string | null;
  is_device_online: boolean | null;
  raised_at: string;
  closed_at: string | null;
  actions_before_offline: string | null;
  suspected_reason: string | null;
  actions_taken_to_fix: string | null;
  resolution_notes: string | null;
  customers?: {
    customer_name: string;
  };
  devices?: {
    device_serial_number: string;
    location: string | null;
    status: string;
  };
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  users?: {
    name: string;
    role: string;
  };
}

interface TicketDetailModalProps {
  ticket: Ticket;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TicketDetailModal({ ticket, onClose, onUpdate }: TicketDetailModalProps) {
  const { userProfile } = useAuth();
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    markAsRead();
    const cleanup = subscribeToMessages();
    return cleanup;
  }, [ticket.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('ticket_messages')
      .select('*, users(name, role)')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    setMessages(data as TicketMessage[] || []);
  };

  const markAsRead = async () => {
    if (!userProfile) {
      console.log('TicketDetailModal: No user profile, cannot mark as read');
      return;
    }

    const now = new Date().toISOString();
    console.log('TicketDetailModal: Attempting to mark ticket as read', {
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      userId: userProfile.id,
      userRole: userProfile.role
    });

    const { data: existingRead, error: selectError } = await supabase
      .from('ticket_message_reads')
      .select('id, last_read_at')
      .eq('ticket_id', ticket.id)
      .eq('user_id', userProfile.id)
      .maybeSingle();

    if (selectError) {
      console.error('TicketDetailModal: Error reading ticket status:', selectError);
      return;
    }

    if (existingRead) {
      console.log('TicketDetailModal: Updating existing read record', existingRead);
      const { error: updateError } = await supabase
        .from('ticket_message_reads')
        .update({ last_read_at: now })
        .eq('id', existingRead.id);

      if (updateError) {
        console.error('TicketDetailModal: Error updating ticket read status:', updateError);
      } else {
        console.log('TicketDetailModal: Successfully updated read status');
        onUpdate();
      }
    } else {
      console.log('TicketDetailModal: Creating new read record');
      const { error: insertError } = await supabase
        .from('ticket_message_reads')
        .insert({
          ticket_id: ticket.id,
          user_id: userProfile.id,
          last_read_at: now,
        });

      if (insertError) {
        console.error('TicketDetailModal: Error creating ticket read status:', insertError);
      } else {
        console.log('TicketDetailModal: Successfully created read status');
        onUpdate();
      }
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`ticket-messages-${ticket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          console.log('New message received:', payload);
          fetchMessages();
          markAsRead();
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      channel.unsubscribe();
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userProfile) return;

    setSendingMessage(true);
    try {
      const { error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticket.id,
          sender_id: userProfile.id,
          message: newMessage.trim(),
        });

      if (error) throw error;

      setNewMessage('');
      await markAsRead();
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!userProfile) return;

    setLoading(true);
    setError(null);

    try {
      const { error: ticketError } = await supabase
        .from('tickets')
        .update({
          status: 'closed',
          closed_by: userProfile.id,
          closed_at: new Date().toISOString(),
          resolution_notes: resolutionNotes || 'Ticket resolved',
        })
        .eq('id', ticket.id);

      if (ticketError) throw ticketError;

      if (ticket.device_id && ticket.devices?.status === 'offline') {
        const { error: deviceError } = await supabase
          .from('devices')
          .update({
            status: 'online',
            last_online_at: new Date().toISOString(),
          })
          .eq('id', ticket.device_id);

        if (deviceError) throw deviceError;
      }

      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error closing ticket:', err);
      setError(err instanceof Error ? err.message : 'Failed to close ticket');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'medium':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
      case 'low':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-400';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-400';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'open'
      ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Ticket Details
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {ticket.ticket_number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(ticket.status)}`}>
              {ticket.status === 'open' ? 'Open' : 'Closed'}
            </span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(ticket.priority)}`}>
              {ticket.priority} priority
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-400 capitalize">
              {ticket.ticket_type}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-2">
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">Customer</span>
              </div>
              <p className="text-slate-900 dark:text-white font-medium">
                {ticket.customers?.customer_name || '-'}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Raised At</span>
              </div>
              <p className="text-slate-900 dark:text-white font-medium">
                {new Date(ticket.raised_at).toLocaleString()}
              </p>
            </div>
          </div>

          {(ticket.devices || ticket.device_serial_number) && (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                Device Information
              </div>
              <div className="space-y-1">
                <p className="text-slate-900 dark:text-white font-medium">
                  Serial: {ticket.devices?.device_serial_number || ticket.device_serial_number}
                </p>
                {ticket.devices?.location && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Location: {ticket.devices.location}
                  </p>
                )}
                {ticket.is_device_online !== null && (
                  <p className="text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Device was: </span>
                    <span className={`font-medium ${ticket.is_device_online ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {ticket.is_device_online ? 'Online' : 'Offline'}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400"> when ticket was raised</span>
                  </p>
                )}
                {ticket.devices && (
                  <p className="text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Current Status: </span>
                    <span className={`font-medium ${
                      ticket.devices.status === 'online'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {ticket.devices.status}
                  </span>
                </p>
                )}
              </div>
            </div>
          )}

          {!ticket.device_id && !ticket.device_serial_number && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">General Ticket (Not device-specific)</span>
              </div>
            </div>
          )}

          {ticket.description && (
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Description
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                <p className="text-slate-900 dark:text-white whitespace-pre-wrap">
                  {ticket.description}
                </p>
              </div>
            </div>
          )}

          {ticket.actions_before_offline && (
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Actions Before Issue
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                <p className="text-slate-900 dark:text-white whitespace-pre-wrap">
                  {ticket.actions_before_offline}
                </p>
              </div>
            </div>
          )}

          {ticket.suspected_reason && (
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Suspected Reason
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                <p className="text-slate-900 dark:text-white whitespace-pre-wrap">
                  {ticket.suspected_reason}
                </p>
              </div>
            </div>
          )}

          {ticket.actions_taken_to_fix && (
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Actions Taken to Fix
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                <p className="text-slate-900 dark:text-white whitespace-pre-wrap">
                  {ticket.actions_taken_to_fix}
                </p>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <MessageSquare className="w-4 h-4" />
              Messages
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="h-64 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400 text-sm">
                    No messages yet. Start a conversation!
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_id === userProfile?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-lg px-4 py-2 ${
                          msg.sender_id === userProfile?.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                        }`}
                      >
                        <div className="text-xs opacity-75 mb-1">
                          {msg.users?.name || 'Unknown'} ({msg.users?.role || 'user'})
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                        <div className="text-xs opacity-75 mt-1">
                          {new Date(msg.created_at).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="border-t border-slate-200 dark:border-slate-700 p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    disabled={sendingMessage}
                  />
                  <button
                    type="submit"
                    disabled={sendingMessage || !newMessage.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>

          {ticket.status === 'closed' && ticket.resolution_notes && (
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Resolution Notes
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <p className="text-slate-900 dark:text-white whitespace-pre-wrap">
                  {ticket.resolution_notes}
                </p>
                {ticket.closed_at && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Closed: {new Date(ticket.closed_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}

          {ticket.status === 'open' && (
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Resolution Notes
              </div>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Enter resolution notes..."
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none"
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 sticky bottom-0">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            {ticket.status === 'open' && (
              <button
                onClick={handleCloseTicket}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  'Closing...'
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Close Ticket
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
