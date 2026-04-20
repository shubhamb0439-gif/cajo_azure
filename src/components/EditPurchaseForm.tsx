import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import SidePanel from './SidePanel';
import type { Database } from '../lib/database.types';

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

interface InventoryItem {
  id: string;
  item_id: string;
  item_name: string;
  item_stock_current: number;
}

interface EditPurchaseItem {
  id?: string;
  item_id: string;
  vendor_item_code: string;
  quantity: number;
  quantity_received: number;
  unit_cost: number;
  lead_time: number;
  received: boolean;
  originalQuantity?: number;
  originalQuantityReceived?: number;
  toDelete?: boolean;
}

interface Props {
  purchase: Purchase;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditPurchaseForm({ purchase, onClose, onSuccess }: Props) {
  const { userProfile } = useAuth();
  const { formatAmount, getCurrencySymbol } = useCurrency();
  const [purchaseDate, setPurchaseDate] = useState(purchase.purchase_date.split('T')[0]);
  const [poNumber, setPoNumber] = useState(purchase.purchase_po_number || '');
  const [vendorId, setVendorId] = useState(purchase.purchase_vendor_id || '');
  const [items, setItems] = useState<EditPurchaseItem[]>([]);
  const [vendors, setVendors] = useState<Database['public']['Tables']['vendors']['Row'][]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [vendorsRes, inventoryRes] = await Promise.all([
      supabase.from('vendors').select('*').order('vendor_name'),
      supabase.from('inventory_items').select('id, item_id, item_name, item_stock_current').order('item_name')
    ]);

    if (vendorsRes.data) setVendors(vendorsRes.data);
    if (inventoryRes.data) setInventoryItems(inventoryRes.data);

    const editableItems: EditPurchaseItem[] = purchase.purchase_items.map(item => ({
      id: item.id,
      item_id: item.inventory_items.id,
      vendor_item_code: item.vendor_item_code || '',
      quantity: item.quantity,
      quantity_received: item.quantity_received || 0,
      unit_cost: item.unit_cost,
      lead_time: item.lead_time,
      received: item.quantity_received >= item.quantity,
      originalQuantity: item.quantity,
      originalQuantityReceived: item.quantity_received || 0,
    }));

    setItems(editableItems);
  };

  const addItem = () => {
    setItems([...items, {
      item_id: '',
      vendor_item_code: '',
      quantity: 1,
      quantity_received: 0,
      unit_cost: 0,
      lead_time: 0,
      received: false,
    }]);
  };

  const removeItem = (index: number) => {
    const item = items[index];
    const activeItems = items.filter(it => !it.toDelete);

    if (activeItems.length <= 1) {
      setError('Cannot remove the last item. A purchase must have at least one item.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (item.id) {
      if (item.quantity_received > 0) {
        const confirmDelete = window.confirm(
          `This item has ${item.quantity_received} units received and in stock. Deleting it will reduce the stock count. Are you sure you want to delete it?`
        );
        if (!confirmDelete) return;
      }
      setItems(items.map((it, i) => i === index ? { ...it, toDelete: true } : it));
    } else {
      setItems(items.filter((_, i) => i !== index));
    }
    setError('');
  };

  const updateItem = (index: number, field: keyof EditPurchaseItem, value: string | number | boolean) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const calculateTotal = () => {
    return items
      .filter(item => !item.toDelete)
      .reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const activeItems = items.filter(item => !item.toDelete);
    if (activeItems.length === 0) {
      setError('At least one item is required');
      return;
    }

    const hasInvalidItem = activeItems.some(item => !item.item_id || item.quantity <= 0);
    if (hasInvalidItem) {
      setError('All items must have a valid product and quantity greater than 0');
      return;
    }

    setLoading(true);

    try {
      await supabase
        .from('purchases')
        .update({
          purchase_date: purchaseDate,
          purchase_po_number: poNumber || null,
          purchase_vendor_id: vendorId || null,
          updated_by: userProfile?.id,
        })
        .eq('id', purchase.id);

      for (const item of items) {
        if (item.toDelete && item.id) {
          if ((item.originalQuantityReceived || 0) > 0) {
            const inventoryItem = inventoryItems.find(inv => inv.id === item.item_id);
            if (inventoryItem) {
              const newStock = inventoryItem.item_stock_current - (item.originalQuantityReceived || 0);

              const { data: allReceivedItems } = await supabase
                .from('purchase_items')
                .select('quantity_received, unit_cost, lead_time')
                .eq('item_id', item.item_id)
                .gt('quantity_received', 0)
                .neq('id', item.id);

              let totalCost = 0;
              let totalLeadTimeWeighted = 0;
              let totalQty = 0;

              if (allReceivedItems) {
                allReceivedItems.forEach((receivedItem) => {
                  totalCost += receivedItem.quantity_received * receivedItem.unit_cost;
                  totalLeadTimeWeighted += receivedItem.quantity_received * receivedItem.lead_time;
                  totalQty += receivedItem.quantity_received;
                });
              }

              const newAvgCost = totalQty > 0 ? totalCost / totalQty : 0;
              const newAvgLeadTime = totalQty > 0 ? totalLeadTimeWeighted / totalQty : 0;

              await supabase
                .from('inventory_items')
                .update({
                  item_stock_current: newStock,
                  item_cost_average: newAvgCost,
                  item_lead_time_average: newAvgLeadTime,
                  updated_by: userProfile?.id,
                })
                .eq('id', item.item_id);
            }
          }

          await supabase.from('purchase_items').delete().eq('id', item.id);
          continue;
        }

        if (item.id) {
          const stockDiff = item.quantity_received - (item.originalQuantityReceived || 0);

          await supabase
            .from('purchase_items')
            .update({
              item_id: item.item_id,
              vendor_item_code: item.vendor_item_code || null,
              quantity: item.quantity,
              quantity_received: item.quantity_received,
              unit_cost: item.unit_cost,
              lead_time: item.lead_time,
              updated_by: userProfile?.id,
            })
            .eq('id', item.id);

          if (stockDiff !== 0) {
            const inventoryItem = inventoryItems.find(inv => inv.id === item.item_id);
            if (inventoryItem) {
              const newStock = inventoryItem.item_stock_current + stockDiff;

              const { data: allReceivedItems } = await supabase
                .from('purchase_items')
                .select('quantity_received, unit_cost, lead_time')
                .eq('item_id', item.item_id)
                .gt('quantity_received', 0);

              let totalCost = 0;
              let totalLeadTimeWeighted = 0;
              let totalQty = 0;

              if (allReceivedItems) {
                allReceivedItems.forEach((receivedItem) => {
                  totalCost += receivedItem.quantity_received * receivedItem.unit_cost;
                  totalLeadTimeWeighted += receivedItem.quantity_received * receivedItem.lead_time;
                  totalQty += receivedItem.quantity_received;
                });
              }

              const newAvgCost = totalQty > 0 ? totalCost / totalQty : 0;
              const newAvgLeadTime = totalQty > 0 ? totalLeadTimeWeighted / totalQty : 0;

              await supabase
                .from('inventory_items')
                .update({
                  item_stock_current: newStock,
                  item_cost_average: newAvgCost,
                  item_lead_time_average: newAvgLeadTime,
                  updated_by: userProfile?.id,
                })
                .eq('id', item.item_id);
            }
          }
        } else {
          const { data: newItem } = await supabase
            .from('purchase_items')
            .insert({
              purchase_id: purchase.id,
              item_id: item.item_id,
              vendor_item_code: item.vendor_item_code || null,
              quantity: item.quantity,
              quantity_received: item.quantity_received,
              unit_cost: item.unit_cost,
              lead_time: item.lead_time,
              created_by: userProfile?.id,
            })
            .select()
            .single();

          if (item.quantity_received > 0 && newItem) {
            const inventoryItem = inventoryItems.find(inv => inv.id === item.item_id);
            if (inventoryItem) {
              const newStock = inventoryItem.item_stock_current + item.quantity_received;

              const { data: allReceivedItems } = await supabase
                .from('purchase_items')
                .select('quantity_received, unit_cost, lead_time')
                .eq('item_id', item.item_id)
                .gt('quantity_received', 0);

              let totalCost = 0;
              let totalLeadTimeWeighted = 0;
              let totalQty = 0;

              if (allReceivedItems) {
                allReceivedItems.forEach((receivedItem) => {
                  totalCost += receivedItem.quantity_received * receivedItem.unit_cost;
                  totalLeadTimeWeighted += receivedItem.quantity_received * receivedItem.lead_time;
                  totalQty += receivedItem.quantity_received;
                });
              }

              const newAvgCost = totalQty > 0 ? totalCost / totalQty : 0;
              const newAvgLeadTime = totalQty > 0 ? totalLeadTimeWeighted / totalQty : 0;

              await supabase
                .from('inventory_items')
                .update({
                  item_stock_current: newStock,
                  item_cost_average: newAvgCost,
                  item_lead_time_average: newAvgLeadTime,
                  updated_by: userProfile?.id,
                })
                .eq('id', item.item_id);
            }
          }
        }
      }

      await supabase.from('activity_logs').insert({
        user_id: userProfile?.id,
        action: 'UPDATE_PURCHASE',
        details: {
          purchaseId: purchase.id,
          poNumber: poNumber,
          itemCount: activeItems.length,
        },
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error updating purchase:', error);
      setError(error.message || 'Failed to update purchase');
    } finally {
      setLoading(false);
    }
  };

  const visibleItems = items.filter(item => !item.toDelete);

  return (
    <SidePanel isOpen={true} onClose={onClose} title="Edit Purchase">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-800 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Purchase Date
          </label>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            PO Number
          </label>
          <input
            type="text"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
            placeholder="Optional"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Vendor
          </label>
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
          >
            <option value="">Select Vendor (Optional)</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.vendor_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Items ({visibleItems.length})
            </label>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>

          <div className="space-y-3">
            {visibleItems.map((item, index) => {
              const actualIndex = items.indexOf(item);
              return (
                <div key={actualIndex} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <select
                        value={item.item_id}
                        onChange={(e) => updateItem(actualIndex, 'item_id', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white text-sm"
                        required
                        disabled={item.received}
                      >
                        <option value="">Select Item</option>
                        {inventoryItems.map((invItem) => {
                          const displayName = invItem.item_name.length > 40
                            ? invItem.item_name.substring(0, 40) + '...'
                            : invItem.item_name;
                          return (
                            <option key={invItem.id} value={invItem.id}>
                              {displayName} ({invItem.item_id})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(actualIndex)}
                      className="flex-shrink-0 p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title={item.received ? "Delete item (will reduce stock)" : "Delete item"}
                      disabled={visibleItems.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Vendor Code
                      </label>
                      <input
                        type="text"
                        value={item.vendor_item_code}
                        onChange={(e) => updateItem(actualIndex, 'vendor_item_code', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white text-sm"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Lead Time (days)
                      </label>
                      <input
                        type="number"
                        value={item.lead_time}
                        onChange={(e) => updateItem(actualIndex, 'lead_time', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white text-sm"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Quantity Ordered
                      </label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => {
                          const newQty = parseFloat(e.target.value) || 1;
                          updateItem(actualIndex, 'quantity', newQty);
                          if (item.quantity_received > newQty) {
                            updateItem(actualIndex, 'quantity_received', newQty);
                          }
                        }}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white text-sm"
                        min="0.01"
                        step="0.01"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Quantity Received
                      </label>
                      <input
                        type="number"
                        value={item.quantity_received}
                        onChange={(e) => updateItem(actualIndex, 'quantity_received', Math.min(parseFloat(e.target.value) || 0, item.quantity))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white text-sm"
                        min="0"
                        max={item.quantity}
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Remaining
                      </label>
                      <div className="px-3 py-2 bg-slate-100 dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg text-slate-900 dark:text-white font-medium text-sm">
                        {(item.quantity - item.quantity_received).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Unit Cost
                      </label>
                      <input
                        type="number"
                        value={item.unit_cost}
                        onChange={(e) => updateItem(actualIndex, 'unit_cost', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white text-sm"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Subtotal
                      </label>
                      <div className="px-3 py-2 bg-slate-100 dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg text-slate-900 dark:text-white font-medium text-sm">
                        {getCurrencySymbol()}{formatAmount(item.quantity * item.unit_cost)}
                      </div>
                    </div>
                  </div>

                  {item.quantity_received >= item.quantity && (
                    <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                      <span className="font-medium">Fully Received</span>
                    </div>
                  )}
                  {item.quantity_received > 0 && item.quantity_received < item.quantity && (
                    <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                      <span className="font-medium">Partially Received ({((item.quantity_received / item.quantity) * 100).toFixed(0)}%)</span>
                    </div>
                  )}
                  {item.quantity_received === 0 && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
                      <span className="font-medium">Not Yet Received</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Total:</span>
            <span className="text-2xl font-bold text-green-700 dark:text-green-400">
              {getCurrencySymbol()}{formatAmount(calculateTotal())}
            </span>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update Purchase'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </SidePanel>
  );
}
