import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Factory,
  Activity,
  Settings,
  X,
  ChevronDown,
  ChevronRight,
  Box,
  Users,
  ShoppingCart,
  Layers,
  FileText,
  TrendingUp,
  Target,
  UserPlus,
  Receipt,
  Truck,
  Headset,
  ClipboardList,
  Info,
  FileWarning,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AboutPresentation from './AboutPresentation';
import ReportsPanel from './ReportsPanel';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const allNavigation = [
  { name: 'Dashboard', to: '/', icon: LayoutDashboard },
  {
    name: 'Sales',
    to: '/sales',
    icon: TrendingUp,
    subItems: [
      { name: 'Leads', to: '/sales/leads', icon: Target },
      { name: 'Prospects', to: '/sales/prospects', icon: UserPlus },
      { name: 'Customers', to: '/sales/customers', icon: Users },
      { name: 'Orders', to: '/sales/purchase-orders', icon: ClipboardList },
      { name: 'Sales', to: '/sales/orders', icon: Receipt },
      { name: 'Deliveries', to: '/sales/deliveries', icon: Truck },
    ]
  },
  {
    name: 'Inventory',
    to: '/inventory',
    icon: Package,
    subItems: [
      { name: 'Vendors', to: '/inventory/vendors', icon: Users },
      { name: 'Items', to: '/inventory/items', icon: Box },
      { name: 'Purchases', to: '/inventory/purchases', icon: ShoppingCart },
    ]
  },
  {
    name: 'Manufacturing',
    to: '/manufacturing',
    icon: Factory,
    subItems: [
      { name: 'BOM Builder', to: '/manufacturing/bom', icon: Layers },
      { name: 'Assembly', to: '/manufacturing/assembly', icon: Factory },
      { name: 'Traceability', to: '/manufacturing/traceability', icon: FileText },
    ]
  },
  { name: 'Support', to: '/support', icon: Headset },
  { name: 'Activity Log', to: '/activity', icon: Activity },
  { name: 'Settings', to: '/settings', icon: Settings, adminOnly: true },
];

export default function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const { userProfile } = useAuth();
  const location = useLocation();
  const [showAboutPresentation, setShowAboutPresentation] = useState(false);
  const [showReportsPanel, setShowReportsPanel] = useState(false);
  const [unreadTicketsCount, setUnreadTicketsCount] = useState(0);

  // Debug: Log the count whenever it changes
  useEffect(() => {
    console.log('Badge - unreadTicketsCount changed to:', unreadTicketsCount);
  }, [unreadTicketsCount]);

  const navigation = allNavigation.filter(item =>
    !item.adminOnly || userProfile?.role === 'admin'
  );
  const [expandedItem, setExpandedItem] = useState<string | null>(() => {
    if (location.pathname.startsWith('/sales')) return 'Sales';
    if (location.pathname.startsWith('/inventory')) return 'Inventory';
    if (location.pathname.startsWith('/manufacturing')) return 'Manufacturing';
    return null;
  });

  useEffect(() => {
    if (!userProfile?.id) return;

    const fetchUnreadTickets = async () => {
      console.log('Fetching tickets for badge, userProfile:', userProfile);

      const { data: ticketsData, error } = await supabase
        .from('tickets')
        .select('id, raised_at');

      console.log('Tickets query result:', { ticketsData, error });

      if (error || !ticketsData) {
        console.error('Error fetching tickets for badge:', error);
        setUnreadTicketsCount(0);
        return;
      }

      console.log(`Found ${ticketsData.length} total tickets`);

      let unreadCount = 0;
      for (const ticket of ticketsData) {
        const { data: lastRead, error: readError } = await supabase
          .from('ticket_message_reads')
          .select('last_read_at')
          .eq('ticket_id', ticket.id)
          .eq('user_id', userProfile.id)
          .maybeSingle();

        console.log(`Ticket ${ticket.id} - lastRead:`, lastRead, 'error:', readError);

        // Count as unread if never viewed
        if (!lastRead) {
          unreadCount++;
          console.log(`Ticket ${ticket.id} marked as unread (never viewed)`);
          continue;
        }

        // Check if there are new messages since last read
        const { data: latestMessage, error: msgError } = await supabase
          .from('ticket_messages')
          .select('created_at')
          .eq('ticket_id', ticket.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log(`Ticket ${ticket.id} - latestMessage:`, latestMessage, 'error:', msgError);

        if (latestMessage && new Date(latestMessage.created_at) > new Date(lastRead.last_read_at)) {
          unreadCount++;
          console.log(`Ticket ${ticket.id} marked as unread (new messages)`);
        }
      }

      console.log('Unread tickets count:', unreadCount);
      setUnreadTicketsCount(unreadCount);
    };

    fetchUnreadTickets();

    const ticketsChannel = supabase
      .channel('tickets-count')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tickets',
        },
        () => {
          fetchUnreadTickets();
        }
      )
      .subscribe();

    const messagesChannel = supabase
      .channel('ticket-messages-count')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
        },
        () => {
          fetchUnreadTickets();
        }
      )
      .subscribe();

    const readsChannel = supabase
      .channel('ticket-reads-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_message_reads',
        },
        () => {
          fetchUnreadTickets();
        }
      )
      .subscribe();

    return () => {
      ticketsChannel.unsubscribe();
      messagesChannel.unsubscribe();
      readsChannel.unsubscribe();
    };
  }, [userProfile]);

  const toggleExpand = (itemName: string) => {
    setExpandedItem(expandedItem === itemName ? null : itemName);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-[70] md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-[80] bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transform transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'md:w-20' : 'w-64'}`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          {collapsed ? (
            // Collapsed: Just logo, clickable to expand
            <div className="flex items-center justify-center h-[73px] border-b border-slate-200 dark:border-slate-700">
              <button onClick={onToggleCollapse} className="hover:opacity-80 transition-opacity">
                <img src="/cajo_a.png" alt="Cajo ERP" className="h-10 w-10" />
              </button>
            </div>
          ) : (
            // Expanded: Logo, title, role, and X button
            <div className="flex items-center justify-between px-4 h-[73px] border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-2">
                <img src="/cajo_a.png" alt="Cajo ERP" className="h-10 w-10" />
                <div>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                    Cajo ERP
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                    {userProfile?.role || 'User'}
                  </p>
                </div>
              </div>
              <button
                onClick={onToggleCollapse}
                className="hidden md:block p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <button
                onClick={onClose}
                className="md:hidden p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1 pb-0">
            {navigation.map((item) => (
              <div key={item.name}>
                {item.subItems ? (
                  <>
                    {collapsed ? (
                      // Collapsed: Show submenu icons directly
                      <div className="space-y-1">
                        {item.subItems.map((subItem) => (
                          <NavLink
                            key={subItem.name}
                            to={subItem.to}
                            onClick={onClose}
                            className={({ isActive }) =>
                              `flex items-center justify-center px-3 py-3 rounded-lg transition-colors ${
                                isActive
                                  ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`
                            }
                            title={subItem.name}
                          >
                            {({ isActive }) => (
                              <subItem.icon className={`w-5 h-5 ${isActive ? 'text-green-600 dark:text-green-400' : ''}`} />
                            )}
                          </NavLink>
                        ))}
                      </div>
                    ) : (
                      // Expanded: Full menu with subitems
                      <>
                        <NavLink
                          to={item.to}
                          onClick={(e) => {
                            toggleExpand(item.name);
                            onClose();
                          }}
                          className={({ isActive }) =>
                            `w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                              isActive
                                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <div className="flex items-center space-x-3">
                                <item.icon className={`w-5 h-5 ${isActive ? 'text-green-600 dark:text-green-400' : ''}`} />
                                <span className="font-medium">{item.name}</span>
                              </div>
                              {expandedItem === item.name ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </>
                          )}
                        </NavLink>
                        {expandedItem === item.name && (
                          <div className="ml-4 mt-1 space-y-1">
                            {item.subItems.map((subItem) => (
                              <NavLink
                                key={subItem.name}
                                to={subItem.to}
                                onClick={onClose}
                                className={({ isActive }) =>
                                  `flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                                    isActive
                                      ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                  }`
                                }
                              >
                                {({ isActive }) => (
                                  <>
                                    <subItem.icon className={`w-4 h-4 ${isActive ? 'text-green-600 dark:text-green-400' : ''}`} />
                                    <span className="text-sm font-medium">{subItem.name}</span>
                                  </>
                                )}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <NavLink
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center ${collapsed ? 'justify-center px-3 py-3' : 'space-x-3 px-3 py-2'} rounded-lg transition-colors ${
                        isActive
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      } relative`
                    }
                    title={collapsed ? item.name : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={`w-5 h-5 ${isActive ? 'text-green-600 dark:text-green-400' : ''}`} />
                        {!collapsed && <span className="font-medium">{item.name}</span>}
                        {!collapsed && item.name === 'Support' && unreadTicketsCount > 0 && (
                          <span className="ml-auto bg-red-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                            {unreadTicketsCount > 9 ? '9+' : unreadTicketsCount}
                          </span>
                        )}
                        {collapsed && item.name === 'Support' && unreadTicketsCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {unreadTicketsCount > 9 ? '9+' : unreadTicketsCount}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                )}
              </div>
            ))}
          </nav>

          {/* Report and About Buttons */}
          <div className="p-4 space-y-1">
            <button
              onClick={() => {
                setShowReportsPanel(true);
                onClose();
              }}
              className={`w-full flex items-center ${collapsed ? 'justify-center px-3 py-3' : 'space-x-3 px-3 py-2'} rounded-lg transition-colors text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700`}
              title={collapsed ? 'Report Bug or Request Feature' : undefined}
            >
              <FileWarning className="w-5 h-5" />
              {!collapsed && <span className="font-medium">Report</span>}
            </button>
            <button
              onClick={() => {
                setShowAboutPresentation(true);
                onClose();
              }}
              className={`w-full flex items-center ${collapsed ? 'justify-center px-3 py-3' : 'space-x-3 px-3 py-2'} rounded-lg transition-colors text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700`}
              title={collapsed ? 'About Cajo ERP' : undefined}
            >
              <Info className="w-5 h-5" />
              {!collapsed && <span className="font-medium">About</span>}
            </button>
          </div>

          {/* Footer - Version */}
          <div className="border-t border-slate-200 dark:border-slate-700 p-4">
            {collapsed ? (
              <div className="text-center">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400" title="Version 4.0">
                  v4.0
                </span>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Version 4.0
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      <AboutPresentation
        isOpen={showAboutPresentation}
        onClose={() => setShowAboutPresentation(false)}
      />

      <ReportsPanel
        isOpen={showReportsPanel}
        onClose={() => setShowReportsPanel(false)}
      />
    </>
  );
}
