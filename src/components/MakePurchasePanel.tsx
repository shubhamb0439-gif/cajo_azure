import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { Plus, Trash2 } from 'lucide-react';
import type { Database } from '../lib/database.types';
import SidePanel from './SidePanel';

interface MakePurchasePanelProps {
  initialItemId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MakePurchasePanel({ initialItemId, onClose, onSuccess }: MakePurchasePanelProps) {
  const { userProfile } = useAuth();
  const { formatAmount, getCurrencySymbol } = useCurrency();
  const [vendors, setVendors] = useState<Database['public']['Tables']['vendors']['Row'][]>([]);
  const [items, setItems] = useState<Database['public']['Tables']['inventory_items']['Row'][]>([]);
  const [sortedItems, setSortedItems] = useState<Database['public']['Tables']['inventory_items']['Row'][]>([]);
  const [formData, setFormData] = useState({
    vendor_id: '',
    po_number: '',
    purchase_date: new Date().toISOString().split('T')[0],
  });
  const [purchaseItems, setPurchaseItems] = useState<Array<{
    item_id: string;
    vendor_item_code: string;
    quantity: number;
    unit_cost: number;
    lead_time: number;
  }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialItemId && items.length > 0) {
      (async () => {
        const { data } = await supabase
          .from('purchase_items')
          .select('vendor_item_code')
          .eq('item_id', initialItemId)
          .not('vendor_item_code', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setPurchaseItems([{
          item_id: initialItemId,
          vendor_item_code: data?.vendor_item_code || '',
          quantity: 1,
          unit_cost: 0,
          lead_time: 0,
        }]);
      })();
    }
  }, [initialItemId, items]);

  const loadData = async () => {
    const [vendorsRes, itemsRes] = await Promise.all([
      supabase.from('vendors').select('*').order('vendor_name'),
      supabase.from('inventory_items').select('*').order('item_name')
    ]);
    if (vendorsRes.data) setVendors(vendorsRes.data);
    if (itemsRes.data) {
      setItems(itemsRes.data);
      setSortedItems(itemsRes.data);
    }
  };

  const sortItemsByVendor = async (vendorId: string) => {
    if (!vendorId || items.length === 0) {
      setSortedItems(items);
      return;
    }

    const { data: vendorPurchases } = await supabase
      .from('purchase_items')
      .select('item_id, purchases!inner(purchase_vendor_id)')
      .eq('purchases.purchase_vendor_id', vendorId);

    if (vendorPurchases && vendorPurchases.length > 0) {
      const vendorItemIds = new Set(vendorPurchases.map(p => p.item_id));

      const vendorItems = items.filter(item => vendorItemIds.has(item.id));
      const otherItems = items.filter(item => !vendorItemIds.has(item.id));

      setSortedItems([...vendorItems, ...otherItems]);
    } else {
      setSortedItems(items);
    }
  };

  const addItem = () => {
    setPurchaseItems([...purchaseItems, {
      item_id: '',
      vendor_item_code: '',
      quantity: 1,
      unit_cost: 0,
      lead_time: 0,
    }]);
  };

  const removeItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const updateItem = async (index: number, field: string, value: any) => {
    const newItems = [...purchaseItems];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'item_id' && value) {
      if (formData.vendor_id) {
        const { data } = await supabase
          .from('purchase_items')
          .select('vendor_item_code, purchases!inner(purchase_vendor_id)')
          .eq('item_id', value)
          .eq('purchases.purchase_vendor_id', formData.vendor_id)
          .not('vendor_item_code', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.vendor_item_code) {
          newItems[index].vendor_item_code = data.vendor_item_code;
        }
      } else {
        const { data } = await supabase
          .from('purchase_items')
          .select('vendor_item_code')
          .eq('item_id', value)
          .not('vendor_item_code', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.vendor_item_code) {
          newItems[index].vendor_item_code = data.vendor_item_code;
        }
      }
    }

    setPurchaseItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (purchaseItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    if (purchaseItems.some(item => !item.item_id || item.quantity <= 0 || item.unit_cost < 0)) {
      alert('Please fill all item details correctly');
      return;
    }

    setLoading(true);

    try {
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          purchase_vendor_id: formData.vendor_id || null,
          purchase_po_number: formData.po_number || null,
          purchase_date: formData.purchase_date,
          created_by: userProfile?.id,
        })
        .select()
        .single();

      if (purchaseError || !purchase) throw purchaseError || new Error('Failed to create purchase');

      const itemsToInsert = purchaseItems.map(item => ({
        purchase_id: purchase.id,
        item_id: item.item_id,
        vendor_item_code: item.vendor_item_code || null,
        quantity: item.quantity,
        quantity_received: 0,
        unit_cost: item.unit_cost,
        lead_time: item.lead_time,
        created_by: userProfile?.id,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      await supabase.from('activity_logs').insert({
        user_id: userProfile?.id,
        action: 'CREATE_PURCHASE',
        details: {
          purchaseId: purchase.id,
          poNumber: formData.po_number,
          itemCount: purchaseItems.length,
        },
      });

      onSuccess();
    } catch (error) {
      console.error('Error creating purchase:', error);
      alert('Failed to create purchase');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return purchaseItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  };

  const handleVendorChange = async (vendorId: string) => {
    setFormData({ ...formData, vendor_id: vendorId });

    await sortItemsByVendor(vendorId);

    if (vendorId && purchaseItems.length > 0) {
      const updatedItems = await Promise.all(
        purchaseItems.map(async (item) => {
          if (!item.item_id) return item;

          const { data } = await supabase
            .from('purchase_items')
            .select('vendor_item_code, purchases!inner(purchase_vendor_id)')
            .eq('item_id', item.item_id)
            .eq('purchases.purchase_vendor_id', vendorId)
            .not('vendor_item_code', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (data?.vendor_item_code) {
            return { ...item, vendor_item_code: data.vendor_item_code };
          }
          return item;
        })
      );
      setPurchaseItems(updatedItems);
    }
  };

  return (
    <SidePanel isOpen={true} onClose={onClose} title="Make Purchase" width="wide">
      <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Vendor
              </label>
              <select
                value={formData.vendor_id}
                onChange={(e) => handleVendorChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                PO Number
              </label>
              <input
                type="text"
                value={formData.po_number}
                onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                placeholder="Optional"
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Purchase Date *
              </label>
              <input
                type="date"
                value={formData.purchase_date}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-slate-900 dark:text-white">Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </button>
            </div>

            <div className="space-y-4">
              {purchaseItems.map((item, index) => (
                <div key={index} className="border border-slate-200 dark:border-slate-700 rounded-lg p-5">
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-5">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Item *
                      </label>
                      <select
                        value={item.item_id}
                        onChange={(e) => updateItem(index, 'item_id', e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
                      >
                        <option value="">Select Item</option>
                        {sortedItems.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.item_name} ({i.item_id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Vendor Code
                      </label>
                      <input
                        type="text"
                        value={item.vendor_item_code}
                        onChange={(e) => updateItem(index, 'vendor_item_code', e.target.value)}
                        placeholder="Optional"
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                        required
                        min="0.01"
                        step="0.01"
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Lead Time
                      </label>
                      <input
                        type="number"
                        value={item.lead_time}
                        onChange={(e) => updateItem(index, 'lead_time', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                        min="0"
                        step="1"
                        placeholder="Days"
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-4 mt-4">
                    <div className="col-span-3">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Unit Cost *
                      </label>
                      <input
                        type="number"
                        value={item.unit_cost}
                        onChange={(e) => updateItem(index, 'unit_cost', parseFloat(e.target.value))}
                        onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                        required
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Line Total
                      </label>
                      <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium">
                        {getCurrencySymbol()}{formatAmount(item.quantity * item.unit_cost)}
                      </div>
                    </div>

                    <div className="col-span-6 flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="px-4 py-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove Item
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {purchaseItems.length === 0 && (
                <p className="text-center text-slate-500 py-8">No items added yet</p>
              )}
            </div>
          </div>

          {purchaseItems.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Purchase Cost</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {getCurrencySymbol()}{formatAmount(calculateTotal())}
              </p>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Purchase'}
            </button>
          </div>
        </form>
    </SidePanel>
  );
}
