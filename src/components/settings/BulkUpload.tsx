import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, Upload, Database, AlertTriangle, CheckCircle, FileUp } from 'lucide-react';

interface BackupData {
  timestamp: string;
  version: string;
  data: {
    dropdown_values?: any[];
    vendors?: any[];
    inventory_items?: any[];
    boms?: any[];
    bom_items?: any[];
    purchases?: any[];
    purchase_items?: any[];
    assemblies?: any[];
    assembly_units?: any[];
    assembly_items?: any[];
    leads?: any[];
    prospects?: any[];
    customers?: any[];
    sales?: any[];
    sale_items?: any[];
    deliveries?: any[];
    delivery_items?: any[];
    devices?: any[];
    tickets?: any[];
  };
}

export default function BulkUpload() {
  const { userProfile, hasWriteAccess } = useAuth();
  const [loading, setLoading] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'warning';
    message: string;
  }>({ show: false, type: 'success', message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsCSVInputRef = useRef<HTMLInputElement>(null);
  const vendorsCSVInputRef = useRef<HTMLInputElement>(null);
  const [hasTransactions, setHasTransactions] = useState<boolean | null>(null);
  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    checkForTransactions();
    loadRecordCounts();
  }, []);

  const checkForTransactions = async () => {
    try {
      const [purchasesRes, assembliesRes, salesRes] = await Promise.all([
        supabase.from('purchases').select('id', { count: 'exact', head: true }),
        supabase.from('assemblies').select('id', { count: 'exact', head: true }),
        supabase.from('sales').select('id', { count: 'exact', head: true }),
      ]);

      const totalTransactions =
        (purchasesRes.count || 0) +
        (assembliesRes.count || 0) +
        (salesRes.count || 0);

      setHasTransactions(totalTransactions > 0);
    } catch (error) {
      console.error('Error checking transactions:', error);
      setHasTransactions(true);
    }
  };

  const loadRecordCounts = async () => {
    try {
      const [
        itemsRes,
        vendorsRes,
        purchasesRes,
        bomsRes,
        assembliesRes,
        traceabilityRes,
        leadsRes,
        prospectsRes,
        customersRes,
        salesRes,
        deliveriesRes,
      ] = await Promise.all([
        supabase.from('inventory_items').select('id', { count: 'exact', head: true }),
        supabase.from('vendors').select('id', { count: 'exact', head: true }),
        supabase.from('purchases').select('id', { count: 'exact', head: true }),
        supabase.from('boms').select('id', { count: 'exact', head: true }),
        supabase.from('assemblies').select('id', { count: 'exact', head: true }),
        supabase.from('assembly_items').select('id', { count: 'exact', head: true }),
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        supabase.from('prospects').select('id', { count: 'exact', head: true }),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('sales').select('id', { count: 'exact', head: true }),
        supabase.from('deliveries').select('id', { count: 'exact', head: true }),
      ]);

      setRecordCounts({
        items: itemsRes.count || 0,
        vendors: vendorsRes.count || 0,
        purchases: purchasesRes.count || 0,
        boms: bomsRes.count || 0,
        assemblies: assembliesRes.count || 0,
        traceability: traceabilityRes.count || 0,
        leads: leadsRes.count || 0,
        prospects: prospectsRes.count || 0,
        customers: customersRes.count || 0,
        sales: salesRes.count || 0,
        deliveries: deliveriesRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading record counts:', error);
    }
  };

  const downloadTemplate = (type: 'items' | 'vendors') => {
    const headers = type === 'items'
      ? ['item_id', 'item_name', 'item_display_name', 'item_unit', 'item_group', 'item_class', 'item_stock_min', 'item_stock_max', 'item_stock_reorder', 'item_serial_number_tracked']
      : ['vendor_id', 'vendor_name', 'vendor_name_legal', 'vendor_group', 'vendor_contact_name', 'vendor_email', 'vendor_phone', 'vendor_address', 'vendor_currency', 'vendor_rating_price', 'vendor_rating_quality', 'vendor_rating_lead'];

    const csv = headers.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): any[] => {
    text = text.replace(/^\uFEFF/, '');
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    };

    const headers = parseLine(lines[0]).map(h => {
      let cleaned = h.trim();
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.slice(1, -1).replace(/""/g, '"');
      }
      return cleaned;
    });

    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseLine(line);
      const row: any = {};

      headers.forEach((header, index) => {
        let value: any = values[index] || '';

        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1).replace(/""/g, '"');
        }

        if (value === '' || value === 'null' || value === 'undefined') {
          value = null;
        } else if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        } else if (!isNaN(Number(value)) && value !== '') {
          value = Number(value);
        }

        row[header] = value;
      });

      data.push(row);
    }

    return data;
  };

  const uploadCSV = async (type: 'items' | 'vendors', mode: 'replace' | 'append' | 'merge') => {
    const fileInput = type === 'items' ? itemsCSVInputRef.current : vendorsCSVInputRef.current;
    const file = fileInput?.files?.[0];

    if (!file) {
      setRestoreStatus({ show: true, type: 'error', message: 'Please select a CSV file' });
      return;
    }

    setLoading(true);
    setRestoreStatus({ show: false, type: 'success', message: '' });

    try {
      const text = await file.text();
      const csvData = parseCSV(text);

      if (csvData.length === 0) {
        setRestoreStatus({ show: true, type: 'error', message: 'CSV file is empty or invalid' });
        setLoading(false);
        return;
      }

      const tableName = type === 'items' ? 'inventory_items' : 'vendors';
      const idField = type === 'items' ? 'item_id' : 'vendor_id';

      const allowedFields = type === 'items'
        ? ['item_id', 'item_name', 'item_display_name', 'item_unit', 'item_group', 'item_class',
           'item_stock_min', 'item_stock_max', 'item_stock_reorder', 'item_serial_number_tracked',
           'item_stock_current', 'item_cost_average', 'item_lead_time_average', 'item_stock_sold']
        : ['vendor_id', 'vendor_name', 'vendor_name_legal', 'vendor_group', 'vendor_contact_name',
           'vendor_email', 'vendor_phone', 'vendor_address', 'vendor_currency',
           'vendor_rating_price', 'vendor_rating_quality', 'vendor_rating_lead', 'vendor_rating_average'];

      const csvHeaders = Object.keys(csvData[0] || {});
      const unknownHeaders = csvHeaders.filter(h => !allowedFields.includes(h) && h !== 'id' && h !== 'created_at' && h !== 'updated_at' && h !== 'created_by' && h !== 'updated_by');

      if (unknownHeaders.length > 0) {
        setRestoreStatus({
          show: true,
          type: 'error',
          message: `CSV contains unknown columns: ${unknownHeaders.join(', ')}. Please use the template or remove these columns.`
        });
        setLoading(false);
        return;
      }

      if (!csvHeaders.includes(idField)) {
        setRestoreStatus({
          show: true,
          type: 'error',
          message: `CSV must include the '${idField}' column. Please download and use the template.`
        });
        setLoading(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      if (mode === 'replace') {
        const confirmMessage = `WARNING: This will DELETE ALL existing ${type} data before uploading. This action CANNOT be undone. Type "DELETE ALL ${type.toUpperCase()}" to confirm.`;
        const userConfirmation = prompt(confirmMessage);

        if (userConfirmation !== `DELETE ALL ${type.toUpperCase()}`) {
          setRestoreStatus({ show: true, type: 'warning', message: 'Upload cancelled - confirmation text did not match' });
          setLoading(false);
          return;
        }

        await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }

      for (let rowIndex = 0; rowIndex < csvData.length; rowIndex++) {
        const row = csvData[rowIndex];
        try {
          const filteredRow: any = {};
          allowedFields.forEach(field => {
            if (row[field] !== undefined) {
              filteredRow[field] = row[field];
            }
          });

          const cleanedRow = {
            ...filteredRow,
            created_by: userProfile?.id,
            updated_by: userProfile?.id,
          };

          if (type === 'items') {
            cleanedRow.item_stock_current = cleanedRow.item_stock_current || 0;
            cleanedRow.item_cost_average = cleanedRow.item_cost_average || 0;
            cleanedRow.item_lead_time_average = cleanedRow.item_lead_time_average || 0;
            cleanedRow.item_stock_sold = cleanedRow.item_stock_sold || 0;
          }

          if (type === 'vendors' && cleanedRow.vendor_rating_price !== undefined && cleanedRow.vendor_rating_quality !== undefined && cleanedRow.vendor_rating_lead !== undefined) {
            const ratings = [cleanedRow.vendor_rating_price, cleanedRow.vendor_rating_quality, cleanedRow.vendor_rating_lead].filter(r => r > 0);
            cleanedRow.vendor_rating_average = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
          }

          if (mode === 'merge') {
            const { data: existing } = await supabase
              .from(tableName)
              .select('id')
              .eq(idField, row[idField])
              .maybeSingle();

            if (existing) {
              const { error } = await supabase
                .from(tableName)
                .update(cleanedRow)
                .eq('id', existing.id);

              if (error) {
                errors.push(`Row ${rowIndex + 2} (${row[idField]}): ${error.message}`);
                errorCount++;
              } else {
                successCount++;
              }
            } else {
              const { error } = await supabase.from(tableName).insert(cleanedRow);

              if (error) {
                errors.push(`Row ${rowIndex + 2} (${row[idField]}): ${error.message}`);
                errorCount++;
              } else {
                successCount++;
              }
            }
          } else {
            const { error } = await supabase.from(tableName).insert(cleanedRow);

            if (error) {
              if (mode === 'append' && error.code === '23505') {
                errors.push(`Row ${rowIndex + 2} (${row[idField]}): Duplicate entry (skipped)`);
              } else {
                errors.push(`Row ${rowIndex + 2} (${row[idField]}): ${error.message}`);
              }
              errorCount++;
            } else {
              successCount++;
            }
          }
        } catch (error: any) {
          errors.push(`Row ${rowIndex + 2} (${row[idField] || 'unknown'}): ${error.message}`);
          errorCount++;
        }
      }

      await supabase.from('activity_logs').insert({
        activity_user_id: userProfile?.id,
        activity_type: `UPLOAD_${type.toUpperCase()}_CSV`,
        activity_description: `CSV upload: ${successCount} ${type} ${mode === 'replace' ? 'replaced' : mode === 'merge' ? 'merged' : 'appended'}`,
        activity_timestamp: new Date().toISOString(),
      });

      if (fileInput) {
        fileInput.value = '';
      }

      if (errorCount === 0) {
        setRestoreStatus({
          show: true,
          type: 'success',
          message: `Successfully uploaded ${successCount} ${type}!`,
        });
      } else if (successCount === 0) {
        setRestoreStatus({
          show: true,
          type: 'error',
          message: `Upload failed: ${errorCount} errors. First errors: ${errors.slice(0, 5).join(' | ')}${errors.length > 5 ? ' | ...' : ''}`,
        });
      } else {
        setRestoreStatus({
          show: true,
          type: 'warning',
          message: `Upload completed with ${successCount} successes and ${errorCount} errors. First errors: ${errors.slice(0, 5).join(' | ')}${errors.length > 5 ? ' | ...' : ''}`,
        });
      }

      await checkForTransactions();
      await loadRecordCounts();
    } catch (error: any) {
      console.error('CSV upload error:', error);
      setRestoreStatus({
        show: true,
        type: 'error',
        message: `Failed to upload CSV: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadData = async (type: 'items' | 'vendors') => {
    setLoading(true);
    try {
      const { data } = await supabase.from(type === 'items' ? 'inventory_items' : 'vendors').select('*');
      if (!data || data.length === 0) {
        setRestoreStatus({ show: true, type: 'warning', message: 'No data to export' });
        return;
      }

      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => Object.values(row).map(v => JSON.stringify(v)).join(',')).join('\n');
      const csv = headers + '\n' + rows;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setRestoreStatus({ show: true, type: 'success', message: `${type} exported successfully` });
    } catch (error: any) {
      setRestoreStatus({ show: true, type: 'error', message: `Failed to export: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const exportPurchases = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('purchases')
        .select('*, inventory_items(item_name), vendors(vendor_name)')
        .order('purchase_date', { ascending: false });

      if (!data || data.length === 0) {
        setRestoreStatus({ show: true, type: 'warning', message: 'No purchases to export' });
        return;
      }

      const formattedData = data.map(p => ({
        purchase_id: p.purchase_id,
        purchase_date: p.purchase_date,
        item_id: p.purchase_item_id,
        item_name: p.inventory_items?.item_name || '',
        vendor_id: p.purchase_vendor_id,
        vendor_name: p.vendors?.vendor_name || '',
        vendor_item_code: p.purchase_vendor_item_code || '',
        quantity_ordered: p.purchase_qty_ordered,
        quantity_received: p.purchase_qty_received,
        quantity_allocated: p.purchase_qty_allocated,
        unit_price: p.purchase_unit_price,
        currency: p.purchase_currency,
        lead_time_days: p.purchase_lead_time || '',
        notes: p.purchase_notes || '',
      }));

      const headers = Object.keys(formattedData[0]).join(',');
      const rows = formattedData.map(row => Object.values(row).map(v => JSON.stringify(v)).join(',')).join('\n');
      const csv = headers + '\n' + rows;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `purchases_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setRestoreStatus({ show: true, type: 'success', message: 'Purchases exported successfully' });
    } catch (error: any) {
      setRestoreStatus({ show: true, type: 'error', message: `Failed to export: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const exportBOM = async () => {
    setLoading(true);
    try {
      const { data: boms } = await supabase
        .from('boms')
        .select(`
          *,
          assembled_item:inventory_items!boms_bom_assembly_item_id_fkey(item_id, item_name),
          bom_items(
            *,
            component_item:inventory_items!bom_items_bom_component_item_id_fkey(item_id, item_name)
          )
        `)
        .order('bom_id', { ascending: true });

      if (!boms || boms.length === 0) {
        setRestoreStatus({ show: true, type: 'warning', message: 'No BOMs to export' });
        return;
      }

      const formattedData: any[] = [];
      boms.forEach(bom => {
        if (bom.bom_items && Array.isArray(bom.bom_items)) {
          bom.bom_items.forEach((item: any) => {
            formattedData.push({
              bom_id: bom.bom_id,
              bom_name: bom.bom_name,
              assembled_item_id: bom.bom_assembly_item_id,
              assembled_item_name: bom.assembled_item?.item_name || '',
              assembly_quantity: bom.bom_assembly_qty,
              component_item_id: item.bom_component_item_id,
              component_item_name: item.component_item?.item_name || '',
              component_quantity: item.bom_component_qty,
              notes: bom.bom_notes || '',
            });
          });
        } else {
          formattedData.push({
            bom_id: bom.bom_id,
            bom_name: bom.bom_name,
            assembled_item_id: bom.bom_assembly_item_id,
            assembled_item_name: bom.assembled_item?.item_name || '',
            assembly_quantity: bom.bom_assembly_qty,
            component_item_id: '',
            component_item_name: '',
            component_quantity: '',
            notes: bom.bom_notes || '',
          });
        }
      });

      const headers = Object.keys(formattedData[0]).join(',');
      const rows = formattedData.map(row => Object.values(row).map(v => JSON.stringify(v)).join(',')).join('\n');
      const csv = headers + '\n' + rows;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bom_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setRestoreStatus({ show: true, type: 'success', message: 'BOM exported successfully' });
    } catch (error: any) {
      setRestoreStatus({ show: true, type: 'error', message: `Failed to export: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const exportAssemblies = async () => {
    setLoading(true);
    try {
      const { data: assemblies } = await supabase
        .from('assemblies')
        .select(`
          *,
          bom:boms(bom_id, bom_name),
          assembled_item:inventory_items(item_id, item_name),
          assembly_units(
            *,
            assembly_items(
              *,
              item:inventory_items(item_id, item_name),
              source_purchase:purchases(purchase_id, purchase_date, vendors(vendor_name))
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (!assemblies || assemblies.length === 0) {
        setRestoreStatus({ show: true, type: 'warning', message: 'No assemblies to export' });
        return;
      }

      const formattedData: any[] = [];
      assemblies.forEach(assembly => {
        if (assembly.assembly_units && Array.isArray(assembly.assembly_units)) {
          assembly.assembly_units.forEach((unit: any) => {
            if (unit.assembly_items && Array.isArray(unit.assembly_items)) {
              unit.assembly_items.forEach((item: any) => {
                formattedData.push({
                  assembly_id: assembly.id,
                  assembly_date: assembly.created_at,
                  assembly_status: assembly.assembly_status,
                  bom_id: assembly.bom?.bom_id || '',
                  bom_name: assembly.bom?.bom_name || '',
                  assembled_item_id: assembly.assembled_item_id,
                  assembled_item_name: assembly.assembled_item?.item_name || '',
                  unit_quantity: unit.quantity,
                  component_item_id: item.item_id,
                  component_item_name: item.item?.item_name || '',
                  component_quantity_used: item.quantity_used,
                  source_purchase_id: item.source_purchase?.purchase_id || '',
                  source_vendor: item.source_purchase?.vendors?.vendor_name || '',
                  source_purchase_date: item.source_purchase?.purchase_date || '',
                });
              });
            }
          });
        }
      });

      if (formattedData.length === 0) {
        setRestoreStatus({ show: true, type: 'warning', message: 'No assembly details to export' });
        return;
      }

      const headers = Object.keys(formattedData[0]).join(',');
      const rows = formattedData.map(row => Object.values(row).map(v => JSON.stringify(v)).join(',')).join('\n');
      const csv = headers + '\n' + rows;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assemblies_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setRestoreStatus({ show: true, type: 'success', message: 'Assemblies exported successfully' });
    } catch (error: any) {
      setRestoreStatus({ show: true, type: 'error', message: `Failed to export: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const exportTraceability = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('assembly_items')
        .select(`
          *,
          assembly:assemblies(id, created_at, assembly_status, assembled_item_id),
          item:inventory_items(item_id, item_name),
          source_purchase:purchases(
            purchase_id,
            purchase_date,
            purchase_vendor_id,
            vendors(vendor_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (!data || data.length === 0) {
        setRestoreStatus({ show: true, type: 'warning', message: 'No traceability data to export' });
        return;
      }

      const formattedData = data.map(item => ({
        assembly_item_id: item.id,
        assembly_date: item.assembly?.created_at || '',
        assembly_id: item.assembly_id,
        assembly_status: item.assembly?.assembly_status || '',
        assembled_into_item_id: item.assembly?.assembled_item_id || '',
        component_item_id: item.item_id,
        component_item_name: item.item?.item_name || '',
        quantity_used: item.quantity_used,
        source_purchase_id: item.source_purchase?.purchase_id || '',
        source_purchase_date: item.source_purchase?.purchase_date || '',
        source_vendor_id: item.source_purchase?.purchase_vendor_id || '',
        source_vendor_name: item.source_purchase?.vendors?.vendor_name || '',
        created_at: item.created_at,
      }));

      const headers = Object.keys(formattedData[0]).join(',');
      const rows = formattedData.map(row => Object.values(row).map(v => JSON.stringify(v)).join(',')).join('\n');
      const csv = headers + '\n' + rows;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `traceability_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setRestoreStatus({ show: true, type: 'success', message: 'Traceability data exported successfully' });
    } catch (error: any) {
      setRestoreStatus({ show: true, type: 'error', message: `Failed to export: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const exportLeads = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (!data || data.length === 0) {
        setRestoreStatus({ show: true, type: 'warning', message: 'No leads to export' });
        return;
      }

      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => Object.values(row).map(v => JSON.stringify(v)).join(',')).join('\n');
      const csv = headers + '\n' + rows;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setRestoreStatus({ show: true, type: 'success', message: 'Leads exported successfully' });
    } catch (error: any) {
      setRestoreStatus({ show: true, type: 'error', message: `Failed to export: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const exportProspects = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('prospects')
        .select('*')
        .order('created_at', { ascending: false });

      if (!data || data.length === 0) {
        setRestoreStatus({ show: true, type: 'warning', message: 'No prospects to export' });
        return;
      }

      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => Object.values(row).map(v => JSON.stringify(v)).join(',')).join('\n');
      const csv = headers + '\n' + rows;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prospects_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setRestoreStatus({ show: true, type: 'success', message: 'Prospects exported successfully' });
    } catch (error: any) {
      setRestoreStatus({ show: true, type: 'error', message: `Failed to export: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const exportCustomers = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (!data || data.length === 0) {
        setRestoreStatus({ show: true, type: 'warning', message: 'No customers to export' });
        return;
      }

      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => Object.values(row).map(v => JSON.stringify(v)).join(',')).join('\n');
      const csv = headers + '\n' + rows;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setRestoreStatus({ show: true, type: 'success', message: 'Customers exported successfully' });
    } catch (error: any) {
      setRestoreStatus({ show: true, type: 'error', message: `Failed to export: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const exportSales = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers(customer_name),
          sale_items(
            *,
            inventory_item:inventory_items(item_name)
          )
        `)
        .order('sale_date', { ascending: false });

      if (!data || data.length === 0) {
        setRestoreStatus({ show: true, type: 'warning', message: 'No sales to export' });
        return;
      }

      const formattedData: any[] = [];
      data.forEach(sale => {
        if (sale.sale_items && Array.isArray(sale.sale_items)) {
          sale.sale_items.forEach((item: any) => {
            formattedData.push({
              sale_id: sale.sale_id,
              sale_date: sale.sale_date,
              customer_id: sale.customer_id,
              customer_name: sale.customer?.customer_name || '',
              item_id: item.item_id,
              item_name: item.inventory_item?.item_name || '',
              quantity_ordered: item.quantity_ordered,
              quantity_delivered: item.quantity_delivered,
              unit_price: item.unit_price,
              currency: sale.sale_currency,
              payment_terms: sale.payment_terms || '',
              notes: sale.sale_notes || '',
            });
          });
        }
      });

      if (formattedData.length === 0) {
        setRestoreStatus({ show: true, type: 'warning', message: 'No sale items to export' });
        return;
      }

      const headers = Object.keys(formattedData[0]).join(',');
      const rows = formattedData.map(row => Object.values(row).map(v => JSON.stringify(v)).join(',')).join('\n');
      const csv = headers + '\n' + rows;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setRestoreStatus({ show: true, type: 'success', message: 'Sales exported successfully' });
    } catch (error: any) {
      setRestoreStatus({ show: true, type: 'error', message: `Failed to export: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const exportDeliveries = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('deliveries')
        .select(`
          *,
          sale:sales(sale_id, sale_date, customer:customers(customer_name)),
          delivery_items(
            *,
            item:inventory_items(item_name)
          )
        `)
        .order('delivery_date', { ascending: false });

      if (!data || data.length === 0) {
        setRestoreStatus({ show: true, type: 'warning', message: 'No deliveries to export' });
        return;
      }

      const formattedData: any[] = [];
      data.forEach(delivery => {
        if (delivery.delivery_items && Array.isArray(delivery.delivery_items)) {
          delivery.delivery_items.forEach((item: any) => {
            formattedData.push({
              delivery_id: delivery.delivery_id,
              delivery_date: delivery.delivery_date,
              sale_id: delivery.sale_id,
              sale_date: delivery.sale?.sale_date || '',
              customer_name: delivery.sale?.customer?.customer_name || '',
              item_id: item.item_id,
              item_name: item.item?.item_name || '',
              quantity_delivered: item.quantity_delivered,
              delivery_status: delivery.delivery_status,
              delivery_notes: delivery.delivery_notes || '',
            });
          });
        } else {
          formattedData.push({
            delivery_id: delivery.delivery_id,
            delivery_date: delivery.delivery_date,
            sale_id: delivery.sale_id,
            sale_date: delivery.sale?.sale_date || '',
            customer_name: delivery.sale?.customer?.customer_name || '',
            item_id: '',
            item_name: '',
            quantity_delivered: '',
            delivery_status: delivery.delivery_status,
            delivery_notes: delivery.delivery_notes || '',
          });
        }
      });

      const headers = Object.keys(formattedData[0]).join(',');
      const rows = formattedData.map(row => Object.values(row).map(v => JSON.stringify(v)).join(',')).join('\n');
      const csv = headers + '\n' + rows;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deliveries_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setRestoreStatus({ show: true, type: 'success', message: 'Deliveries exported successfully' });
    } catch (error: any) {
      setRestoreStatus({ show: true, type: 'error', message: `Failed to export: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const backupAll = async () => {
    setLoading(true);
    try {
      const [
        dropdownValues,
        vendors,
        items,
        boms,
        bomItems,
        purchases,
        purchaseItems,
        assemblies,
        assemblyUnits,
        assemblyItems,
        leads,
        prospects,
        customers,
        sales,
        saleItems,
        deliveries,
        deliveryItems,
        devices,
        tickets,
      ] = await Promise.all([
        supabase.from('dropdown_values').select('*'),
        supabase.from('vendors').select('*'),
        supabase.from('inventory_items').select('*'),
        supabase.from('boms').select('*'),
        supabase.from('bom_items').select('*'),
        supabase.from('purchases').select('*'),
        supabase.from('purchase_items').select('*'),
        supabase.from('assemblies').select('*'),
        supabase.from('assembly_units').select('*'),
        supabase.from('assembly_items').select('*'),
        supabase.from('leads').select('*'),
        supabase.from('prospects').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('sales').select('*'),
        supabase.from('sale_items').select('*'),
        supabase.from('deliveries').select('*'),
        supabase.from('delivery_items').select('*'),
        supabase.from('devices').select('*'),
        supabase.from('tickets').select('*'),
      ]);

      const backup: BackupData = {
        timestamp: new Date().toISOString(),
        version: '5.0',
        data: {
          dropdown_values: dropdownValues.data || [],
          vendors: vendors.data || [],
          inventory_items: items.data || [],
          boms: boms.data || [],
          bom_items: bomItems.data || [],
          purchases: purchases.data || [],
          purchase_items: purchaseItems.data || [],
          assemblies: assemblies.data || [],
          assembly_units: assemblyUnits.data || [],
          assembly_items: assemblyItems.data || [],
          leads: leads.data || [],
          prospects: prospects.data || [],
          customers: customers.data || [],
          sales: sales.data || [],
          sale_items: saleItems.data || [],
          deliveries: deliveries.data || [],
          delivery_items: deliveryItems.data || [],
          devices: devices.data || [],
          tickets: tickets.data || [],
        },
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cajo_erp_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      await supabase.from('activity_logs').insert({
        activity_user_id: userProfile?.id,
        activity_type: 'BACKUP_DATA',
        activity_description: `Created full system backup (version ${backup.version})`,
        activity_timestamp: new Date().toISOString(),
      });

      setRestoreStatus({ show: true, type: 'success', message: 'Backup created successfully' });
    } catch (error: any) {
      setRestoreStatus({ show: true, type: 'error', message: `Failed to create backup: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const validateBackup = (backup: any): backup is BackupData => {
    if (!backup || typeof backup !== 'object') return false;
    if (!backup.timestamp || !backup.data) return false;
    if (typeof backup.data !== 'object') return false;
    return true;
  };

  const restoreBackup = async (clearExisting: boolean) => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setRestoreStatus({ show: true, type: 'error', message: 'Please select a backup file' });
      return;
    }

    setLoading(true);
    setRestoreStatus({ show: false, type: 'success', message: '' });

    try {
      const fileContent = await file.text();
      const backup: BackupData = JSON.parse(fileContent);

      if (!validateBackup(backup)) {
        setRestoreStatus({ show: true, type: 'error', message: 'Invalid backup file format' });
        return;
      }

      if (clearExisting) {
        const confirmMessage = 'WARNING: This will DELETE ALL existing data before restoring. This action CANNOT be undone. Type "DELETE ALL DATA" to confirm.';
        const userConfirmation = prompt(confirmMessage);

        if (userConfirmation !== 'DELETE ALL DATA') {
          setRestoreStatus({ show: true, type: 'warning', message: 'Restore cancelled - confirmation text did not match' });
          setLoading(false);
          return;
        }

        await deleteAllData();
      }

      const restoreOrder = [
        'dropdown_values',
        'vendors',
        'inventory_items',
        'boms',
        'bom_items',
        'purchases',
        'purchase_items',
        'leads',
        'prospects',
        'customers',
        'assemblies',
        'assembly_units',
        'assembly_items',
        'sales',
        'sale_items',
        'deliveries',
        'delivery_items',
        'devices',
        'tickets',
      ];

      let restored = 0;
      let failed = 0;

      for (const tableName of restoreOrder) {
        const tableData = backup.data[tableName as keyof typeof backup.data];
        if (tableData && Array.isArray(tableData) && tableData.length > 0) {
          try {
            const cleanedData = tableData.map(row => {
              const { created_by, updated_by, ...rest } = row;
              return {
                ...rest,
                created_by: userProfile?.id,
                updated_by: userProfile?.id,
              };
            });

            const { error } = await supabase.from(tableName).insert(cleanedData);

            if (error) {
              console.error(`Error restoring ${tableName}:`, error);
              failed++;
            } else {
              restored++;
            }
          } catch (error: any) {
            console.error(`Failed to restore ${tableName}:`, error);
            failed++;
          }
        }
      }

      await supabase.from('activity_logs').insert({
        activity_user_id: userProfile?.id,
        activity_type: 'RESTORE_BACKUP',
        activity_description: `Restored backup from ${backup.timestamp}: ${restored} tables restored${failed > 0 ? `, ${failed} failed` : ''}${clearExisting ? ' (cleared existing data)' : ''}`,
        activity_timestamp: new Date().toISOString(),
      });

      if (failed === 0) {
        setRestoreStatus({
          show: true,
          type: 'success',
          message: `Backup restored successfully! ${restored} tables restored.`,
        });
      } else {
        setRestoreStatus({
          show: true,
          type: 'warning',
          message: `Backup partially restored. ${restored} tables succeeded, ${failed} failed. Check console for details.`,
        });
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Restore error:', error);
      setRestoreStatus({
        show: true,
        type: 'error',
        message: `Failed to restore backup: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteAllData = async () => {
    const deleteOrder = [
      'tickets',
      'devices',
      'delivery_items',
      'deliveries',
      'sale_items',
      'sales',
      'assembly_items',
      'assembly_units',
      'assemblies',
      'bom_items',
      'boms',
      'purchase_items',
      'purchases',
      'customers',
      'prospects',
      'leads',
      'inventory_items',
      'vendors',
      'dropdown_values',
    ];

    for (const tableName of deleteOrder) {
      try {
        await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (error: any) {
        console.error(`Failed to clear ${tableName}:`, error);
      }
    }
  };

  return (
    <div className="space-y-8">
      {restoreStatus.show && (
        <div
          className={`p-4 rounded-lg border ${
            restoreStatus.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400'
              : restoreStatus.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-400'
          }`}
        >
          <div className="flex items-start space-x-3">
            {restoreStatus.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <p className="text-sm flex-1">{restoreStatus.message}</p>
            <button
              onClick={() => setRestoreStatus({ ...restoreStatus, show: false })}
              className="text-sm font-medium hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {hasWriteAccess && (
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Upload CSV Data</h2>

          {hasTransactions === null ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
              <p className="text-sm text-slate-500 mt-2">Checking for transactions...</p>
            </div>
          ) : hasTransactions ? (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-400">
                  <p className="font-semibold mb-1">CSV Upload Disabled</p>
                  <p>CSV uploads for Items and Vendors are only available when there are no transactions (purchases, assemblies, or sales) in the system. This prevents data conflicts and inconsistencies.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800 dark:text-green-400">
                    <p className="font-semibold mb-1">CSV Upload Available</p>
                    <p>No transactions detected. You can safely upload Items and Vendors CSV files.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Upload Items CSV</h3>

                  <input
                    ref={itemsCSVInputRef}
                    type="file"
                    accept=".csv"
                    className="block w-full text-sm text-slate-500 dark:text-slate-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-medium
                      file:bg-green-50 file:text-green-700
                      hover:file:bg-green-100
                      dark:file:bg-green-900/20 dark:file:text-green-400
                      dark:hover:file:bg-green-900/30
                      file:cursor-pointer cursor-pointer"
                  />

                  <div className="space-y-2">
                    <button
                      onClick={() => uploadCSV('items', 'replace')}
                      disabled={loading}
                      className="w-full flex items-center justify-center space-x-2 p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      <FileUp className="w-4 h-4" />
                      <span className="text-sm font-medium">Replace All Items</span>
                    </button>

                    <button
                      onClick={() => uploadCSV('items', 'append')}
                      disabled={loading}
                      className="w-full flex items-center justify-center space-x-2 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      <FileUp className="w-4 h-4" />
                      <span className="text-sm font-medium">Append New Items</span>
                    </button>

                    <button
                      onClick={() => uploadCSV('items', 'merge')}
                      disabled={loading}
                      className="w-full flex items-center justify-center space-x-2 p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      <FileUp className="w-4 h-4" />
                      <span className="text-sm font-medium">Merge Items</span>
                    </button>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <p><strong>Replace:</strong> Deletes all existing items, then uploads CSV data</p>
                    <p><strong>Append:</strong> Adds new items from CSV, skips duplicates</p>
                    <p><strong>Merge:</strong> Updates existing items, adds new ones</p>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded p-2 space-y-1">
                    <p className="font-semibold">Required columns:</p>
                    <p className="font-mono text-[10px]">item_id, item_name, item_display_name, item_unit, item_group, item_class, item_stock_min, item_stock_max, item_stock_reorder, item_serial_number_tracked</p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Upload Vendors CSV</h3>

                  <input
                    ref={vendorsCSVInputRef}
                    type="file"
                    accept=".csv"
                    className="block w-full text-sm text-slate-500 dark:text-slate-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-medium
                      file:bg-green-50 file:text-green-700
                      hover:file:bg-green-100
                      dark:file:bg-green-900/20 dark:file:text-green-400
                      dark:hover:file:bg-green-900/30
                      file:cursor-pointer cursor-pointer"
                  />

                  <div className="space-y-2">
                    <button
                      onClick={() => uploadCSV('vendors', 'replace')}
                      disabled={loading}
                      className="w-full flex items-center justify-center space-x-2 p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      <FileUp className="w-4 h-4" />
                      <span className="text-sm font-medium">Replace All Vendors</span>
                    </button>

                    <button
                      onClick={() => uploadCSV('vendors', 'append')}
                      disabled={loading}
                      className="w-full flex items-center justify-center space-x-2 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      <FileUp className="w-4 h-4" />
                      <span className="text-sm font-medium">Append New Vendors</span>
                    </button>

                    <button
                      onClick={() => uploadCSV('vendors', 'merge')}
                      disabled={loading}
                      className="w-full flex items-center justify-center space-x-2 p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      <FileUp className="w-4 h-4" />
                      <span className="text-sm font-medium">Merge Vendors</span>
                    </button>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <p><strong>Replace:</strong> Deletes all existing vendors, then uploads CSV data</p>
                    <p><strong>Append:</strong> Adds new vendors from CSV, skips duplicates</p>
                    <p><strong>Merge:</strong> Updates existing vendors, adds new ones</p>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded p-2 space-y-1">
                    <p className="font-semibold">Required columns:</p>
                    <p className="font-mono text-[10px]">vendor_id, vendor_name, vendor_name_legal, vendor_group, vendor_contact_name, vendor_email, vendor_phone, vendor_address, vendor_currency, vendor_rating_price, vendor_rating_quality, vendor_rating_lead</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">CSV Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => downloadTemplate('items')}
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Download className="w-5 h-5 text-green-600" />
              <span className="font-medium text-slate-900 dark:text-white">Items Template</span>
            </div>
            <span className="text-sm text-slate-500">CSV</span>
          </button>

          <button
            onClick={() => downloadTemplate('vendors')}
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Download className="w-5 h-5 text-green-600" />
              <span className="font-medium text-slate-900 dark:text-white">Vendors Template</span>
            </div>
            <span className="text-sm text-slate-500">CSV</span>
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Export Data</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => downloadData('items')}
            disabled={loading}
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center space-x-3">
              <Upload className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Export Items</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{recordCounts.items || 0} records</div>
              </div>
            </div>
            <span className="text-sm text-slate-500">CSV</span>
          </button>

          <button
            onClick={() => downloadData('vendors')}
            disabled={loading}
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center space-x-3">
              <Upload className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Export Vendors</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{recordCounts.vendors || 0} records</div>
              </div>
            </div>
            <span className="text-sm text-slate-500">CSV</span>
          </button>

          <button
            onClick={exportPurchases}
            disabled={loading}
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center space-x-3">
              <Upload className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Export Purchases</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{recordCounts.purchases || 0} records</div>
              </div>
            </div>
            <span className="text-sm text-slate-500">CSV</span>
          </button>

          <button
            onClick={exportBOM}
            disabled={loading}
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center space-x-3">
              <Upload className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Export BOM</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{recordCounts.boms || 0} records</div>
              </div>
            </div>
            <span className="text-sm text-slate-500">CSV</span>
          </button>

          <button
            onClick={exportAssemblies}
            disabled={loading}
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center space-x-3">
              <Upload className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Export Assemblies</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{recordCounts.assemblies || 0} records</div>
              </div>
            </div>
            <span className="text-sm text-slate-500">CSV</span>
          </button>

          <button
            onClick={exportTraceability}
            disabled={loading}
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center space-x-3">
              <Upload className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Export Traceability</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{recordCounts.traceability || 0} records</div>
              </div>
            </div>
            <span className="text-sm text-slate-500">CSV</span>
          </button>

          <button
            onClick={exportLeads}
            disabled={loading}
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center space-x-3">
              <Upload className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Export Leads</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{recordCounts.leads || 0} records</div>
              </div>
            </div>
            <span className="text-sm text-slate-500">CSV</span>
          </button>

          <button
            onClick={exportProspects}
            disabled={loading}
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center space-x-3">
              <Upload className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Export Prospects</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{recordCounts.prospects || 0} records</div>
              </div>
            </div>
            <span className="text-sm text-slate-500">CSV</span>
          </button>

          <button
            onClick={exportCustomers}
            disabled={loading}
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center space-x-3">
              <Upload className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Export Customers</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{recordCounts.customers || 0} records</div>
              </div>
            </div>
            <span className="text-sm text-slate-500">CSV</span>
          </button>

          <button
            onClick={exportSales}
            disabled={loading}
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center space-x-3">
              <Upload className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Export Sales</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{recordCounts.sales || 0} records</div>
              </div>
            </div>
            <span className="text-sm text-slate-500">CSV</span>
          </button>

          <button
            onClick={exportDeliveries}
            disabled={loading}
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center space-x-3">
              <Upload className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Export Deliveries</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{recordCounts.deliveries || 0} records</div>
              </div>
            </div>
            <span className="text-sm text-slate-500">CSV</span>
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Backup & Restore</h2>
        <div className="space-y-4">
          <button
            onClick={backupAll}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-3 p-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Database className="w-5 h-5" />
            <span className="font-medium">
              {loading ? 'Creating Backup...' : 'Download Complete Backup'}
            </span>
          </button>

          {hasWriteAccess && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">Restore from Backup</h3>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="block w-full text-sm text-slate-500 dark:text-slate-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-green-50 file:text-green-700
                  hover:file:bg-green-100
                  dark:file:bg-green-900/20 dark:file:text-green-400
                  dark:hover:file:bg-green-900/30
                  file:cursor-pointer cursor-pointer"
              />

              <button
                onClick={() => restoreBackup(true)}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {loading ? 'Restoring...' : 'Restore (Clear Existing)'}
                </span>
              </button>
            </div>
          )}

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-400 space-y-2">
                <p className="font-semibold">Important Backup Information:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Backups include all data: items, vendors, BOMs, assemblies, purchases, traceability, leads, prospects, customers, sales, deliveries, devices, and tickets</li>
                  <li><strong>Warning:</strong> Restore will delete ALL current data before restoring. This action cannot be undone!</li>
                  <li>Store backups securely in multiple locations for disaster recovery</li>
                  <li>Test restore procedures regularly to ensure backup integrity</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
