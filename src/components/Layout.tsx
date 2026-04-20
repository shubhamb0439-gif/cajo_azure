import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MessagingPanel from './MessagingPanel';
import HelpChatbot from './HelpChatbot';
import { HelpCircle } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { userProfile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [messagingPanelOpen, setMessagingPanelOpen] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadCountsByUser, setUnreadCountsByUser] = useState<Record<string, number>>({});
  const [helpChatbotOpen, setHelpChatbotOpen] = useState(false);

  const isClient = userProfile?.role === 'client' || userProfile?.role === 'manager';

  useEffect(() => {
    if (!userProfile) return;

    updateUnreadCount();

    const channel = supabase
      .channel('messages-realtime-global')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          updateUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reads',
        },
        () => {
          updateUnreadCount();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userProfile]);

  const updateUnreadCount = async () => {
    if (!userProfile) return;

    const { data: allMessages } = await supabase
      .from('messages')
      .select('id, sender_id')
      .eq('receiver_id', userProfile.id);

    const { data: readMessages } = await supabase
      .from('message_reads')
      .select('message_id')
      .eq('user_id', userProfile.id);

    const readIds = new Set(readMessages?.map(r => r.message_id) || []);
    const unreadMessages = allMessages?.filter(m => !readIds.has(m.id)) || [];
    const unreadCount = unreadMessages.length;

    setUnreadMessageCount(unreadCount);

    const countsByUser: Record<string, number> = {};
    unreadMessages.forEach(msg => {
      countsByUser[msg.sender_id] = (countsByUser[msg.sender_id] || 0) + 1;
    });
    setUnreadCountsByUser(countsByUser);
  };

  const [panelsExpanded, setPanelsExpanded] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 border-t-[3px] relative" style={{ borderTopColor: '#b5272d' }}>
      <div className="absolute left-0 right-0 w-full flex justify-center" style={{ top: '-1px', zIndex: 10000 }}>
        <div
          className="fixed left-0 right-0 w-screen max-w-none transition-all duration-300 overflow-hidden"
          style={{
            top: '0',
            zIndex: 9999,
            backgroundColor: '#b5272d',
            height: panelsExpanded ? '73px' : '0'
          }}
        >
          <div
            className="flex items-center justify-center h-[73px] text-white transition-opacity duration-300 delay-150"
            style={{ opacity: panelsExpanded ? 1 : 0 }}
          >
            <p className="text-lg font-semibold text-center">Built by OG+ Rapid Coding Services • info@ogplus.in</p>
          </div>
        </div>
        <div
          className="relative transition-all duration-300 rounded-sm shadow-sm overflow-hidden cursor-pointer"
          style={{
            zIndex: 10001,
            marginTop: '-3px',
            backgroundColor: '#b5272d',
            padding: '6px 8px',
            transform: panelsExpanded ? 'translateY(73px)' : 'translateY(0)'
          }}
          onClick={() => setPanelsExpanded(!panelsExpanded)}
        >
          <img
            src="/ogplus_copy.png"
            alt="OG+ Logo"
            className="h-6 w-auto relative"
          />
        </div>
      </div>

      <div className="absolute left-0 right-0 w-full flex justify-center pointer-events-none" style={{ bottom: '0', zIndex: 10000 }}>
        <div
          className="fixed left-0 right-0 w-screen max-w-none transition-all duration-300 overflow-hidden"
          style={{
            bottom: '0',
            zIndex: 9999,
            backgroundColor: '#b5272d',
            height: panelsExpanded ? '40px' : '0'
          }}
        >
          <div
            className="flex items-center justify-center h-[40px] text-white transition-opacity duration-300 delay-150"
            style={{ opacity: panelsExpanded ? 1 : 0 }}
          >
            <p className="text-sm font-medium text-center">©2026 OG Plus Services Pvt Ltd</p>
          </div>
        </div>
      </div>
      {!isClient && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onMessageClick={() => setMessagingPanelOpen(!messagingPanelOpen)}
          unreadMessageCount={unreadMessageCount}
          hideMenuButton={isClient}
          isClientPortal={isClient}
        />

        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <MessagingPanel
        isOpen={messagingPanelOpen}
        onClose={() => setMessagingPanelOpen(false)}
        onUnreadCountChange={updateUnreadCount}
        unreadCountsByUser={unreadCountsByUser}
      />

      <HelpChatbot
        isOpen={helpChatbotOpen}
        onClose={() => setHelpChatbotOpen(false)}
      />

      {!helpChatbotOpen && (
        <button
          onClick={() => setHelpChatbotOpen(true)}
          className="fixed bottom-6 right-6 w-12 h-12 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-40 group"
          aria-label="Open Help Center"
        >
          <HelpCircle className="w-5 h-5" />
          <span className="absolute right-16 bottom-3 bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Help Center
          </span>
        </button>
      )}
    </div>
  );
}
