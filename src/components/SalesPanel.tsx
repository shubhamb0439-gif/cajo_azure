import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Flag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';

interface AssemblyUnit {
  id: string;
  assembly_id: string;
  assembly_unit_number: number;
  assembly_serial_number: string;
  assembly_name: string;
}

interface SaleItem {
  assembly_unit_id: string;
  serial_number: string;
  assembly_name?: string;
  unit_price: number;
  quantity: number;
}

interface Sale {
  id: string;
  sale_number: string;
  customer_id: string;
  sale_date: string;
  sale_notes: string | null;
  sale_items: SaleItem[];
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  customer_id: string;
  delivery_date: string | null;
  status: string;
  customers: {
    customer_name: string;
  };
}

interface SalesPanelProps {
  customerId: string;
  customerName: string;
  sale?: Sale | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SalesPanel({ customerId, customerName, sale, onClose, onSuccess }: SalesPanelProps) {
  const { userProfile } = useAuth();
  const { currencyMode, toggleCurrency, formatAmount, getCurrencySymbol } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [availableUnits, setAvailableUnits] = useState<AssemblyUnit[]>([]);
  const [hasPO, setHasPO] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [formData, setFormData] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    sale_notes: '',
    po_number: '',
    unit_price: 0,
  });
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);

  useEffect(() => {
    loadAvailableUnits();
    loadOpenPurchaseOrders();
    if (sale) {
      const saleWithPO = sale as any;
      setFormData({
        sale_date: sale.sale_date,
        sale_notes: sale.sale_notes || '',
        po_number: saleWithPO.po_number || '',
        unit_price: saleWithPO.unit_price || 0,
      });
      if (saleWithPO.po_number) {
        setHasPO(true);
      }
      const items = sale.sale_items || [];
      setSaleItems(items.map((item: any) => ({
        assembly_unit_id: item.assembly_unit_id,
        serial_number: item.serial_number,
        assembly_name: item.assembly_name,
        unit_price: item.unit_price || 0,
        quantity: item.quantity || 1,
      })));
    }
  }, [sale]);

  const loadAvailableUnits = async () => {
    const { data: units } = await supabase
      .from('assembly_units')
      .select(`
        id,
        assembly_id,
        assembly_unit_number,
        assembly_serial_number,
        assemblies(assembly_name)
      `)
      .not('assembly_serial_number', 'is', null);

    if (!units) return;

    const { data: soldUnits } = await supabase
      .from('sale_items')
      .select('assembly_unit_id');

    const soldIds = new Set((soldUnits || []).map(item => item.assembly_unit_id));

    const available = units
      .filter(unit => {
        if (sale) {
          const isInCurrentSale = sale.sale_items?.some(item => item.assembly_unit_id === unit.id);
          return !soldIds.has(unit.id) || isInCurrentSale;
        }
        return !soldIds.has(unit.id);
      })
      .map(unit => ({
        id: unit.id,
        assembly_id: unit.assembly_id,
        assembly_unit_number: unit.assembly_unit_number,
        assembly_serial_number: unit.assembly_serial_number,
        assembly_name: (unit.assemblies as any)?.assembly_name || 'Unknown',
      }));

    setAvailableUnits(available);
  };

  const loadOpenPurchaseOrders = async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select('id, po_number, customer_id, delivery_date, status, customers(customer_name)')
      .eq('status', 'open')
      .order('po_number', { ascending: false });
    if (data) setPurchaseOrders(data as PurchaseOrder[]);
  };

  const addSaleItem = () => {
    if (availableUnits.length === 0) {
      alert('No available assembled products with serial numbers');
      return;
    }
    setSaleItems([...saleItems, { assembly_unit_id: '', serial_number: '', unit_price: 0, quantity: 1 }]);
  };

  const removeSaleItem = (index: number) => {
    setSaleItems(saleItems.filter((_, i) => i !== index));
  };

  const updateSaleItem = (index: number, unitId: string) => {
    const unit = availableUnits.find(u => u.id === unitId);
    if (!unit) return;

    const newItems = [...saleItems];
    newItems[index] = {
      ...newItems[index],
      assembly_unit_id: unitId,
      serial_number: unit.assembly_serial_number,
      assembly_name: unit.assembly_name,
    };
    setSaleItems(newItems);
  };

  const updateSaleItemPrice = (index: number, price: string) => {
    const newItems = [...saleItems];
    newItems[index] = {
      ...newItems[index],
      unit_price: parseFloat(price) || 0,
    };
    setSaleItems(newItems);
  };

  const updateSaleItemQuantity = (index: number, quantity: string) => {
    const newItems = [...saleItems];
    newItems[index] = {
      ...newItems[index],
      quantity: parseInt(quantity) || 1,
    };
    setSaleItems(newItems);
  };

  const calculateSaleValue = () => {
    if (hasPO) {
      return saleItems.reduce((total, item) => total + (formData.unit_price * item.quantity), 0);
    } else {
      return saleItems.reduce((total, item) => total + (item.unit_price * item.quantity), 0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (saleItems.length === 0) {
      alert('Please add at least one product to the sale');
      return;
    }

    if (saleItems.some(item => !item.assembly_unit_id)) {
      alert('Please select a product for all sale items');
      return;
    }

    setLoading(true);
    try {
      const saleValue = calculateSaleValue();

      if (sale) {
        const { error: updateError } = await supabase
          .from('sales')
          .update({
            sale_date: formData.sale_date,
            sale_notes: formData.sale_notes || null,
            po_number: hasPO && formData.po_number.trim() ? formData.po_number.trim() : '',
            unit_price: hasPO ? formData.unit_price : 0,
            sale_value: saleValue,
            updated_by: userProfile?.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sale.id);

        if (updateError) throw updateError;

        await supabase.from('sale_items').delete().eq('sale_id', sale.id);

        const itemsToInsert = saleItems.map(item => ({
          sale_id: sale.id,
          assembly_unit_id: item.assembly_unit_id,
          serial_number: item.serial_number,
          unit_price: hasPO ? 0 : item.unit_price,
          quantity: item.quantity,
        }));

        const { error: itemsError } = await supabase
          .from('sale_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        await supabase.from('activity_logs').insert({
          user_id: userProfile?.id,
          action: 'UPDATE_SALE',
          details: {
            saleNumber: sale.sale_number,
            customerName,
            itemCount: saleItems.length,
          },
        });
      } else {
        const { data: saleNumberData } = await supabase.rpc('generate_sale_number');
        const saleNumber = saleNumberData || 'SALE-0001';

        const { data: newSale, error: saleError } = await supabase
          .from('sales')
          .insert({
            sale_number: saleNumber,
            customer_id: customerId,
            sale_date: formData.sale_date,
            sale_notes: formData.sale_notes || null,
            po_number: hasPO && formData.po_number.trim() ? formData.po_number.trim() : '',
            unit_price: hasPO ? formData.unit_price : 0,
            sale_value: saleValue,
            created_by: userProfile?.id,
            updated_by: userProfile?.id,
          })
          .select()
          .single();

        if (saleError) throw saleError;

        const itemsToInsert = saleItems.map(item => ({
          sale_id: newSale.id,
          assembly_unit_id: item.assembly_unit_id,
          serial_number: item.serial_number,
          unit_price: hasPO ? 0 : item.unit_price,
          quantity: item.quantity,
        }));

        const { error: itemsError } = await supabase
          .from('sale_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        await supabase.from('activity_logs').insert({
          user_id: userProfile?.id,
          action: 'CREATE_SALE',
          details: {
            saleNumber,
            customerName,
            itemCount: saleItems.length,
          },
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving sale:', error);
      alert('Failed to save sale');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-slate-800 shadow-xl z-[90] overflow-y-auto">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {sale ? 'Edit Sale' : 'New Sale'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleCurrency}
              className={`p-2 rounded-lg transition-colors ${
                currencyMode === 'EUR'
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
              } hover:bg-opacity-80`}
              title={currencyMode === 'INR' ? 'Switch to EUR (View Only)' : 'Switch to INR'}
            >
              <Flag className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {currencyMode === 'EUR' && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
              View Only Mode - Prices shown in EUR
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Click the flag icon to switch back to INR for editing
            </p>
          </div>
        )}

        <div className="mb-4 p-3 bg-blue-50 dark:bg-slate-700 rounded-lg">
          <p className="text-sm text-slate-600 dark:text-slate-400">Customer</p>
          <p className="font-medium text-slate-900 dark:text-white">{customerName}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Sale Date
            </label>
            <input
              type="date"
              value={formData.sale_date}
              onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
              disabled={currencyMode === 'EUR'}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Sale Notes
            </label>
            <textarea
              value={formData.sale_notes}
              onChange={(e) => setFormData({ ...formData, sale_notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
              disabled={currencyMode === 'EUR'}
              rows={3}
            />
          </div>

          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasPO}
                onChange={(e) => {
                  setHasPO(e.target.checked);
                  if (!e.target.checked) {
                    setFormData({ ...formData, po_number: '' });
                  }
                }}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                disabled={currencyMode === 'EUR'}
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                This sale is for a Purchase Order
              </span>
            </label>
          </div>

          {hasPO && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Purchase Order *
                </label>
                <select
                  value={formData.po_number}
                  onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                  required
                  disabled={currencyMode === 'EUR'}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
                >
                  <option value="">Select a Purchase Order</option>
                  {purchaseOrders.map((po) => (
                    <option key={po.id} value={po.po_number}>
                      {po.po_number} - {(po.customers as any)?.customer_name || 'Unknown Customer'}
                      {po.delivery_date ? ` (Due: ${new Date(po.delivery_date).toLocaleDateString()})` : ''}
                    </option>
                  ))}
                </select>
                {purchaseOrders.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    No open purchase orders available
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Unit Price ({getCurrencySymbol()}) *
                </label>
                {currencyMode === 'EUR' ? (
                  <div className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-600 text-slate-900 dark:text-white font-medium">
                    {getCurrencySymbol()}{formatAmount(formData.unit_price)}
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-600 dark:text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={formData.unit_price}
                      onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                )}
              </div>
            </>
          )}

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Products
              </label>
              {currencyMode === 'INR' && (
                <button
                  type="button"
                  onClick={addSaleItem}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              )}
            </div>

            <div className="space-y-2">
              {saleItems.map((item, index) => (
                <div key={index} className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg space-y-2">
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <select
                        value={item.assembly_unit_id}
                        onChange={(e) => updateSaleItem(index, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-600 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 text-sm"
                        disabled={currencyMode === 'EUR'}
                        required
                      >
                        <option value="">Select product...</option>
                        {availableUnits.map(unit => (
                          <option key={unit.id} value={unit.id}>
                            {unit.assembly_name} - SN: {unit.assembly_serial_number}
                          </option>
                        ))}
                      </select>
                      {item.serial_number && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          Serial: {item.serial_number}
                        </p>
                      )}
                    </div>
                    {currencyMode === 'INR' && (
                      <button
                        type="button"
                        onClick={() => removeSaleItem(index)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateSaleItemQuantity(index, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-600 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 text-sm"
                        disabled={currencyMode === 'EUR'}
                        min="1"
                        required
                      />
                    </div>
                    {!hasPO && (
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Unit Price ({getCurrencySymbol()}) *
                        </label>
                        {currencyMode === 'EUR' ? (
                          <div className="w-full px-3 py-2 border border-slate-300 dark:border-slate-500 rounded-lg bg-slate-100 dark:bg-slate-600 text-slate-900 dark:text-white font-medium text-sm">
                            {getCurrencySymbol()}{formatAmount(item.unit_price)}
                          </div>
                        ) : (
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-600 dark:text-slate-400 text-sm">
                              ₹
                            </span>
                            <input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => updateSaleItemPrice(index, e.target.value)}
                              onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                              className="w-full pl-8 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-600 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 text-sm"
                              min="0"
                              step="0.01"
                              required
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Subtotal
                      </label>
                      <div className="px-3 py-2 bg-slate-100 dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg text-slate-900 dark:text-white font-medium text-sm">
                        {getCurrencySymbol()}{formatAmount((hasPO ? formData.unit_price : item.unit_price) * item.quantity)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {saleItems.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                  No products added yet. Click "Add Product" to add items.
                </p>
              )}
            </div>
          </div>

          <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {hasPO ? 'PO Value:' : 'Sales Value:'}
              </span>
              <span className="text-2xl font-bold text-green-700 dark:text-green-400">
                {getCurrencySymbol()}{formatAmount(calculateSaleValue())}
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              {currencyMode === 'EUR' ? 'Close' : 'Cancel'}
            </button>
            {currencyMode === 'INR' && (
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? 'Saving...' : sale ? 'Update Sale' : 'Create Sale'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
