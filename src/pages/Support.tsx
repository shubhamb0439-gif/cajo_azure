import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Plus, Filter, CheckCircle, Clock, AlertCircle, XCircle, Wifi, WifiOff } from 'lucide-react';
import TicketDetailModal from '../components/TicketDetailModal';

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
  has_unread: boolean;
  last_message_from_client: boolean;
  customers?: {
    customer_name: string;
  };
  devices?: {
    device_serial_number: string;
    location: string | null;
    status: string;
  };
}

export default function Support() {
  const { userProfile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [onlineDevices, setOnlineDevices] = useState(0);
  const [offlineDevices, setOfflineDevices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    loadTickets();
    loadDeviceCounts();

    const ticketsSubscription = supabase
      .channel('tickets_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        loadTickets();
      })
      .subscribe();

    const devicesSubscription = supabase
      .channel('devices_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => {
        loadDeviceCounts();
      })
      .subscribe();

    const messagesSubscription = supabase
      .channel('ticket_messages_support')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_messages' }, () => {
        loadTickets();
      })
      .subscribe();

    const readsSubscription = supabase
      .channel('ticket_reads_support')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_message_reads' }, () => {
        loadTickets();
      })
      .subscribe();

    return () => {
      ticketsSubscription.unsubscribe();
      devicesSubscription.unsubscribe();
      messagesSubscription.unsubscribe();
      readsSubscription.unsubscribe();
    };
  }, []);

  const loadTickets = async () => {
    try {
      const { data: ticketsData, error } = await supabase
        .from('tickets')
        .select(`
          *,
          customers(customer_name),
          devices(device_serial_number, location, status)
        `)
        .order('raised_at', { ascending: false });

      if (error) throw error;

      if (userProfile?.id) {
        const ticketsWithUnread = await Promise.all(
          (ticketsData || []).map(async (ticket) => {
            const { data: lastRead } = await supabase
              .from('ticket_message_reads')
              .select('last_read_at')
              .eq('ticket_id', ticket.id)
              .eq('user_id', userProfile.id)
              .maybeSingle();

            const { data: latestMessage } = await supabase
              .from('ticket_messages')
              .select('created_at, sender_id, users(role)')
              .eq('ticket_id', ticket.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            // Check if ticket has never been viewed (no read record)
            const is_new = !lastRead;

            // Check if there are new messages since last read
            const has_new_messages = latestMessage && lastRead && new Date(latestMessage.created_at) > new Date(lastRead.last_read_at);

            // Check if last message was from client/manager (for additional context)
            const last_message_from_client = latestMessage?.users?.role === 'client' || latestMessage?.users?.role === 'manager';

            return {
              ...ticket,
              has_unread: is_new || !!has_new_messages,
              last_message_from_client: !!last_message_from_client,
            };
          })
        );
        setTickets(ticketsWithUnread);
      } else {
        setTickets(ticketsData || []);
      }
    } catch (error: any) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDeviceCounts = async () => {
    try {
      const { count: onlineCount, error: onlineError } = await supabase
        .from('devices')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'online');

      const { count: offlineCount, error: offlineError } = await supabase
        .from('devices')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'offline');

      if (onlineError) throw onlineError;
      if (offlineError) throw offlineError;

      setOnlineDevices(onlineCount || 0);
      setOfflineDevices(offlineCount || 0);
    } catch (error: any) {
      console.error('Error loading device counts:', error);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const deviceSerial = ticket.devices?.device_serial_number || ticket.device_serial_number;
    const matchesSearch =
      ticket.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ticket.description && ticket.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      ticket.customers?.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (deviceSerial && deviceSerial.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'closed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Support Tickets</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Devices Online</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {onlineDevices}
              </p>
            </div>
            <Wifi className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Devices Offline</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {offlineDevices}
              </p>
            </div>
            <WifiOff className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Tickets</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {tickets.length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Open</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {tickets.filter(t => t.status === 'open').length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Closed</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {tickets.filter(t => t.status === 'closed').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Filter className="w-5 h-5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="all">All Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Ticket #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Device
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Raised
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      No tickets found
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${
                        ticket.has_unread
                          ? ticket.last_message_from_client
                            ? 'bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500'
                            : 'bg-green-50 dark:bg-green-900/10 border-l-4 border-green-500'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          {ticket.has_unread && (
                            <span
                              className={`inline-flex items-center justify-center w-2 h-2 rounded-full animate-pulse ${
                                ticket.last_message_from_client ? 'bg-blue-600' : 'bg-green-600'
                              }`}
                            />
                          )}
                          <span className={ticket.has_unread ? 'font-bold' : ''}>
                            {ticket.ticket_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 dark:text-white capitalize">
                        {ticket.ticket_type}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {ticket.customers?.customer_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {ticket.devices?.device_serial_number || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {ticket.description || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(ticket.status)}
                          <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                            {ticket.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {new Date(ticket.raised_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => {
            setSelectedTicket(null);
            loadTickets();
          }}
          onUpdate={() => {
            loadTickets();
            loadDeviceCounts();
          }}
        />
      )}
    </div>
  );
}
