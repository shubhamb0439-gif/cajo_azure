import { azureApi } from './azure';
import type { Database } from './database.types';

type Tables = Database['public']['Tables'];

export type UserRow = Tables['users']['Row'];
export type InventoryItem = Tables['inventory_items']['Row'];
export type BOM = Tables['boms']['Row'];
export type BOMComponent = Tables['bom_components']['Row'];
export type Assembly = Tables['assemblies']['Row'];
export type AssemblyUnit = Tables['assembly_units']['Row'];
export type AssemblyComponent = Tables['assembly_components']['Row'];
export type Vendor = Tables['vendors']['Row'];
export type Purchase = Tables['purchases']['Row'];
export type PurchaseItem = Tables['purchase_items']['Row'];
export type PurchaseOrder = Tables['purchase_orders']['Row'];
export type PurchaseOrderItem = Tables['purchase_order_items']['Row'];
export type Customer = Tables['customers']['Row'];
export type Lead = Tables['leads']['Row'];
export type Prospect = Tables['prospects']['Row'];
export type Sale = Tables['sales']['Row'];
export type SaleItem = Tables['sale_items']['Row'];
export type Delivery = Tables['deliveries']['Row'];
export type DeliveryItem = Tables['delivery_items']['Row'];
export type Device = Tables['devices']['Row'];
export type Ticket = Tables['tickets']['Row'];
export type TicketMessage = Tables['ticket_messages']['Row'];
export type Message = Tables['messages']['Row'];
export type MessageRead = Tables['message_reads']['Row'];
export type ActivityLog = Tables['activity_logs']['Row'];
export type HelpCategory = Tables['help_categories']['Row'];
export type HelpArticle = Tables['help_articles']['Row'];
export type SystemRequest = Tables['system_requests']['Row'];
export type ForeignExchangeRate = Tables['foreign_exchange_rates']['Row'];
export type AssemblyFile = Tables['assembly_files']['Row'];
export type DeviceIssueType = Tables['device_issue_types']['Row'];
export type DropdownType = Tables['dropdown_types']['Row'];
export type DropdownValue = Tables['dropdown_values']['Row'];

export const api = {
  users: {
    getAll: () => azureApi.get<UserRow[]>('/users'),
    getById: (id: string) => azureApi.get<UserRow>(`/users/${id}`),
    getByAuthId: (authUserId: string) => azureApi.get<UserRow>(`/users/by-auth/${authUserId}`),
    create: (data: Partial<UserRow>) => azureApi.post<UserRow>('/users', data),
    update: (id: string, data: Partial<UserRow>) => azureApi.patch<UserRow>(`/users/${id}`, data),
    delete: (id: string) => azureApi.delete<null>(`/users/${id}`),
    updateProfile: (id: string, data: Partial<UserRow>) => azureApi.patch<UserRow>(`/users/${id}/profile`, data),
  },

  inventory: {
    getAll: () => azureApi.get<InventoryItem[]>('/inventory'),
    getById: (id: string) => azureApi.get<InventoryItem>(`/inventory/${id}`),
    create: (data: Partial<InventoryItem>) => azureApi.post<InventoryItem>('/inventory', data),
    update: (id: string, data: Partial<InventoryItem>) => azureApi.patch<InventoryItem>(`/inventory/${id}`, data),
    delete: (id: string) => azureApi.delete<null>(`/inventory/${id}`),
  },

  boms: {
    getAll: () => azureApi.get<(BOM & { bom_components: BOMComponent[] })[]>('/boms'),
    getById: (id: string) => azureApi.get<BOM & { bom_components: BOMComponent[] }>(`/boms/${id}`),
    create: (data: Partial<BOM>) => azureApi.post<BOM>('/boms', data),
    update: (id: string, data: Partial<BOM>) => azureApi.patch<BOM>(`/boms/${id}`, data),
    delete: (id: string) => azureApi.delete<null>(`/boms/${id}`),
    addComponent: (data: Partial<BOMComponent>) => azureApi.post<BOMComponent>('/boms/components', data),
    removeComponent: (id: string) => azureApi.delete<null>(`/boms/components/${id}`),
  },

  assemblies: {
    getAll: () => azureApi.get<Assembly[]>('/assemblies'),
    getById: (id: string) =>
      azureApi.get<Assembly & { assembly_units: AssemblyUnit[]; assembly_components: AssemblyComponent[] }>(`/assemblies/${id}`),
    create: (data: {
      bom_id: string;
      quantity: number;
      serial_numbers?: string[];
      po_number?: string;
    }) => azureApi.post<Assembly>('/assemblies/create', data),
    reverse: (id: string) => azureApi.post<null>(`/assemblies/${id}/reverse`, {}),
    getFiles: (assemblyId: string) => azureApi.get<AssemblyFile[]>(`/assemblies/${assemblyId}/files`),
    addFile: (data: Partial<AssemblyFile>) => azureApi.post<AssemblyFile>('/assemblies/files', data),
    deleteFile: (id: string) => azureApi.delete<null>(`/assemblies/files/${id}`),
  },

  vendors: {
    getAll: () => azureApi.get<Vendor[]>('/vendors'),
    getById: (id: string) => azureApi.get<Vendor>(`/vendors/${id}`),
    create: (data: Partial<Vendor>) => azureApi.post<Vendor>('/vendors', data),
    update: (id: string, data: Partial<Vendor>) => azureApi.patch<Vendor>(`/vendors/${id}`, data),
    delete: (id: string) => azureApi.delete<null>(`/vendors/${id}`),
  },

  purchases: {
    getAll: () => azureApi.get<(Purchase & { purchase_items: PurchaseItem[] })[]>('/purchases'),
    getById: (id: string) => azureApi.get<Purchase & { purchase_items: PurchaseItem[] }>(`/purchases/${id}`),
    create: (data: Partial<Purchase> & { items: Partial<PurchaseItem>[] }) => azureApi.post<Purchase>('/purchases', data),
    update: (id: string, data: Partial<Purchase> & { items?: Partial<PurchaseItem>[] }) =>
      azureApi.patch<Purchase>(`/purchases/${id}`, data),
    delete: (id: string) => azureApi.delete<null>(`/purchases/${id}`),
    receiveItems: (purchaseId: string, items: { id: string; quantity_received: number }[]) =>
      azureApi.post<null>(`/purchases/${purchaseId}/receive`, { items }),
    getStockByVendor: () => azureApi.get<{ vendor_id: string; vendor_name: string; item_name: string; quantity: number }[]>('/purchases/stock-by-vendor'),
  },

  purchaseOrders: {
    getAll: () => azureApi.get<(PurchaseOrder & { purchase_order_items: PurchaseOrderItem[] })[]>('/purchase-orders'),
    getById: (id: string) =>
      azureApi.get<PurchaseOrder & { purchase_order_items: PurchaseOrderItem[] }>(`/purchase-orders/${id}`),
    create: (data: Partial<PurchaseOrder> & { items: Partial<PurchaseOrderItem>[] }) =>
      azureApi.post<PurchaseOrder>('/purchase-orders', data),
    update: (id: string, data: Partial<PurchaseOrder> & { items?: Partial<PurchaseOrderItem>[] }) =>
      azureApi.patch<PurchaseOrder>(`/purchase-orders/${id}`, data),
    delete: (id: string) => azureApi.delete<null>(`/purchase-orders/${id}`),
  },

  customers: {
    getAll: () => azureApi.get<Customer[]>('/customers'),
    getById: (id: string) => azureApi.get<Customer>(`/customers/${id}`),
    create: (data: Partial<Customer>) => azureApi.post<Customer>('/customers', data),
    update: (id: string, data: Partial<Customer>) => azureApi.patch<Customer>(`/customers/${id}`, data),
    delete: (id: string) => azureApi.delete<null>(`/customers/${id}`),
  },

  leads: {
    getAll: () => azureApi.get<Lead[]>('/leads'),
    getById: (id: string) => azureApi.get<Lead>(`/leads/${id}`),
    create: (data: Partial<Lead>) => azureApi.post<Lead>('/leads', data),
    update: (id: string, data: Partial<Lead>) => azureApi.patch<Lead>(`/leads/${id}`, data),
    delete: (id: string) => azureApi.delete<null>(`/leads/${id}`),
  },

  prospects: {
    getAll: () => azureApi.get<Prospect[]>('/prospects'),
    getById: (id: string) => azureApi.get<Prospect>(`/prospects/${id}`),
    create: (data: Partial<Prospect>) => azureApi.post<Prospect>('/prospects', data),
    update: (id: string, data: Partial<Prospect>) => azureApi.patch<Prospect>(`/prospects/${id}`, data),
    delete: (id: string) => azureApi.delete<null>(`/prospects/${id}`),
  },

  sales: {
    getAll: () => azureApi.get<(Sale & { sale_items: SaleItem[] })[]>('/sales'),
    getById: (id: string) => azureApi.get<Sale & { sale_items: SaleItem[] }>(`/sales/${id}`),
    getByCustomer: (customerId: string) => azureApi.get<(Sale & { sale_items: SaleItem[] })[]>(`/sales/customer/${customerId}`),
    create: (data: Partial<Sale> & { items: Partial<SaleItem>[] }) => azureApi.post<Sale>('/sales', data),
    update: (id: string, data: Partial<Sale> & { items?: Partial<SaleItem>[] }) =>
      azureApi.patch<Sale>(`/sales/${id}`, data),
    delete: (id: string) => azureApi.delete<null>(`/sales/${id}`),
    getOverview: () => azureApi.get<{
      total_revenue: number;
      total_orders: number;
      monthly_revenue: { month: string; revenue: number }[];
      top_products: { name: string; quantity: number; revenue: number }[];
    }>('/sales/overview'),
  },

  deliveries: {
    getAll: () => azureApi.get<(Delivery & { delivery_items: DeliveryItem[] })[]>('/deliveries'),
    getById: (id: string) =>
      azureApi.get<Delivery & { delivery_items: DeliveryItem[] }>(`/deliveries/${id}`),
    getBySale: (saleId: string) => azureApi.get<Delivery[]>(`/deliveries/sale/${saleId}`),
    create: (data: Partial<Delivery> & { items?: Partial<DeliveryItem>[] }) =>
      azureApi.post<Delivery>('/deliveries', data),
    update: (id: string, data: Partial<Delivery>) => azureApi.patch<Delivery>(`/deliveries/${id}`, data),
    fulfill: (id: string, items: { item_id: string; quantity: number }[]) =>
      azureApi.post<null>(`/deliveries/${id}/fulfill`, { items }),
    delete: (id: string) => azureApi.delete<null>(`/deliveries/${id}`),
  },

  devices: {
    getAll: () => azureApi.get<Device[]>('/devices'),
    getById: (id: string) => azureApi.get<Device>(`/devices/${id}`),
    getByCustomer: (customerId: string) => azureApi.get<Device[]>(`/devices/customer/${customerId}`),
    create: (data: Partial<Device>) => azureApi.post<Device>('/devices', data),
    update: (id: string, data: Partial<Device>) => azureApi.patch<Device>(`/devices/${id}`, data),
    updateStatus: (id: string, status: string, note?: string) =>
      azureApi.patch<Device>(`/devices/${id}/status`, { status, note }),
    delete: (id: string) => azureApi.delete<null>(`/devices/${id}`),
    getIssueTypes: () => azureApi.get<DeviceIssueType[]>('/devices/issue-types'),
  },

  tickets: {
    getAll: () => azureApi.get<Ticket[]>('/tickets'),
    getById: (id: string) => azureApi.get<Ticket>(`/tickets/${id}`),
    getByDevice: (deviceId: string) => azureApi.get<Ticket[]>(`/tickets/device/${deviceId}`),
    getByCustomer: (customerId: string) => azureApi.get<Ticket[]>(`/tickets/customer/${customerId}`),
    create: (data: Partial<Ticket>) => azureApi.post<Ticket>('/tickets', data),
    update: (id: string, data: Partial<Ticket>) => azureApi.patch<Ticket>(`/tickets/${id}`, data),
    close: (id: string) => azureApi.patch<Ticket>(`/tickets/${id}/close`, {}),
    delete: (id: string) => azureApi.delete<null>(`/tickets/${id}`),
    getMessages: (ticketId: string) => azureApi.get<TicketMessage[]>(`/tickets/${ticketId}/messages`),
    sendMessage: (ticketId: string, content: string) =>
      azureApi.post<TicketMessage>(`/tickets/${ticketId}/messages`, { content }),
    markMessagesRead: (ticketId: string, messageIds: string[]) =>
      azureApi.post<null>(`/tickets/${ticketId}/messages/read`, { messageIds }),
  },

  messaging: {
    getConversations: () => azureApi.get<{ user: UserRow; lastMessage: Message; unreadCount: number }[]>('/messages/conversations'),
    getMessages: (userId: string) => azureApi.get<Message[]>(`/messages/${userId}`),
    send: (recipientId: string, content: string) =>
      azureApi.post<Message>('/messages', { recipient_id: recipientId, content }),
    markRead: (messageIds: string[]) => azureApi.post<null>('/messages/read', { messageIds }),
    delete: (id: string) => azureApi.delete<null>(`/messages/${id}`),
    getUnreadCount: () => azureApi.get<{ count: number }>('/messages/unread-count'),
    adminList: () => azureApi.get<Message[]>('/messages/admin'),
    adminDelete: (id: string) => azureApi.delete<null>(`/messages/admin/${id}`),
  },

  activityLogs: {
    getAll: (limit?: number) => azureApi.get<ActivityLog[]>(`/activity-logs${limit ? `?limit=${limit}` : ''}`),
    create: (action: string, details?: Record<string, unknown>) =>
      azureApi.post<ActivityLog>('/activity-logs', { action, details }),
  },

  help: {
    getCategories: () => azureApi.get<HelpCategory[]>('/help/categories'),
    getArticles: (categoryId?: string) =>
      azureApi.get<HelpArticle[]>(`/help/articles${categoryId ? `?category=${categoryId}` : ''}`),
    search: (query: string) => azureApi.get<HelpArticle[]>(`/help/search?q=${encodeURIComponent(query)}`),
  },

  systemRequests: {
    getAll: () => azureApi.get<SystemRequest[]>('/system-requests'),
    getMyRequests: () => azureApi.get<SystemRequest[]>('/system-requests/mine'),
    create: (data: Partial<SystemRequest>) => azureApi.post<SystemRequest>('/system-requests', data),
    update: (id: string, data: Partial<SystemRequest>) => azureApi.patch<SystemRequest>(`/system-requests/${id}`, data),
    delete: (id: string) => azureApi.delete<null>(`/system-requests/${id}`),
  },

  exchangeRates: {
    getAll: () => azureApi.get<ForeignExchangeRate[]>('/exchange-rates'),
    getByCode: (code: string) => azureApi.get<ForeignExchangeRate>(`/exchange-rates/${code}`),
    update: (code: string, rate: number) => azureApi.patch<ForeignExchangeRate>(`/exchange-rates/${code}`, { inr_per_unit: rate }),
  },

  dropdowns: {
    getTypes: () => azureApi.get<DropdownType[]>('/dropdowns/types'),
    getValues: (typeId: string) => azureApi.get<DropdownValue[]>(`/dropdowns/values/${typeId}`),
    addValue: (data: Partial<DropdownValue>) => azureApi.post<DropdownValue>('/dropdowns/values', data),
    deleteValue: (id: string) => azureApi.delete<null>(`/dropdowns/values/${id}`),
  },

  reports: {
    getSummary: () => azureApi.get<{
      total_inventory_value: number;
      total_sales: number;
      total_purchases: number;
      open_tickets: number;
      assemblies_this_month: number;
    }>('/reports/summary'),
    getInventoryReport: () => azureApi.get<InventoryItem[]>('/reports/inventory'),
    getSalesReport: (from?: string, to?: string) =>
      azureApi.get<Sale[]>(`/reports/sales${from && to ? `?from=${from}&to=${to}` : ''}`),
    getPurchasesReport: (from?: string, to?: string) =>
      azureApi.get<Purchase[]>(`/reports/purchases${from && to ? `?from=${from}&to=${to}` : ''}`),
  },

  bulkUpload: {
    inventory: (items: Partial<InventoryItem>[]) => azureApi.post<{ inserted: number; errors: string[] }>('/bulk/inventory', { items }),
    vendors: (vendors: Partial<Vendor>[]) => azureApi.post<{ inserted: number; errors: string[] }>('/bulk/vendors', { vendors }),
    customers: (customers: Partial<Customer>[]) => azureApi.post<{ inserted: number; errors: string[] }>('/bulk/customers', { customers }),
  },

  dangerZone: {
    clearMessageMedia: () => azureApi.delete<{ deleted: number }>('/admin/message-media'),
    resetDatabase: () => azureApi.post<null>('/admin/reset', {}),
  },

  qrCode: {
    sendByEmail: (email: string, serialNumber: string, qrDataUrl: string) =>
      azureApi.post<null>('/qr/send-email', { email, serial_number: serialNumber, qr_data_url: qrDataUrl }),
  },
};
