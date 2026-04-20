import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/dateUtils';
import { Search, Trash2, Filter, ChevronDown, ChevronRight, Plus, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import type { Database } from '../lib/database.types';
import MakePurchasePanel from '../components/MakePurchasePanel';
import EditPurchaseForm from '../components/EditPurchaseForm';

interface PurchaseItem {
  id: string;
  item_id: string;
  vendor_item_code: string | null;
  quantity: number;
  quantity_received: number;
  unit_cost: number;
  lead_time: number;
  received: boolean;
  inventory_items: { id: string; item_id: string; item_name: string; item_stock_current: number };
}

interface Purchase {
  id: string;
  purchase_vendor_id: string | null;
  purchase_date: string;
  purchase_po_number: string | null;
  vendors: { vendor_name: string } | null;
  purchase_items: PurchaseItem[];
}

type FilterType = 'all' | 'purchases' | 'receipts';

export default function Purchases() {
  const location = useLocation();
  const { userProfile, hasWriteAccess } = useAuth();
  const { formatAmount, getCurrencySymbol, isViewOnly } = useCurrency();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [filtered, setFiltered] = useState<Purchase[]>([]);
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterType>('all');
  const [vendors, setVendors] = useState<Database['public']['Tables']['vendors']['Row'][]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPurchases, setExpandedPurchases] = useState<Set<string>>(new Set());
  const [showMakePurchase, setShowMakePurchase] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);

  useEffect(() => {
    loadData();

    const state = location.state as { itemId?: string };
    if (state?.itemId) {
      setSelectedItemId(state.itemId);
      setShowMakePurchase(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    let result = purchases;
    if (search) {
      result = result.filter(p =>
        p.vendors?.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
        p.purchase_po_number?.toLowerCase().includes(search.toLowerCase()) ||
        p.purchase_items.some(item =>
          item.inventory_items.item_name.toLowerCase().includes(search.toLowerCase()) ||
          item.inventory_items.item_id.toLowerCase().includes(search.toLowerCase())
        )
      );
    }
    if (vendorFilter) {
      result = result.filter(p => p.purchase_vendor_id === vendorFilter);
    }
    if (statusFilter === 'purchases') {
      result = result.filter(p => p.purchase_items.some(item => item.quantity_received < item.quantity));
    } else if (statusFilter === 'receipts') {
      result = result.filter(p => p.purchase_items.every(item => item.quantity_received >= item.quantity));
    }
    setFiltered(result);
  }, [purchases, search, vendorFilter, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    const [purchasesRes, vendorsRes] = await Promise.all([
      supabase
        .from('purchases')
        .select(`
          *,
          vendors(vendor_name),
          purchase_items(
            *,
            inventory_items(id, item_id, item_name, item_stock_current)
          )
        `)
        .order('purchase_date', { ascending: false }),
      supabase.from('vendors').select('*').order('vendor_name')
    ]);
    if (purchasesRes.data) setPurchases(purchasesRes.data as unknown as Purchase[]);
    if (vendorsRes.data) setVendors(vendorsRes.data);
    setLoading(false);
  };

  const toggleExpand = (purchaseId: string) => {
    setExpandedPurchases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(purchaseId)) {
        newSet.delete(purchaseId);
      } else {
        newSet.add(purchaseId);
      }
      return newSet;
    });
  };


  const handleDelete = async (purchase: Purchase) => {
    const receivedItems = purchase.purchase_items.filter(item => item.quantity_received > 0);

    if (receivedItems.length > 0) {
      const totalReceived = receivedItems.reduce((sum, item) => sum + item.quantity_received, 0);
      if (!confirm(`This purchase has ${totalReceived} unit(s) received across ${receivedItems.length} item(s). Deleting will reduce stock. Continue?`)) {
        return;
      }
    }

    if (!confirm(`Delete purchase ${purchase.purchase_po_number || 'without PO number'}?`)) {
      return;
    }

    try {
      for (const item of receivedItems) {
        const newStock = item.inventory_items.item_stock_current - item.quantity_received;

        await supabase
          .from('inventory_items')
          .update({
            item_stock_current: newStock,
            updated_by: userProfile?.id,
          })
          .eq('id', item.inventory_items.id);
      }

      await supabase.from('purchases').delete().eq('id', purchase.id);

      await supabase.from('activity_logs').insert({
        user_id: userProfile?.id,
        action: 'DELETE_PURCHASE',
        details: {
          poNumber: purchase.purchase_po_number,
          itemCount: purchase.purchase_items.length,
        },
      });

      loadData();
    } catch (error) {
      console.error('Error deleting purchase:', error);
      alert('Failed to delete purchase');
    }
  };

  const calculateTotals = (items: PurchaseItem[]) => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Purchases</h1>
        {hasWriteAccess && !isViewOnly && (
          <button
            onClick={() => {
              setSelectedItemId(null);
              setShowMakePurchase(true);
            }}
            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Make Purchase
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search purchases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div className="relative w-48">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FilterType)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white appearance-none"
            >
              <option value="all">All</option>
              <option value="purchases">Purchases</option>
              <option value="receipts">Receipts</option>
            </select>
          </div>
          <div className="relative w-64">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white appearance-none"
            >
              <option value="">All Vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.vendor_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase w-10"></th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">PO #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Vendor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Items</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filtered.map(p => (
                <>
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleExpand(p.id)}
                        className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      >
                        {expandedPurchases.has(p.id) ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                      {formatDate(p.purchase_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                      {p.purchase_po_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                      {p.vendors?.vendor_name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                      {p.purchase_items.length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                      {getCurrencySymbol()}{formatAmount(calculateTotals(p.purchase_items))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {p.purchase_items.every(item => item.quantity_received >= item.quantity) ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded">
                          Received
                        </span>
                      ) : p.purchase_items.some(item => item.quantity_received > 0) ? (
                        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 rounded">
                          Partial
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-400 rounded">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {hasWriteAccess && !isViewOnly && (
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setEditingPurchase(p)}
                            className="inline-flex items-center p-1.5 text-green-600 hover:text-green-700"
                            title="Edit Purchase"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="inline-flex items-center p-1.5 text-red-600 hover:text-red-700"
                            title="Delete Purchase"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expandedPurchases.has(p.id) && (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50">
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">Purchase Items</h4>
                          <table className="w-full">
                            <thead>
                              <tr className="text-xs text-slate-500 dark:text-slate-400">
                                <th className="text-left pb-2">Item</th>
                                <th className="text-left pb-2">Vendor Code</th>
                                <th className="text-right pb-2">Ordered</th>
                                <th className="text-right pb-2">Received</th>
                                <th className="text-right pb-2">Remaining</th>
                                <th className="text-right pb-2">Unit Cost</th>
                                <th className="text-right pb-2">Total</th>
                                <th className="text-right pb-2">Lead Time</th>
                                <th className="text-center pb-2">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                              {p.purchase_items.map(item => (
                                <tr key={item.id} className="text-sm">
                                  <td className="py-2 text-slate-900 dark:text-white">
                                    <div className="font-medium">{item.inventory_items.item_name}</div>
                                    <div className="text-xs text-slate-500">{item.inventory_items.item_id}</div>
                                  </td>
                                  <td className="py-2 text-slate-700 dark:text-slate-300">{item.vendor_item_code || '-'}</td>
                                  <td className="py-2 text-right text-slate-700 dark:text-slate-300">{item.quantity}</td>
                                  <td className="py-2 text-right text-slate-700 dark:text-slate-300">{item.quantity_received}</td>
                                  <td className="py-2 text-right text-slate-700 dark:text-slate-300">{(item.quantity - item.quantity_received).toFixed(2)}</td>
                                  <td className="py-2 text-right text-slate-700 dark:text-slate-300">{getCurrencySymbol()}{formatAmount(item.unit_cost)}</td>
                                  <td className="py-2 text-right font-medium text-slate-900 dark:text-white">
                                    {getCurrencySymbol()}{formatAmount(item.quantity * item.unit_cost)}
                                  </td>
                                  <td className="py-2 text-right text-slate-700 dark:text-slate-300">{item.lead_time} days</td>
                                  <td className="py-2 text-center">
                                    {item.quantity_received >= item.quantity ? (
                                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded">
                                        Complete
                                      </span>
                                    ) : item.quantity_received > 0 ? (
                                      <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 rounded">
                                        {((item.quantity_received / item.quantity) * 100).toFixed(0)}%
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-400 rounded">
                                        Pending
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12"><p className="text-slate-500">No purchases found</p></div>}
        </div>
      </div>

      {showMakePurchase && (
        <MakePurchasePanel
          initialItemId={selectedItemId}
          onClose={() => setShowMakePurchase(false)}
          onSuccess={() => {
            setShowMakePurchase(false);
            loadData();
          }}
        />
      )}

      {editingPurchase && (
        <EditPurchaseForm
          purchase={editingPurchase}
          onClose={() => setEditingPurchase(null)}
          onSuccess={() => {
            setEditingPurchase(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
