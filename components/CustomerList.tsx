
import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Upload, 
  MapPin,
  Filter,
  Trash2,
  Download,
  Edit2,
  Sparkles,
  Loader2,
  X,
  Scissors,
  Droplets,
  Wind,
  Snowflake,
  Check,
  AlertCircle,
  Timer
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { storage, formatFullAddress } from '../services/storageService';
import { gemini } from '../services/geminiService';
import { Customer, ServiceType, GrassType, SunExposure, CustomerServices } from '../types';
import { parseAddressString, DEFAULT_CITY, DEFAULT_STATE, NEARBY_STATES } from '../utils/addressUtils';

export const CustomerList: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>(storage.getCustomers());
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetectingSun, setIsDetectingSun] = useState(false);
  const [importStatus, setImportStatus] = useState<{success: number, failed: number, msg: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const defaultServices: CustomerServices = {
    mow: false,
    mowDuration: 30,
    fertilize: false,
    fertilizeDuration: 15,
    leafRemoval: false,
    leafRemovalDuration: 45,
    snowRemoval: false,
    snowRemovalDuration: 60
  };

  const getInitialFormState = (): Customer => ({
    id: '',
    name: '',
    street: '',
    street2: '',
    city: DEFAULT_CITY,
    state: DEFAULT_STATE,
    zip: '',
    email: '',
    phone: '',
    notes: '',
    serviceType: ServiceType.LAWN_CARE,
    services: { ...defaultServices },
    grassType: GrassType.UNKNOWN,
    sunExposure: SunExposure.FULL_SUN,
    lastServiceDate: new Date().toISOString().split('T')[0]
  });

  const [formData, setFormData] = useState<Customer>(getInitialFormState());
  const [editingId, setEditingId] = useState<string | null>(null);

  const openModal = (customer?: Customer) => {
    if (customer) {
      setFormData({ 
        ...customer,
        services: { ...defaultServices, ...customer.services } // Ensure new duration fields are populated
      });
      setEditingId(customer.id);
    } else {
      setFormData(getInitialFormState());
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (formData.name && formData.street) {
      const customer: Customer = {
        ...formData,
        id: editingId || Math.random().toString(36).substr(2, 9),
      };

      storage.saveCustomer(customer);
      setCustomers(storage.getCustomers());
      setIsModalOpen(false);
    }
  };

  const toggleService = (service: keyof CustomerServices) => {
    // We only toggle the boolean parts here
    if (typeof formData.services[service] === 'boolean') {
      setFormData(prev => ({
        ...prev,
        services: {
          ...prev.services,
          [service]: !prev.services[service]
        }
      }));
    }
  };

  const updateDuration = (serviceKey: keyof CustomerServices, value: string) => {
    const numValue = parseInt(value, 10) || 0;
    setFormData(prev => ({
      ...prev,
      services: {
        ...prev.services,
        [serviceKey]: numValue
      }
    }));
  };

  const detectSun = async () => {
    if (!formData.street) return;
    setIsDetectingSun(true);
    try {
      const fullAddress = formatFullAddress(formData);
      const exposure = await gemini.determineSunExposure(fullAddress);
      setFormData(prev => ({ ...prev, sunExposure: exposure }));
    } catch (error) {
      console.error(error);
    } finally {
      setIsDetectingSun(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this customer?')) {
      storage.deleteCustomer(id);
      setCustomers(storage.getCustomers());
    }
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to delete ALL customers? This cannot be undone.')) {
      storage.getCustomers().forEach(c => storage.deleteCustomer(c.id));
      setCustomers([]);
      setImportStatus({ success: 0, failed: 0, msg: 'All customers cleared. Ready for fresh import.' });
      setTimeout(() => setImportStatus(null), 3000);
    }
  };

  const processImportedData = (rawData: any[]) => {
    const rows = rawData.map(row => {
      if (Array.isArray(row)) return row.map(c => c?.toString().trim() || '');
      if (typeof row === 'object') {
        const cleaned: Record<string, string> = {};
        Object.entries(row).forEach(([k, v]) => cleaned[k] = v?.toString().trim() || '');
        return cleaned;
      }
      return row;
    }).filter(row => {
      if (Array.isArray(row)) return row.some(c => c !== '');
      if (typeof row === 'object') return Object.values(row).some(v => v !== '');
      return false;
    });

    if (rows.length === 0) {
      setImportStatus({ success: 0, failed: 0, msg: "The file appears to be empty." });
      return;
    }

    let successCount = 0;
    let failedCount = 0;
    let startIdx = 0;

    // Check if first row is a header
    const firstRow = rows[0];
    const isHeaderCandidate = (row: any) => {
      const values = Array.isArray(row) ? row : Object.values(row);
      return values.some(v => typeof v === 'string' && ['name', 'first', 'last', 'address', 'customer', 'street'].some(kw => v.toLowerCase().includes(kw)));
    };

    if (isHeaderCandidate(firstRow)) {
      startIdx = 1;
    }

    // Helper functions to detect field types
    const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
    const isPhone = (s: string) => /^[\d\s\-().+]+$/.test(s) && s.replace(/\D/g, '').length >= 7;
    const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s);
    const isGrassType = (s: string) => ['bermuda', 'fescue', 'kentucky', 'bluegrass', 'zoysia', 'st. augustine', 'unknown'].some(g => s.toLowerCase().includes(g));
    const isSunExposure = (s: string) => ['full sun', 'partial shade', 'dense shade', 'partial sun'].some(se => s.toLowerCase().includes(se));

    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;

      // Smart field detection for CSVs with addresses containing commas
      // Strategy: Name is first, then scan for email/@, phone pattern, date, grass, sun
      // Everything between name and phone/email is the address

      let name = row[0] || '';
      let email = '';
      let phone = '';
      let grassType = GrassType.UNKNOWN;
      let sunExposure = SunExposure.FULL_SUN;
      let lastServiceDate = new Date().toISOString().split('T')[0];
      let notes = '';

      // Find indices of recognizable fields
      let emailIdx = -1;
      let phoneIdx = -1;
      let dateIdx = -1;
      let grassIdx = -1;
      let sunIdx = -1;

      for (let j = 1; j < row.length; j++) {
        const val = row[j];
        if (emailIdx === -1 && isEmail(val)) emailIdx = j;
        if (phoneIdx === -1 && isPhone(val) && !isDate(val)) phoneIdx = j;
        if (dateIdx === -1 && isDate(val)) dateIdx = j;
        if (grassIdx === -1 && isGrassType(val)) grassIdx = j;
        if (sunIdx === -1 && isSunExposure(val)) sunIdx = j;
      }

      // Determine where address ends: it's everything between index 1 and the first detected field
      const firstKnownIdx = Math.min(
        ...[emailIdx, phoneIdx, grassIdx, sunIdx, dateIdx].filter(x => x > 0)
      );

      // Build address from all fields between name and first known field
      let addressParts: string[] = [];
      const addressEndIdx = firstKnownIdx !== Infinity ? firstKnownIdx : row.length;
      for (let j = 1; j < addressEndIdx; j++) {
        if (row[j]) addressParts.push(row[j]);
      }
      const address = addressParts.join(', ').trim();

      // Extract other fields
      if (emailIdx > 0) email = row[emailIdx];
      if (phoneIdx > 0) phone = row[phoneIdx];
      if (dateIdx > 0) lastServiceDate = row[dateIdx];
      if (grassIdx > 0) {
        const g = row[grassIdx].toLowerCase();
        if (g.includes('bermuda')) grassType = GrassType.BERMUDA;
        else if (g.includes('fescue')) grassType = GrassType.FESCUE;
        else if (g.includes('kentucky') || g.includes('bluegrass')) grassType = GrassType.KENTUCKY_BLUEGRASS;
        else if (g.includes('zoysia')) grassType = GrassType.ZOYSIA;
        else if (g.includes('augustine')) grassType = GrassType.ST_AUGUSTINE;
      }
      if (sunIdx > 0) {
        const s = row[sunIdx].toLowerCase();
        if (s.includes('full')) sunExposure = SunExposure.FULL_SUN;
        else if (s.includes('partial')) sunExposure = SunExposure.PARTIAL_SHADE;
        else if (s.includes('dense')) sunExposure = SunExposure.DENSE_SHADE;
      }

      // Notes is typically the last field if it doesn't match other patterns
      const lastIdx = row.length - 1;
      if (lastIdx > 0 && ![emailIdx, phoneIdx, dateIdx, grassIdx, sunIdx].includes(lastIdx)) {
        const lastVal = row[lastIdx];
        if (lastVal && !isEmail(lastVal) && !isPhone(lastVal) && !isDate(lastVal) && !isGrassType(lastVal) && !isSunExposure(lastVal)) {
          notes = lastVal;
        }
      }

      if (name && address) {
        // Parse address string into structured components
        const parsed = parseAddressString(address);

        storage.saveCustomer({
          id: Math.random().toString(36).substr(2, 9),
          name,
          street: parsed.street,
          street2: parsed.street2 || '',
          city: parsed.city || DEFAULT_CITY,
          state: parsed.state || DEFAULT_STATE,
          zip: parsed.zip || '',
          email,
          phone,
          notes,
          serviceType: ServiceType.LAWN_CARE,
          services: { ...defaultServices },
          grassType,
          sunExposure,
          lastServiceDate
        });
        successCount++;
      } else {
        failedCount++;
      }
    }

    setCustomers(storage.getCustomers());
    setImportStatus({
      success: successCount,
      failed: failedCount,
      msg: `Import complete. ${successCount} added, ${failedCount} skipped.`
    });
    setTimeout(() => setImportStatus(null), 5000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'csv') {
      Papa.parse(file, { header: false, skipEmptyLines: false, complete: (results) => processImportedData(results.data) });
    } else if (extension === 'xls' || extension === 'xlsx') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        processImportedData(data);
      };
      reader.readAsBinaryString(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredCustomers = customers.filter(c => {
    const query = searchQuery.toLowerCase();
    const fullAddress = formatFullAddress(c).toLowerCase();
    return c.name.toLowerCase().includes(query) || fullAddress.includes(query);
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Customer Directory</h1>
          <p className="text-slate-500 mt-1">Manage service locations with AI-optimized property profiles.</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv, .xls, .xlsx" />
          {customers.length > 0 && (
            <button onClick={handleClearAll} className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-red-600 font-bold hover:bg-red-100 shadow-sm transition-all text-sm">
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 shadow-sm transition-all">
            <Upload className="w-4 h-4" />
            Bulk Import
          </button>
          <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all">
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </header>

      {importStatus && (
        <div className={`p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4 border ${importStatus.success > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${importStatus.success > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
              {importStatus.success > 0 ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            </div>
            <p className="text-sm font-bold">{importStatus.msg}</p>
          </div>
          <button onClick={() => setImportStatus(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Filter customers..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm text-slate-900 font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Details</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Property Features</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Search className="w-12 h-12 opacity-20" />
                      <p className="text-lg font-medium">No customers found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-emerald-50/30 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center font-bold text-emerald-700 shadow-inner">
                          {customer.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{customer.name}</p>
                          <p className="text-xs text-slate-500">{customer.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span className="line-clamp-1">{formatFullAddress(customer)}</span>
                        </div>
                        <div className="flex gap-2">
                           <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-bold uppercase tracking-tight">{customer.grassType}</span>
                           <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight flex items-center gap-1 ${customer.sunExposure === SunExposure.FULL_SUN ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                             {customer.sunExposure}
                           </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                         <button onClick={() => openModal(customer)} className="p-2.5 hover:bg-white hover:shadow-md rounded-xl text-slate-400 hover:text-blue-600 transition-all"><Edit2 className="w-4 h-4" /></button>
                         <button onClick={() => handleDelete(customer.id)} className="p-2.5 hover:bg-white hover:shadow-md rounded-xl text-slate-400 hover:text-red-600 transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
            <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-teal-600 text-white relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              <h3 className="text-2xl font-black">{editingId ? 'Update Profile' : 'New Property'}</h3>
              <p className="text-emerald-50 text-sm font-medium opacity-80 mt-1">{editingId ? `Editing details for ${formData.name}` : 'Onboard a new client location.'}</p>
            </div>
            
            <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-8">
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900"
                    placeholder="e.g. Sarah Jenkins"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900"
                    placeholder="email@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Street Address</label>
                  <input
                    type="text"
                    value={formData.street}
                    onChange={(e) => setFormData({...formData, street: e.target.value})}
                    onBlur={() => !editingId && formData.street && detectSun()}
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900"
                    placeholder="123 Main St"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apt / Suite / Unit (Optional)</label>
                  <input
                    type="text"
                    value={formData.street2 || ''}
                    onChange={(e) => setFormData({...formData, street2: e.target.value})}
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900"
                    placeholder="Apt 2B"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900"
                    placeholder="Evansville"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">State</label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value})}
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-900 appearance-none"
                  >
                    {NEARBY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ZIP Code</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.zip}
                      onChange={(e) => setFormData({...formData, zip: e.target.value})}
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900 pr-12"
                      placeholder="47711"
                      maxLength={10}
                    />
                    {isDetectingSun && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 className="w-5 h-5 text-emerald-500 animate-spin" /></div>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grass Type</label>
                  <select 
                    value={formData.grassType}
                    onChange={(e) => setFormData({...formData, grassType: e.target.value as GrassType})}
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-900 appearance-none"
                  >
                    {Object.values(GrassType).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sun Exposure (AI Determined)</label>
                  <div 
                    onClick={detectSun}
                    className={`flex items-center gap-3 w-full px-5 py-4 border rounded-2xl font-bold transition-all cursor-pointer hover:shadow-md ${isDetectingSun ? 'bg-slate-50 border-slate-200 text-slate-400' : formData.sunExposure === SunExposure.FULL_SUN ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                    {isDetectingSun ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isDetectingSun ? 'Analyzing...' : formData.sunExposure}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Services & Estimated Duration</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'mow', durationKey: 'mowDuration', label: 'Mow', icon: Scissors, color: 'emerald' },
                    { key: 'fertilize', durationKey: 'fertilizeDuration', label: 'Fertilize', icon: Droplets, color: 'blue' },
                    { key: 'leafRemoval', durationKey: 'leafRemovalDuration', label: 'Leaf Removal', icon: Wind, color: 'orange' },
                    { key: 'snowRemoval', durationKey: 'snowRemovalDuration', label: 'Snow Removal', icon: Snowflake, color: 'indigo' },
                  ].map((service) => {
                    const isActive = formData.services[service.key as keyof CustomerServices];
                    const durationValue = formData.services[service.durationKey as keyof CustomerServices];
                    
                    return (
                      <div key={service.key} className={`flex flex-col p-4 rounded-2xl border-2 transition-all gap-4 ${isActive ? `border-${service.color}-500 bg-${service.color}-50 shadow-inner` : 'border-slate-100 bg-white'}`}>
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => toggleService(service.key as keyof CustomerServices)}
                            className={`flex items-center gap-3 font-bold transition-all ${isActive ? `text-${service.color}-700` : 'text-slate-400'}`}
                          >
                            <service.icon className={`w-6 h-6 ${isActive ? `text-${service.color}-600` : 'text-slate-300'}`} />
                            <span className="text-[10px] font-black uppercase tracking-tight">{service.label}</span>
                          </button>
                          {isActive && <div className={`w-5 h-5 bg-${service.color}-500 rounded-full flex items-center justify-center`}><Check className="w-3 h-3 text-white" /></div>}
                        </div>

                        {isActive && (
                          <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                             <div className="flex items-center justify-between">
                               <label className="text-[9px] font-black text-slate-400 uppercase">Est. Minutes</label>
                               <Timer className="w-3 h-3 text-slate-300" />
                             </div>
                             <input 
                              type="number" 
                              value={durationValue}
                              onChange={(e) => updateDuration(service.durationKey as keyof CustomerServices, e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold text-slate-900 text-sm"
                              placeholder="Minutes"
                             />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                  className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900 resize-none"
                  placeholder="Any special instructions or notes about this property..."
                />
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
              <button onClick={() => setIsModalOpen(false)} className="px-8 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 font-bold hover:bg-slate-100 transition-all">Cancel</button>
              <button onClick={handleSave} disabled={isDetectingSun} className="px-10 py-3 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-xl shadow-emerald-100">{editingId ? 'Update Customer' : 'Save Property'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
