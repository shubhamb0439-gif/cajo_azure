import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../contexts/CurrencyContext';
import { Target, UserPlus, Users, TrendingUp, DollarSign, Tag, User } from 'lucide-react';

interface Lead {
  id: string;
  lead_name: string;
  lead_company: string | null;
  lead_status: string;
  lead_value: number | null;
  lead_email: string | null;
  lead_phone: string | null;
  lead_source: string | null;
  assigned_to: string | null;
}

interface Prospect {
  id: string;
  prospect_name: string;
  prospect_company: string | null;
  prospect_status: string;
  prospect_value: number | null;
  prospect_email: string | null;
  prospect_phone: string | null;
  prospect_source: string | null;
  assigned_to: string | null;
  original_lead_id?: string | null;
}

interface Customer {
  id: string;
  customer_name: string;
  customer_company: string | null;
  customer_status: string;
  customer_value: number | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_source: string | null;
  original_prospect_id?: string | null;
}

interface UserProfile {
  id: string;
  name: string;
}

const leadStatuses = [
  { value: 'new', label: 'New', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' },
  { value: 'contacted', label: 'Contacted', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' },
  { value: 'qualified', label: 'Qualified', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' },
];

const prospectStatuses = [
  { value: 'qualified', label: 'Qualified', color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300' },
  { value: 'demo_scheduled', label: 'Demo Scheduled', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' },
  { value: 'demo_completed', label: 'Demo Completed', color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' },
  { value: 'negotiation', label: 'Negotiation', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' },
  { value: 'won', label: 'Won', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' },
];

const customerStatuses = [
  { value: 'active', label: 'Active', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' },
  { value: 'inactive', label: 'Inactive', color: 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300' },
  { value: 'at_risk', label: 'At Risk', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' },
  { value: 'churned', label: 'Churned', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' },
];

export default function SalesOverview() {
  const { formatAmount, getCurrencySymbol } = useCurrency();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'leads' | 'prospects' | 'customers'>('leads');
  const [draggedItem, setDraggedItem] = useState<{ type: 'lead' | 'prospect' | 'customer', id: string } | null>(null);

  const formatCurrency = (amount: number) => {
    return `${getCurrencySymbol()}${formatAmount(amount)}`;
  };

  useEffect(() => {
    loadData();

    const subscription = supabase
      .channel('crm_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospects' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, loadData)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadData = async () => {
    setLoading(true);

    const [leadsData, prospectsData, customersData, usersData] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('prospects').select('*').order('created_at', { ascending: false }),
      supabase.from('customers').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('id, name'),
    ]);

    if (leadsData.data) setLeads(leadsData.data);
    if (prospectsData.data) setProspects(prospectsData.data);
    if (customersData.data) setCustomers(customersData.data);
    if (usersData.data) setUsers(usersData.data);

    setLoading(false);
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return null;
    const user = users.find(u => u.id === userId);
    return user?.name || 'Unknown';
  };

  const getLeadsByStatus = (status: string) => leads.filter(l => l.lead_status === status);
  const getProspectsByStatus = (status: string) => prospects.filter(p => p.prospect_status === status);
  const getCustomersByStatus = (status: string) => customers.filter(c => c.customer_status === status);

  const calculateTotalValue = (items: { lead_value?: number | null; prospect_value?: number | null; customer_value?: number | null }[]) => {
    return items.reduce((sum, item) => sum + (item.lead_value || item.prospect_value || item.customer_value || 0), 0);
  };

  const handleDragStart = (e: React.DragEvent, type: 'lead' | 'prospect' | 'customer', id: string) => {
    setDraggedItem({ type, id });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();

    if (!draggedItem) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (draggedItem.type === 'lead') {
      const lead = leads.find(l => l.id === draggedItem.id);
      if (!lead) return;

      if (targetStatus === 'qualified') {
        await convertLeadToProspect(lead, user.id);
      } else {
        await supabase
          .from('leads')
          .update({
            lead_status: targetStatus,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', draggedItem.id);
      }
    } else if (draggedItem.type === 'prospect') {
      const prospect = prospects.find(p => p.id === draggedItem.id);
      if (!prospect) return;

      if (targetStatus === 'won') {
        await convertProspectToCustomer(prospect, user.id);
      } else {
        await supabase
          .from('prospects')
          .update({
            prospect_status: targetStatus,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', draggedItem.id);
      }
    }

    setDraggedItem(null);
    await loadData();
  };

  const convertLeadToProspect = async (lead: Lead, userId: string) => {
    const { data: newProspect, error: insertError } = await supabase
      .from('prospects')
      .insert({
        prospect_name: lead.lead_name,
        prospect_email: lead.lead_email,
        prospect_phone: lead.lead_phone,
        prospect_company: lead.lead_company,
        prospect_status: 'qualified',
        prospect_value: lead.lead_value,
        prospect_source: lead.lead_source,
        assigned_to: lead.assigned_to,
        original_lead_id: lead.id,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (!insertError && newProspect) {
      await supabase.from('leads').delete().eq('id', lead.id);
    }
  };

  const convertProspectToCustomer = async (prospect: Prospect, userId: string) => {
    const { data: newCustomer, error: insertError } = await supabase
      .from('customers')
      .insert({
        customer_name: prospect.prospect_name,
        customer_email: prospect.prospect_email,
        customer_phone: prospect.prospect_phone,
        customer_company: prospect.prospect_company,
        customer_status: 'active',
        customer_value: prospect.prospect_value,
        customer_source: prospect.prospect_source,
        assigned_to: prospect.assigned_to,
        original_prospect_id: prospect.id,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (!insertError && newCustomer) {
      await supabase.from('prospects').delete().eq('id', prospect.id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-600 dark:text-slate-400">Loading CRM data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">CRM Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">Visualize your sales pipeline</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Leads</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{leads.length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {formatCurrency(calculateTotalValue(leads))} potential value
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Target className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Prospects</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{prospects.length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {formatCurrency(calculateTotalValue(prospects))} potential value
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <UserPlus className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Customers</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{customers.length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {formatCurrency(calculateTotalValue(customers))} lifetime value
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Users className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
        <div className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab('leads')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'leads'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Leads ({leads.length})
            </button>
            <button
              onClick={() => setActiveTab('prospects')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'prospects'
                  ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Prospects ({prospects.length})
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'customers'
                  ? 'border-green-600 text-green-600 dark:border-green-400 dark:text-green-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Customers ({customers.length})
            </button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="p-6">
          <div className="overflow-x-auto">
            <div className="inline-flex space-x-4 min-w-full">
              {activeTab === 'leads' && leadStatuses.map(status => {
                const statusLeads = getLeadsByStatus(status.value);
                return (
                  <div
                    key={status.value}
                    className="flex-shrink-0 w-72"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, status.value)}
                  >
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{status.label}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {statusLeads.length}
                        </span>
                      </div>
                      <div className="space-y-3 max-h-[600px] overflow-y-auto">
                        {statusLeads.map(lead => (
                          <div
                            key={lead.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, 'lead', lead.id)}
                            className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-move border border-slate-200 dark:border-slate-700"
                          >
                            <h4 className="font-medium text-slate-900 dark:text-white mb-1">
                              {lead.lead_name}
                            </h4>
                            {lead.lead_company && (
                              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                {lead.lead_company}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 mb-2">
                              {lead.lead_source && (
                                <div className="flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded">
                                  <Tag className="w-3 h-3" />
                                  {lead.lead_source}
                                </div>
                              )}
                              {lead.assigned_to && (
                                <div className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                                  <User className="w-3 h-3" />
                                  {getUserName(lead.assigned_to)}
                                </div>
                              )}
                            </div>
                            {lead.lead_value && (
                              <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                                <DollarSign className="w-4 h-4 mr-1" />
                                {formatCurrency(lead.lead_value)}
                              </div>
                            )}
                          </div>
                        ))}
                        {statusLeads.length === 0 && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                            No leads
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {activeTab === 'prospects' && prospectStatuses.map(status => {
                const statusProspects = getProspectsByStatus(status.value);
                return (
                  <div
                    key={status.value}
                    className="flex-shrink-0 w-72"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, status.value)}
                  >
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{status.label}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {statusProspects.length}
                        </span>
                      </div>
                      <div className="space-y-3 max-h-[600px] overflow-y-auto">
                        {statusProspects.map(prospect => (
                          <div
                            key={prospect.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, 'prospect', prospect.id)}
                            className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-move border border-slate-200 dark:border-slate-700"
                          >
                            <h4 className="font-medium text-slate-900 dark:text-white mb-1">
                              {prospect.prospect_name}
                            </h4>
                            {prospect.prospect_company && (
                              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                {prospect.prospect_company}
                              </p>
                            )}
                            {prospect.prospect_value && (
                              <div className="flex items-center gap-1 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded mb-2 w-fit">
                                <DollarSign className="w-4 h-4" />
                                {formatCurrency(prospect.prospect_value)}
                              </div>
                            )}
                          </div>
                        ))}
                        {statusProspects.length === 0 && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                            No prospects
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {activeTab === 'customers' && customerStatuses.map(status => {
                const statusCustomers = getCustomersByStatus(status.value);
                return (
                  <div key={status.value} className="flex-shrink-0 w-72">
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{status.label}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {statusCustomers.length}
                        </span>
                      </div>
                      <div className="space-y-3 max-h-[600px] overflow-y-auto">
                        {statusCustomers.map(customer => (
                          <div
                            key={customer.id}
                            className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-200 dark:border-slate-700"
                          >
                            <h4 className="font-medium text-slate-900 dark:text-white mb-1">
                              {customer.customer_name}
                            </h4>
                            {customer.customer_company && (
                              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                {customer.customer_company}
                              </p>
                            )}
                            {customer.customer_value && (
                              <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                                <DollarSign className="w-4 h-4 mr-1" />
                                {formatCurrency(customer.customer_value)}
                              </div>
                            )}
                          </div>
                        ))}
                        {statusCustomers.length === 0 && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                            No customers
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
