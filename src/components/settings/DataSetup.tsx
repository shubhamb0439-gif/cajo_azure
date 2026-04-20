import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { Plus, Trash2, Save } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type DropdownValue = Database['public']['Tables']['dropdown_values']['Row'];

interface ExchangeRate {
  id: string;
  currency_code: string;
  currency_name: string;
  inr_per_unit: number;
  updated_at: string;
}

export default function DataSetup() {
  const { userProfile, hasWriteAccess } = useAuth();
  const { refreshExchangeRate } = useCurrency();
  const [values, setValues] = useState<DropdownValue[]>([]);
  const [selectedType, setSelectedType] = useState<'vendor_group' | 'vendor_currency' | 'item_group' | 'item_class' | 'lead_status' | 'lead_source'>('item_group');
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [eurRate, setEurRate] = useState<string>('');
  const [savingRate, setSavingRate] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const types: { value: typeof selectedType; label: string }[] = [
    { value: 'item_group', label: 'Item Groups' },
    { value: 'item_class', label: 'Item Classes' },
    { value: 'vendor_group', label: 'Vendor Groups' },
    { value: 'vendor_currency', label: 'Vendor Currencies' },
    { value: 'lead_status', label: 'Lead Statuses' },
    { value: 'lead_source', label: 'Lead Sources' },
  ];

  useEffect(() => {
    loadValues();
  }, [selectedType]);

  useEffect(() => {
    loadExchangeRates();

    // Set up realtime subscription for exchange rates
    const channel = supabase
      .channel('exchange-rates-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'foreign_exchange_rates' },
        () => {
          loadExchangeRates();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const loadValues = async () => {
    setLoading(true);
    const { data } = await supabase.from('dropdown_values').select('*').eq('drop_type', selectedType).order('drop_value');
    if (data) setValues(data);
    setLoading(false);
  };

  const loadExchangeRates = async () => {
    const { data } = await supabase.from('foreign_exchange_rates').select('*').order('currency_code');
    if (data) {
      setExchangeRates(data);
      const eur = data.find(r => r.currency_code === 'EUR');
      if (eur) {
        const rateValue = typeof eur.inr_per_unit === 'number'
          ? eur.inr_per_unit.toString()
          : eur.inr_per_unit;
        setEurRate(rateValue);
      }
    }
  };

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(eurRate);
    if (isNaN(rate) || rate <= 0) {
      alert('Please enter a valid positive number');
      return;
    }

    setSavingRate(true);
    setSaveSuccess(false);

    try {
      console.log('Attempting to update exchange rate to:', rate);
      console.log('User profile:', {
        id: userProfile?.id,
        email: userProfile?.email,
        role: userProfile?.role,
        user_rights: userProfile?.user_rights,
        enabled: userProfile?.enabled
      });

      const { data, error } = await supabase
        .from('foreign_exchange_rates')
        .update({
          inr_per_unit: rate,
          updated_at: new Date().toISOString(),
          updated_by: userProfile?.id
        })
        .eq('currency_code', 'EUR')
        .select();

      console.log('Update result - data:', data, 'error:', error);

      if (error) {
        console.error('Error updating exchange rate:', error);
        alert(`Failed to save exchange rate: ${error.message}\n\nDetails: ${JSON.stringify(error, null, 2)}`);
        return;
      }

      if (!data || data.length === 0) {
        console.error('No data returned from update');
        const debugInfo = `
User Info:
- Role: ${userProfile?.role}
- Rights: ${userProfile?.user_rights}
- Enabled: ${userProfile?.enabled}
- Email: ${userProfile?.email}

This suggests the RLS policy prevented the update.
Check that you have write access (user_rights = 'read_write' or role = 'admin') and are enabled.`;
        alert('Failed to save exchange rate: No data returned.\n\n' + debugInfo);
        return;
      }

      await supabase.from('activity_logs').insert({
        user_id: userProfile?.id,
        action: 'UPDATE_EXCHANGE_RATE',
        details: { currency: 'EUR', rate },
      });

      await loadExchangeRates();
      await refreshExchangeRate();
      setSaveSuccess(true);

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Exception updating exchange rate:', err);
      alert('An unexpected error occurred while saving the exchange rate');
    } finally {
      setSavingRate(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;

    await supabase.from('dropdown_values').insert({
      drop_type: selectedType,
      drop_value: newValue.trim(),
      created_by: userProfile?.id,
    });

    await supabase.from('activity_logs').insert({
      user_id: userProfile?.id,
      action: 'CREATE_DROPDOWN_VALUE',
      details: { type: selectedType, value: newValue },
    });

    setNewValue('');
    loadValues();
  };

  const handleDelete = async (id: string, value: string) => {
    if (!confirm(`Delete "${value}"?`)) return;
    await supabase.from('dropdown_values').delete().eq('id', id);
    loadValues();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Manage Dropdown Values</h2>
        <div className="flex flex-wrap gap-2">
          {types.map(type => (
            <button
              key={type.value}
              onClick={() => setSelectedType(type.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === type.value
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {hasWriteAccess && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Enter new value..."
            className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
          />
          <button
            type="submit"
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
        </div>
      ) : (
        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
          {values.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No values added yet</p>
          ) : (
            <div className="space-y-2">
              {values.map(value => (
                <div
                  key={value.id}
                  className="flex items-center justify-between bg-white dark:bg-slate-800 px-4 py-3 rounded-lg"
                >
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{value.drop_value}</span>
                  {hasWriteAccess && (
                    <button
                      onClick={() => handleDelete(value.id, value.drop_value)}
                      className="p-1.5 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="border-t border-slate-200 dark:border-slate-700 pt-8">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Foreign Exchange</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Set the exchange rate for viewing the system in different currencies. The system base currency is Indian Rupee (INR).
        </p>

        {saveSuccess && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-green-800 dark:text-green-400">
              Exchange rate saved successfully!
            </p>
          </div>
        )}

        {hasWriteAccess ? (
          <form onSubmit={handleSaveRate} className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Indian Rupees per Euro (₹/€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={eurRate}
                  onChange={(e) => setEurRate(e.target.value)}
                  onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g., 106.00"
                  required
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Example: If 1 Euro = ₹106, enter 106.00
                </p>
              </div>
              <button
                type="submit"
                disabled={savingRate}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg mt-6 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingRate ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Indian Rupees per Euro (₹/€)
                </label>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">₹{eurRate}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
