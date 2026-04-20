import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { Plus, Trash2, Search, X } from 'lucide-react';
import type { Database } from '../../lib/database.types';
import SidePanel from '../SidePanel';

type BOM = Database['public']['Tables']['boms']['Row'] & {
  inventory_items: { item_id: string; item_name: string; item_group: string | null };
};
type BOMItem = Database['public']['Tables']['bom_items']['Row'] & {
  inventory_items: { item_id: string; item_name: string };
};

export default function BOMBuilder() {
  const { userProfile, hasWriteAccess } = useAuth();
  const { isViewOnly } = useCurrency();
  const [boms, setBoms] = useState<BOM[]>([]);
  const [selectedBOM, setSelectedBOM] = useState<BOM | null>(null);
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBOMs();
  }, []);

  useEffect(() => {
    if (selectedBOM) loadBOMItems(selectedBOM.id);
  }, [selectedBOM]);

  const loadBOMs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('boms')
      .select('*, inventory_items(item_id, item_name, item_group)')
      .order('bom_name');
    if (data) setBoms(data as BOM[]);
    setLoading(false);
  };

  const loadBOMItems = async (bomId: string) => {
    const { data } = await supabase
      .from('bom_items')
      .select('*, inventory_items(item_id, item_name)')
      .eq('bom_id', bomId)
      .order('created_at');
    if (data) setBomItems(data as BOMItem[]);
  };

  const handleDeleteBOM = async (id: string) => {
    if (!confirm('Delete this BOM?')) return;
    await supabase.from('boms').delete().eq('id', id);
    if (selectedBOM?.id === id) {
      setSelectedBOM(null);
      setBomItems([]);
    }
    loadBOMs();
  };

  const handleDeleteBOMItem = async (id: string) => {
    await supabase.from('bom_items').delete().eq('id', id);
    if (selectedBOM) loadBOMItems(selectedBOM.id);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">BOMs</h2>
          {hasWriteAccess && !isViewOnly && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New BOM</span>
            </button>
          )}
        </div>

        <div className="space-y-2">
          {boms.map(bom => (
            <div
              key={bom.id}
              onClick={() => setSelectedBOM(bom)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                selectedBOM?.id === bom.id
                  ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white">{bom.bom_name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Produces: {bom.inventory_items.item_name}
                  </p>
                </div>
                {hasWriteAccess && !isViewOnly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBOM(bom.id);
                    }}
                    className="p-1.5 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {boms.length === 0 && (
            <p className="text-center text-slate-500 py-8">No BOMs created yet</p>
          )}
        </div>
      </div>

      <div>
        {selectedBOM ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Components</h2>
              <BOMItemForm bom={selectedBOM} onSuccess={() => loadBOMItems(selectedBOM.id)} hasWriteAccess={hasWriteAccess} isViewOnly={isViewOnly} />
            </div>

            <div className="space-y-2">
              {bomItems.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {item.inventory_items.item_name}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Quantity: {item.bom_component_quantity}
                    </p>
                  </div>
                  {hasWriteAccess && !isViewOnly && (
                    <button
                      onClick={() => handleDeleteBOMItem(item.id)}
                      className="p-1.5 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {bomItems.length === 0 && (
                <p className="text-center text-slate-500 py-8">No components added</p>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-500">Select a BOM to view components</p>
          </div>
        )}
      </div>

      <BOMForm isOpen={showForm} onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); loadBOMs(); }} />
    </div>
  );
}

function BOMForm({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const { userProfile } = useAuth();
  const [items, setItems] = useState<Database['public']['Tables']['inventory_items']['Row'][]>([]);
  const [form, setForm] = useState({ bom_name: '', bom_item_id: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('inventory_items').select('*').order('item_name');
      if (data) setItems(data);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await supabase.from('boms').insert({ ...form, created_by: userProfile?.id });
      await supabase.from('activity_logs').insert({
        user_id: userProfile?.id,
        action: 'CREATE_BOM',
        details: { bomName: form.bom_name },
      });
      onSuccess();
    } catch (error) {
      alert('Failed to create BOM');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidePanel isOpen={isOpen} onClose={onClose} title="New BOM">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">BOM Name *</label>
          <input
            type="text"
            value={form.bom_name}
            onChange={(e) => setForm({ ...form, bom_name: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Finished Good *</label>
          <select
            value={form.bom_item_id}
            onChange={(e) => setForm({ ...form, bom_item_id: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
          >
            <option value="">Select Item</option>
            {items.filter(item => item.item_group === 'Component' || item.item_group === 'Product').map(item => (
              <option key={item.id} value={item.id}>[{item.item_id}] {item.item_name} ({item.item_group})</option>
            ))}
          </select>
        </div>
        <div className="flex space-x-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50">
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </SidePanel>
  );
}

function BOMItemForm({ bom, onSuccess, hasWriteAccess, isViewOnly }: { bom: BOM; onSuccess: () => void; hasWriteAccess: boolean; isViewOnly: boolean }) {
  const { userProfile } = useAuth();
  const [items, setItems] = useState<Database['public']['Tables']['inventory_items']['Row'][]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ bom_component_item_id: '', bom_component_quantity: 1 });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Database['public']['Tables']['inventory_items']['Row'] | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('inventory_items').select('*').order('item_name');
      if (data) setItems(data);
    })();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getFilteredItems = () => {
    const finishedGoodGroup = bom.inventory_items.item_group;
    let filtered = items;
    if (finishedGoodGroup === 'Component') {
      filtered = items.filter(item => item.item_group === 'Part');
    } else if (finishedGoodGroup === 'Product') {
      filtered = items.filter(item => item.item_group === 'Part' || item.item_group === 'Component');
    } else {
      filtered = [];
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.item_name.toLowerCase().includes(term) ||
        item.item_id.toLowerCase().includes(term) ||
        item.item_group?.toLowerCase().includes(term)
      );
    }

    return filtered;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await supabase.from('bom_items').insert({ ...form, bom_id: bom.id, created_by: userProfile?.id });
      setForm({ bom_component_item_id: '', bom_component_quantity: 1 });
      setSelectedItem(null);
      setSearchTerm('');
      setShowForm(false);
      onSuccess();
    } catch (error) {
      alert('Failed to add component');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = (item: Database['public']['Tables']['inventory_items']['Row']) => {
    setSelectedItem(item);
    setForm({ ...form, bom_component_item_id: item.id });
    setSearchTerm('');
    setShowDropdown(false);
  };

  const handleClearSelection = () => {
    setSelectedItem(null);
    setForm({ ...form, bom_component_item_id: '' });
    setSearchTerm('');
  };

  const filteredItems = getFilteredItems();

  return (
    <>
      {hasWriteAccess && !isViewOnly && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Component</span>
        </button>
      )}

      <SidePanel isOpen={showForm} onClose={() => { setShowForm(false); setSelectedItem(null); setSearchTerm(''); }} title="Add Component">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Component *</label>
            <div className="relative" ref={dropdownRef}>
              {selectedItem ? (
                <div className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-white">{selectedItem.item_name}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">[{selectedItem.item_id}] {selectedItem.item_group}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="ml-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder="Search components..."
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  {showDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {filteredItems.length > 0 ? (
                        filteredItems.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectItem(item)}
                            className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                          >
                            <div className="font-medium text-slate-900 dark:text-white">{item.item_name}</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">[{item.item_id}] {item.item_group}</div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                          No components found
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <input
              type="hidden"
              value={form.bom_component_item_id}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantity *</label>
            <input
              type="number"
              value={form.bom_component_quantity}
              onChange={(e) => setForm({ ...form, bom_component_quantity: parseFloat(e.target.value) })}
              onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
              required
              min="0.01"
              step="0.01"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <button type="button" onClick={() => { setShowForm(false); setSelectedItem(null); setSearchTerm(''); }} className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50">
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </SidePanel>
    </>
  );
}
