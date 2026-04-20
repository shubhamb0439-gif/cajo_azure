import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useDevice } from '../contexts/DeviceContext';
import QRScanner from '../components/QRScanner';
import EditProfilePanel from '../components/EditProfilePanel';
import ChangePasswordPanel from '../components/ChangePasswordPanel';
import DeviceStatusUpdateModal from '../components/DeviceStatusUpdateModal';
import DeviceSupportHistoryModal from '../components/DeviceSupportHistoryModal';
import { Scan, Search, History, Package, CheckCircle, XCircle, Truck, Settings, Wifi, WifiOff, User, LogOut, Lock, Moon, Sun, Warehouse, MapPin, X, Ticket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Device {
  id: string;
  device_serial_number?: string;
  qr_code?: string | null;
  status: string;
  customer_id?: string;
  location?: string | null;
  ordered_date?: string | null;
  delivered_date: string | null;
  installed_date?: string | null;
  last_online_at?: string | null;
}

interface DeviceHistory {
  id: string;
  status: string;
  changed_at: string;
  notes: string | null;
  location: string | null;
}

export default function Handheld() {
  const { user, userProfile, signOut } = useAuth();
  const { isMobile } = useDevice();
  const navigate = useNavigate();
  const [showScanner, setShowScanner] = useState(false);
  const [manualSerialNumber, setManualSerialNumber] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceHistory, setDeviceHistory] = useState<DeviceHistory[]>([]);
  const [newStatus, setNewStatus] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [scanMode, setScanMode] = useState<'status' | 'history'>('status');
  const [showHistorySearch, setShowHistorySearch] = useState(false);
  const [historySearchSerial, setHistorySearchSerial] = useState('');
  const [panelsExpanded, setPanelsExpanded] = useState(false);
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [allSaleItems, setAllSaleItems] = useState<{ id: string }[]>([]);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);

  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    const isDark = savedMode === null ? true : savedMode === 'true';
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    loadDashboardStats();

    const devicesChannel = supabase
      .channel('handheld-devices-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices' },
        () => { loadDashboardStats(); }
      )
      .subscribe();

    const saleItemsChannel = supabase
      .channel('handheld-sale-items-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sale_items' },
        () => { loadDashboardStats(); }
      )
      .subscribe();

    const ticketsChannel = supabase
      .channel('handheld-tickets-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        () => { loadDashboardStats(); }
      )
      .subscribe();

    return () => {
      devicesChannel.unsubscribe();
      saleItemsChannel.unsubscribe();
      ticketsChannel.unsubscribe();
    };
  }, []);

  const loadDashboardStats = async () => {
    try {
      const [devicesRes, saleItemsRes, ticketsRes] = await Promise.all([
        supabase.from('devices').select('id, status, delivered_date'),
        supabase.from('sale_items').select('id'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]);

      setAllDevices(devicesRes.data || []);
      setAllSaleItems(saleItemsRes.data || []);
      setOpenTicketsCount(ticketsRes.count || 0);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', String(newDarkMode));
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      navigate('/login');
    }
  };


  const handleScanSuccess = async (qrCode: string) => {
    setShowScanner(false);
    if (scanMode === 'history') {
      await loadDeviceForHistory(qrCode);
    } else {
      await loadDeviceByQR(qrCode);
    }
  };

  const handleManualSearch = async () => {
    if (!manualSerialNumber.trim()) {
      setError('Please enter a serial number');
      return;
    }
    await loadDeviceBySerial(manualSerialNumber.trim());
  };

  const loadDeviceByQR = async (qrCode: string) => {
    setLoading(true);
    setError(null);
    try {
      let { data, error: fetchError } = await supabase
        .from('devices')
        .select('*')
        .eq('qr_code', qrCode)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        const { data: serialData, error: serialError } = await supabase
          .from('devices')
          .select('*')
          .eq('device_serial_number', qrCode)
          .maybeSingle();

        if (serialError) throw serialError;

        if (serialData) {
          data = serialData;
        } else {
          setError('Device not found with this QR code');
          return;
        }
      }

      setSelectedDevice(data);
      setNewStatus(data.status);
      setLocation(data.location || '');
      setShowStatusModal(true);
      await loadDeviceHistory(data.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDeviceBySerial = async (serialNumber: string) => {
    setLoading(true);
    setError(null);
    try {
      let { data, error: fetchError } = await supabase
        .from('devices')
        .select('*')
        .eq('device_serial_number', serialNumber)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        const { data: saleItemData, error: saleError } = await supabase
          .from('sale_items')
          .select(`
            serial_number,
            sale_id,
            sales!inner(customer_id, customers(customer_name))
          `)
          .eq('serial_number', serialNumber)
          .maybeSingle();

        if (saleError) throw saleError;

        if (saleItemData) {
          const now = new Date().toISOString();
          const { data: newDevice, error: createError } = await supabase
            .from('devices')
            .insert({
              device_serial_number: serialNumber,
              customer_id: (saleItemData.sales as any).customer_id,
              status: 'ready_for_dispatch',
              created_at: now,
              updated_at: now,
            })
            .select()
            .single();

          if (createError) throw createError;
          data = newDevice;
        } else {
          setError('Device not found with this serial number');
          return;
        }
      }

      setSelectedDevice(data);
      setNewStatus(data.status);
      setLocation(data.location || '');
      setShowStatusModal(true);
      await loadDeviceHistory(data.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDeviceForHistory = async (qrCode: string) => {
    setLoading(true);
    setError(null);
    try {
      let { data, error: fetchError } = await supabase
        .from('devices')
        .select('*')
        .eq('qr_code', qrCode)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        const { data: serialData, error: serialError } = await supabase
          .from('devices')
          .select('*')
          .eq('device_serial_number', qrCode)
          .maybeSingle();

        if (serialError) throw serialError;

        if (serialData) {
          data = serialData;
        } else {
          setError('Device not found with this QR code');
          setLoading(false);
          return;
        }
      }

      setSelectedDevice(data);
      await loadDeviceHistory(data.id);
      setShowHistoryModal(true);
      setShowHistorySearch(false);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const loadDeviceForHistoryBySerial = async (serialNumber: string) => {
    setLoading(true);
    setError(null);
    try {
      let { data, error: fetchError } = await supabase
        .from('devices')
        .select('*')
        .eq('device_serial_number', serialNumber)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        const { data: saleItemData, error: saleError } = await supabase
          .from('sale_items')
          .select(`
            serial_number,
            sale_id,
            sales!inner(customer_id, customers(customer_name))
          `)
          .eq('serial_number', serialNumber)
          .maybeSingle();

        if (saleError) throw saleError;

        if (saleItemData) {
          const now = new Date().toISOString();
          const { data: newDevice, error: createError } = await supabase
            .from('devices')
            .insert({
              device_serial_number: serialNumber,
              customer_id: (saleItemData.sales as any).customer_id,
              status: 'ready_for_dispatch',
              created_at: now,
              updated_at: now,
            })
            .select()
            .single();

          if (createError) throw createError;
          data = newDevice;
        } else {
          setError('Device not found with this serial number');
          setLoading(false);
          return;
        }
      }

      setSelectedDevice(data);
      await loadDeviceHistory(data.id);
      setShowHistoryModal(true);
      setShowHistorySearch(false);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleHistorySearch = async () => {
    if (!historySearchSerial.trim()) {
      setError('Please enter a serial number');
      return;
    }
    await loadDeviceForHistoryBySerial(historySearchSerial.trim());
  };

  const loadDeviceHistory = async (deviceId: string) => {
    try {
      const { data, error: historyError } = await supabase
        .from('device_history')
        .select('*')
        .eq('device_id', deviceId)
        .order('changed_at', { ascending: false })
        .limit(10);

      if (historyError) throw historyError;
      setDeviceHistory(data || []);
    } catch (err: any) {
      console.error('Error loading device history:', err);
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 border-t-[3px] relative" style={{ borderTopColor: '#b5272d' }}>
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

      <div className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/cajo_a.png"
                alt="Cajo Logo"
                className="w-10 h-10 object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cajo Handheld</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">Laser status & updates</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center"
                aria-label="Toggle dark mode"
              >
                {darkMode ? (
                  <Sun className="w-6 h-6 text-slate-400" />
                ) : (
                  <Moon className="w-6 h-6 text-slate-600" />
                )}
              </button>
              <button
                onClick={() => setShowHistorySearch(true)}
                className="p-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center justify-center"
                aria-label="View Device History"
                title="View Device History"
              >
                <History className="w-6 h-6" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  {userProfile?.profile_pic ? (
                    <img
                      src={userProfile.profile_pic}
                      alt="Profile"
                      className="w-8 h-8 rounded-full object-cover border-2 border-green-600"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {userProfile?.name?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                  )}
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-20">
                      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {userProfile?.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {userProfile?.email}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowEditProfile(true);
                        }}
                        className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <User className="w-4 h-4" />
                        <span>Edit Profile</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowChangePassword(true);
                        }}
                        className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Change Password</span>
                      </button>

                      <div className="border-t border-slate-200 dark:border-slate-700 my-1" />

                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex flex-col items-center justify-center">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg mb-2">
                <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 text-center">Lasers Ordered</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{allSaleItems.length}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex flex-col items-center justify-center">
              <div className="p-3 bg-cyan-100 dark:bg-cyan-900/20 rounded-lg mb-2">
                <Warehouse className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 text-center">Lasers Ready</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {allDevices.filter(d => d.status === 'ready_for_dispatch').length}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex flex-col items-center justify-center">
              <div className="p-3 bg-violet-100 dark:bg-violet-900/20 rounded-lg mb-2">
                <Truck className="w-6 h-6 text-violet-600 dark:text-violet-400" />
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 text-center">Lasers Dispatched</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {allDevices.filter(d => d.status === 'dispatched').length}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex flex-col items-center justify-center">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg mb-2">
                <MapPin className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 text-center">Lasers Delivered</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {allDevices.filter(d => d.delivered_date !== null).length}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex flex-col items-center justify-center">
              <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg mb-2">
                <WifiOff className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 text-center">Lasers Offline/Online</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-0.5">
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">
                    {allDevices.filter(d => d.status === 'offline').length}
                  </p>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">OFF</span>
                </div>
                <span className="text-slate-400">/</span>
                <div className="flex items-center gap-0.5">
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    {allDevices.filter(d => d.status === 'online').length}
                  </p>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">ON</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex flex-col items-center justify-center">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg mb-2">
                <Ticket className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 text-center">Open Tickets</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{openTicketsCount}</p>
            </div>
          </div>
        </div>

        {!selectedDevice && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Find Device</h2>

            <button
              onClick={() => {
                setScanMode('status');
                setShowScanner(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors mb-4"
            >
              <Scan className="w-5 h-5" />
              Scan QR Code
            </button>

            <div className="relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={manualSerialNumber}
                    onChange={(e) => setManualSerialNumber(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                    placeholder="Enter serial number"
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <button
                  onClick={handleManualSearch}
                  disabled={loading}
                  className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Search
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>
        )}

      </div>

      {showScanner && (
        <QRScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowScanner(false)}
          title="Scan Device QR Code"
        />
      )}

      {showEditProfile && <EditProfilePanel onClose={() => setShowEditProfile(false)} />}
      {showChangePassword && <ChangePasswordPanel onClose={() => setShowChangePassword(false)} />}

      {showStatusModal && selectedDevice && (
        <DeviceStatusUpdateModal
          device={selectedDevice}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedDevice(null);
            setManualSerialNumber('');
            setError(null);
          }}
          onSuccess={() => {
            setSuccess('Device status updated successfully');
            setTimeout(() => setSuccess(null), 3000);
          }}
        />
      )}

      {showHistoryModal && selectedDevice && (
        <DeviceSupportHistoryModal
          device={selectedDevice}
          onClose={() => {
            setShowHistoryModal(false);
            setSelectedDevice(null);
          }}
        />
      )}

      {success && !showStatusModal && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 flex items-center gap-2 shadow-lg">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
          </div>
        </div>
      )}

      {showHistorySearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">View Device History</h2>
              <button
                onClick={() => {
                  setShowHistorySearch(false);
                  setHistorySearchSerial('');
                  setError(null);
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Scan a QR code or manually enter a serial number to view the device's full operational history.
              </p>

              <button
                onClick={() => {
                  setScanMode('history');
                  setShowHistorySearch(false);
                  setShowScanner(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                <Scan className="w-5 h-5" />
                Scan QR Code
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-300 dark:border-slate-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-slate-800 text-slate-500">or</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Enter Serial Number
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={historySearchSerial}
                      onChange={(e) => setHistorySearchSerial(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleHistorySearch()}
                      placeholder="Enter serial number"
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <button
                    onClick={handleHistorySearch}
                    disabled={loading}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    Search
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
