import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SidePanel from './SidePanel';

interface Customer {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
}

interface BOM {
  id: string;
  bom_name: string;
  bom_item_id: string;
  inventory_items?: {
    item_name: string;
  };
}

interface POItem {
  id?: string;
  bom_id: string;
  quantity: number;
  unit_price: number;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  customer_id: string;
  delivery_date: string | null;
  payment_terms: string;
  notes: string;
  status: string;
  customers: {
    customer_name: string;
    customer_email: string | null;
    customer_phone: string | null;
    customer_address: string | null;
  };
  purchase_order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    bom_id: string;
    boms: {
      bom_name: string;
      inventory_items: {
        item_name: string;
      };
    };
  }[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: PurchaseOrder;
  onSuccess: () => void;
}

export default function EditPurchaseOrderForm({ isOpen, onClose, order, onSuccess }: Props) {
  const { userProfile } = useAuth();
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [poItems, setPoItems] = useState<POItem[]>([]);
  const [boms, setBoms] = useState<BOM[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && order) {
      setDeliveryDate(order.delivery_date || '');
      setPaymentTerms(order.payment_terms || '');
      setNotes(order.notes || '');
      setPoItems(order.purchase_order_items.map(item => ({
        id: item.id,
        bom_id: item.bom_id,
        quantity: item.quantity,
        unit_price: item.unit_price || 0
      })));
      loadBOMs();
    }
  }, [isOpen, order]);

  const loadBOMs = async () => {
    const { data, error } = await supabase
      .from('boms')
      .select('id, bom_name, bom_item_id, inventory_items(item_name)')
      .order('bom_name');

    if (error) {
      console.error('Error loading BOMs:', error);
    } else {
      setBoms(data || []);
    }
  };

  const addPOItem = () => {
    setPoItems([...poItems, { bom_id: '', quantity: 1, unit_price: 0 }]);
  };

  const removePOItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const updatePOItem = (index: number, field: keyof POItem, value: string | number) => {
    const updated = [...poItems];
    updated[index] = { ...updated[index], [field]: field === 'unit_price' ? parseFloat(value as string) || 0 : value };
    setPoItems(updated);
  };

  const calculatePOValue = () => {
    return poItems.reduce((total, item) => {
      return total + (item.quantity * item.unit_price);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const validItems = poItems.filter(item => item.bom_id && item.quantity > 0);
    if (validItems.length === 0) {
      setError('At least one BOM item with valid details is required');
      setLoading(false);
      return;
    }

    try {
      const poValue = calculatePOValue();

      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({
          delivery_date: deliveryDate || null,
          payment_terms: paymentTerms.trim(),
          notes: notes.trim(),
          po_value: poValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (poError) throw poError;

      const { error: deleteError } = await supabase
        .from('purchase_order_items')
        .delete()
        .eq('po_id', order.id);

      if (deleteError) throw deleteError;

      const itemsToInsert = validItems.map(item => ({
        po_id: order.id,
        bom_id: item.bom_id,
        quantity: item.quantity,
        unit_price: item.unit_price
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating purchase order:', err);
      setError(err.message || 'Failed to update purchase order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidePanel isOpen={isOpen} onClose={onClose} title="Edit Purchase Order">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Order Information</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-slate-600 dark:text-slate-400">PO Number:</span>
              <span className="ml-2 font-medium text-slate-900 dark:text-white">{order.po_number}</span>
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400">Customer:</span>
              <span className="ml-2 font-medium text-slate-900 dark:text-white">{order.customers.customer_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 dark:text-slate-400">Status:</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                order.status === 'fulfilled'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
              }`}>
                {order.status === 'fulfilled' ? 'Fulfilled' : 'Open'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">(Auto-calculated)</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-800 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              BOM Items *
            </label>
            <button
              type="button"
              onClick={addPOItem}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>
          <div className="space-y-3">
            {poItems.map((item, index) => (
              <div key={index} className="space-y-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      BOM
                    </label>
                    <select
                      value={item.bom_id}
                      onChange={(e) => updatePOItem(index, 'bom_id', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                      required
                    >
                      <option value="">Select BOM</option>
                      {boms.map((bom) => (
                        <option key={bom.id} value={bom.id}>
                          {bom.bom_name} - {bom.inventory_items?.item_name || 'Unknown Item'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pt-6">
                    <button
                      type="button"
                      onClick={() => removePOItem(index)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updatePOItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                      min="1"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Unit Price
                    </label>
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updatePOItem(index, 'unit_price', e.target.value)}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Subtotal
                    </label>
                    <div className="px-3 py-2 bg-slate-100 dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg text-slate-900 dark:text-white font-medium">
                      ${(item.quantity * item.unit_price).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">PO Value:</span>
            <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              ${calculatePOValue().toFixed(2)}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Delivery Date
          </label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Payment Terms
          </label>
          <textarea
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
            rows={3}
            placeholder="Enter payment terms"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
            rows={3}
            placeholder="Additional notes"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update Purchase Order'}
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
