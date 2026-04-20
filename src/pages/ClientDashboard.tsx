import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Truck, WifiOff, Ticket, CheckCircle, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import type { Database } from '../lib/database.types';
import TicketForm from '../components/TicketForm';
import TicketDetailModal from '../components/TicketDetailModal';

type Device = Database['public']['Tables']['devices']['Row'];
type DeviceHistory = Database['public']['Tables']['device_history']['Row'];
type TicketRow = Database['public']['Tables']['tickets']['Row'];

interface DeviceWithHistory extends Device {
  device_history: DeviceHistory[];
}

interface SaleItem {
  id: string;
  serial_number: string;
  delivered: boolean;
  assembly_unit_id: string;
  assembly_units: {
    assembly_id: string;
    assemblies: {
      assembly_name: string;
    };
  };
}

interface Sale {
  id: string;
  sale_number: string;
  sale_date: string;
  sale_notes: string | null;
  is_delivered: boolean;
  sale_items: SaleItem[];
}

interface TicketWithDetails {
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
  last_message_from_erp: boolean;
  customers?: {
    customer_name: string;
  };
  devices?: {
    device_serial_number: string;
    location: string | null;
    status: string;
  };
}

export default function ClientDashboard() {
  const { userProfile, isManager, isClient, customerCompany } = useAuth();
  const [devices, setDevices] = useState<DeviceWithHistory[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketMode, setTicketMode] = useState<'raise' | 'close'>('raise');
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketWithDetails | null>(null);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'open' | 'closed'>('all');

  const totalOrdered = sales.reduce((sum, sale) => sum + sale.sale_items.length, 0);
  const totalReady = devices.filter(d => d.status === 'ready_for_dispatch').length;
  const totalDispatched = devices.filter(d => d.status === 'dispatched').length;
  const totalDelivered = devices.filter(d => d.status === 'delivered' || d.delivered_date !== null).length;
  const totalOffline = devices.filter(d => d.status === 'offline').length;
  const totalOnline = devices.filter(d => d.status === 'online').length;

  const metrics = {
    ordered: totalOrdered,
    ready: totalReady,
    dispatched: totalDispatched,
    delivered: totalDelivered,
    offline: totalOffline,
    online: totalOnline,
    openTickets: openTicketsCount,
  };

  useEffect(() => {
    if (userProfile?.customer_id) {
      fetchSales();
      fetchDevices();
      fetchOpenTickets();
      fetchAllTickets();
      subscribeToDevices();
      subscribeToSales();
      subscribeToTickets();
    }
  }, [userProfile?.customer_id]);

  const fetchSales = async () => {
    if (!userProfile?.customer_id) return;

    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        sale_number,
        sale_date,
        sale_notes,
        is_delivered,
        sale_items(
          id,
          serial_number,
          delivered,
          assembly_unit_id,
          assembly_units(
            assembly_id,
            assemblies(assembly_name)
          )
        )
      `)
      .eq('customer_id', userProfile.customer_id)
      .order('sale_date', { ascending: false });

    if (error) {
      console.error('Error fetching sales:', error);
      return;
    }

    setSales(data as Sale[] || []);
    setLoading(false);
  };

  const fetchDevices = async () => {
    if (!userProfile?.customer_id) return;

    const { data, error } = await supabase
      .from('devices')
      .select('*, device_history(*)')
      .eq('customer_id', userProfile.customer_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching devices:', error);
      return;
    }

    setDevices(data as DeviceWithHistory[] || []);
  };

  const fetchOpenTickets = async () => {
    if (!userProfile?.customer_id) return;

    const { count, error } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', userProfile.customer_id)
      .eq('status', 'open');

    if (error) {
      console.error('Error fetching open tickets:', error);
      return;
    }

    setOpenTicketsCount(count || 0);
  };

  const fetchAllTickets = async () => {
    if (!userProfile?.customer_id || !userProfile?.id) return;

    const { data: ticketsData, error } = await supabase
      .from('tickets')
      .select(`
        *,
        customers(customer_name),
        devices(device_serial_number, location, status)
      `)
      .eq('customer_id', userProfile.customer_id)
      .order('raised_at', { ascending: false });

    if (error) {
      console.error('Error fetching tickets:', error);
      return;
    }

    const ticketsWithUnread = await Promise.all(
      (ticketsData || []).map(async (ticket) => {
        const { data: lastRead, error: readError } = await supabase
          .from('ticket_message_reads')
          .select('last_read_at')
          .eq('ticket_id', ticket.id)
          .eq('user_id', userProfile.id)
          .maybeSingle();

        if (readError) {
          console.error('ClientDashboard: Error fetching read status for ticket', ticket.ticket_number, readError);
        }

        const { data: latestMessage } = await supabase
          .from('ticket_messages')
          .select('created_at, sender_id, users(role)')
          .eq('ticket_id', ticket.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const has_unread = latestMessage && (!lastRead || new Date(latestMessage.created_at) > new Date(lastRead.last_read_at));

        const last_message_from_erp = latestMessage?.users?.role === 'admin' || latestMessage?.users?.role === 'user';

        return {
          ...ticket,
          has_unread: !!has_unread,
          last_message_from_erp: !!last_message_from_erp,
        } as TicketWithDetails;
      })
    );

    setTickets(ticketsWithUnread);
  };

  const subscribeToDevices = () => {
    if (!userProfile?.customer_id) return;

    const channel = supabase
      .channel('devices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
          filter: `customer_id=eq.${userProfile.customer_id}`,
        },
        () => {
          fetchDevices();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'device_history',
        },
        () => {
          fetchDevices();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const subscribeToSales = () => {
    if (!userProfile?.customer_id) return;

    const salesChannel = supabase
      .channel('sales-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales',
          filter: `customer_id=eq.${userProfile.customer_id}`,
        },
        () => {
          fetchSales();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sale_items',
        },
        () => {
          fetchSales();
        }
      )
      .subscribe();

    return () => {
      salesChannel.unsubscribe();
    };
  };

  const subscribeToTickets = () => {
    if (!userProfile?.customer_id) return;

    const ticketsChannel = supabase
      .channel('tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `customer_id=eq.${userProfile.customer_id}`,
        },
        () => {
          fetchOpenTickets();
          fetchAllTickets();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
        },
        () => {
          fetchAllTickets();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_message_reads',
        },
        (payload) => {
          console.log('ClientDashboard: ticket_message_reads changed', payload);
          fetchAllTickets();
        }
      )
      .subscribe();

    return () => {
      ticketsChannel.unsubscribe();
    };
  };

  const handleRaiseTicket = () => {
    setTicketMode('raise');
    setShowTicketForm(true);
  };

  const handleCloseTicket = () => {
    setTicketMode('close');
    setShowTicketForm(true);
  };

  const handleTicketSuccess = () => {
    fetchDevices();
    fetchOpenTickets();
    fetchAllTickets();
    setShowTicketForm(false);
  };

  const handleTicketUpdate = () => {
    fetchOpenTickets();
    fetchAllTickets();
  };

  const filteredSales = sales.filter(sale => {
    const matchesSearch =
      sale.sale_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.sale_items.some(item =>
        item.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.assembly_units?.assemblies?.assembly_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesFilter =
      statusFilter === 'all' ||
      (statusFilter === 'delivered' && sale.is_delivered) ||
      (statusFilter === 'pending' && !sale.is_delivered);

    return matchesSearch && matchesFilter;
  });

  const filteredDevices = devices.filter(device => {
    const matchesSearch =
      device.device_serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.location?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = statusFilter === 'all' || device.status === statusFilter;

    return matchesSearch && matchesFilter;
  });

  const sortedDevices = [...filteredDevices].sort((a, b) => {
    if (a.status === 'offline' && b.status !== 'offline') return -1;
    if (a.status !== 'offline' && b.status === 'offline') return 1;

    if (a.status === 'offline' && b.status === 'offline') {
      return (b.total_offline_minutes || 0) - (a.total_offline_minutes || 0);
    }

    if (a.status === 'online' && b.status === 'online') {
      return (a.total_online_minutes || 0) - (b.total_online_minutes || 0);
    }

    return 0;
  });

  const filteredTickets = tickets.filter(ticket => {
    if (ticketStatusFilter === 'all') return true;
    return ticket.status === ticketStatusFilter;
  });

  const formatUptime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600 dark:text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Client Portal
          </h1>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400">
            {isManager ? 'MANAGER' : 'OPERATOR'}
          </span>
        </div>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          {userProfile?.name} ({customerCompany || 'No Company'})
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Lasers Ordered</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{metrics.ordered}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Lasers Ready</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{metrics.ready}</p>
            </div>
            <div className="p-3 bg-cyan-100 dark:bg-cyan-900/20 rounded-lg">
              <CheckCircle className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Lasers Dispatched</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{metrics.dispatched}</p>
            </div>
            <div className="p-3 bg-violet-100 dark:bg-violet-900/20 rounded-lg">
              <Truck className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Lasers Delivered</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{metrics.delivered}</p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Lasers Offline / Online</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{metrics.offline}</p>
                  <span className="text-xs text-slate-500 dark:text-slate-400">OFF</span>
                </div>
                <span className="text-slate-400">/</span>
                <div className="flex items-center gap-1">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{metrics.online}</p>
                  <span className="text-xs text-slate-500 dark:text-slate-400">ON</span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <WifiOff className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Open Tickets</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{metrics.openTickets}</p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={handleRaiseTicket}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-4 px-6 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
        >
          <Ticket className="w-5 h-5" />
          RAISE TICKET
        </button>

        <button
          onClick={handleCloseTicket}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-4 px-6 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-5 h-5" />
          CLOSE TICKET
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Support Tickets</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setTicketStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                ticketStatusFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTicketStatusFilter('open')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                ticketStatusFilter === 'open'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              Open
            </button>
            <button
              onClick={() => setTicketStatusFilter('closed')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                ticketStatusFilter === 'closed'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              Closed
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-slate-600 dark:text-slate-400">
              No tickets found
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer relative ${
                  ticket.status === 'open' ? 'bg-red-50 dark:bg-red-900/10' : ''
                } ${ticket.has_unread && ticket.last_message_from_erp ? 'border-l-4 border-l-green-600' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        {ticket.ticket_number}
                      </h3>
                      {ticket.has_unread && ticket.last_message_from_erp && (
                        <span className="inline-flex items-center justify-center w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                      )}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        ticket.status === 'open'
                          ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                          : 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                      }`}>
                        {ticket.status === 'open' ? 'Open' : 'Closed'}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        ticket.priority === 'critical'
                          ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                          : ticket.priority === 'high'
                          ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400'
                          : ticket.priority === 'medium'
                          ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400'
                          : 'bg-slate-100 dark:bg-slate-900/20 text-slate-800 dark:text-slate-400'
                      }`}>
                        {ticket.priority} priority
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-900/20 text-slate-800 dark:text-slate-400 capitalize">
                        {ticket.ticket_type}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      {ticket.description}
                    </div>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">Raised:</span>
                        <span className="ml-1 text-slate-900 dark:text-white">
                          {new Date(ticket.raised_at).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                      {ticket.device_serial_number && (
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Device:</span>
                          <span className="ml-1 text-slate-900 dark:text-white">
                            {ticket.device_serial_number}
                          </span>
                        </div>
                      )}
                      {ticket.closed_at && (
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Closed:</span>
                          <span className="ml-1 text-slate-900 dark:text-white">
                            {new Date(ticket.closed_at).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {(isManager || filteredSales.length > 0) && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          {isManager && (
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search by sale number, serial number, or assembly name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {filteredSales.length === 0 && isManager ? (
              <div className="p-8 text-center text-slate-600 dark:text-slate-400">
                No sales found
              </div>
            ) : (
              filteredSales.map((sale) => (
              <div key={sale.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        {sale.sale_number}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        sale.is_delivered
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                          : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400'
                      }`}>
                        {sale.is_delivered ? 'Delivered' : 'Pending'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">Sale Date:</span>
                        <span className="ml-1 text-slate-900 dark:text-white">
                          {new Date(sale.sale_date).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">Items:</span>
                        <span className="ml-1 text-slate-900 dark:text-white">
                          {sale.sale_items.length}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">Delivered Items:</span>
                        <span className="ml-1 text-slate-900 dark:text-white">
                          {sale.sale_items.filter(item => item.delivered).length} / {sale.sale_items.length}
                        </span>
                      </div>
                    </div>
                    {sale.sale_notes && (
                      <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        Notes: {sale.sale_notes}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}
                    className="ml-4 p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    {expandedSale === sale.id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                </div>

                {expandedSale === sale.id && sale.sale_items && sale.sale_items.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">Sale Items</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-700">
                            <th className="text-left py-2 text-slate-600 dark:text-slate-400">Serial Number</th>
                            <th className="text-left py-2 text-slate-600 dark:text-slate-400">Assembly</th>
                            <th className="text-center py-2 text-slate-600 dark:text-slate-400">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sale.sale_items.map((item) => (
                            <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
                              <td className="py-2 text-slate-700 dark:text-slate-300">{item.serial_number}</td>
                              <td className="py-2 text-slate-700 dark:text-slate-300">{item.assembly_units?.assemblies?.assembly_name || 'N/A'}</td>
                              <td className="py-2 text-center">
                                <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                                  item.delivered
                                    ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                                    : 'bg-slate-100 dark:bg-slate-900/20 text-slate-800 dark:text-slate-400'
                                }`}>
                                  {item.delivered ? 'Delivered' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))
            )}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Device Status</h2>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {sortedDevices.length === 0 ? (
            <div className="p-8 text-center text-slate-600 dark:text-slate-400">
              No devices found
            </div>
          ) : (
            sortedDevices.map((device) => (
              <div
                key={device.id}
                className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                  device.status === 'offline' ? 'bg-red-50 dark:bg-red-900/10' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        {device.device_serial_number}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        device.status === 'online'
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                          : device.status === 'offline'
                          ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                          : device.status === 'installed'
                          ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400'
                          : 'bg-slate-100 dark:bg-slate-900/20 text-slate-800 dark:text-slate-400'
                      }`}>
                        {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                      </span>
                    </div>
                    {device.location && (
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Location: {device.location}
                      </div>
                    )}
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">Total Online:</span>
                        <span className="ml-1 text-green-600 dark:text-green-400 font-medium">
                          {formatUptime(device.total_online_minutes || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">Total Offline:</span>
                        <span className="ml-1 text-red-600 dark:text-red-400 font-medium">
                          {formatUptime(device.total_offline_minutes || 0)}
                        </span>
                      </div>
                      {device.installed_date && (
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Installed:</span>
                          <span className="ml-1 text-slate-900 dark:text-white">
                            {new Date(device.installed_date).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      )}
                      {device.last_online_at && (
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Last Online:</span>
                          <span className="ml-1 text-slate-900 dark:text-white">
                            {new Date(device.last_online_at).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showTicketForm && (
        <TicketForm
          mode={ticketMode}
          onClose={() => setShowTicketForm(false)}
          onSuccess={handleTicketSuccess}
        />
      )}

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={handleTicketUpdate}
        />
      )}
    </div>
  );
}
