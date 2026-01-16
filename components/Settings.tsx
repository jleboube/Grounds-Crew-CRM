
import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Save,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';
import { storage } from '../services/storageService';
import { geocodeStructuredAddress } from '../services/geocodingService';
import { ShopLocation } from '../types';
import { DEFAULT_CITY, DEFAULT_STATE, NEARBY_STATES } from '../utils/addressUtils';

export const Settings: React.FC = () => {
  const [shopLocation, setShopLocation] = useState<ShopLocation>({
    street: '',
    street2: '',
    city: DEFAULT_CITY,
    state: DEFAULT_STATE,
    zip: ''
  });
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load existing shop location on mount
  useEffect(() => {
    const saved = storage.getShopLocation();
    if (saved) {
      setShopLocation(saved);
    }
  }, []);

  const handleSave = async () => {
    if (!shopLocation.street) {
      setStatusMsg({ type: 'error', text: 'Street address is required' });
      return;
    }

    setSaving(true);
    setGeocoding(true);
    setStatusMsg(null);

    try {
      // Geocode the shop address
      const result = await geocodeStructuredAddress({
        street: shopLocation.street,
        street2: shopLocation.street2,
        city: shopLocation.city,
        state: shopLocation.state,
        zip: shopLocation.zip
      });

      if (result) {
        const updatedLocation: ShopLocation = {
          ...shopLocation,
          latitude: result.latitude,
          longitude: result.longitude
        };
        storage.saveShopLocation(updatedLocation);
        setShopLocation(updatedLocation);
        setStatusMsg({ type: 'success', text: 'Shop location saved and geocoded successfully!' });
      } else {
        // Save without coordinates
        storage.saveShopLocation(shopLocation);
        setStatusMsg({ type: 'error', text: 'Location saved but could not be geocoded. Route optimization may not work correctly.' });
      }
    } catch (error) {
      console.error('Error saving shop location:', error);
      setStatusMsg({ type: 'error', text: 'Error saving shop location' });
    } finally {
      setSaving(false);
      setGeocoding(false);
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-slate-500 mt-1">Configure your business settings and preferences.</p>
      </header>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden max-w-2xl">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Shop Location</h2>
              <p className="text-emerald-50 text-sm opacity-80">Starting and ending point for all routes</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {statusMsg && (
            <div className={`p-4 rounded-xl flex items-center gap-3 ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {statusMsg.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="font-medium">{statusMsg.text}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Street Address</label>
            <input
              type="text"
              value={shopLocation.street}
              onChange={(e) => setShopLocation({ ...shopLocation, street: e.target.value })}
              className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900"
              placeholder="123 Main St"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Suite / Unit (Optional)</label>
            <input
              type="text"
              value={shopLocation.street2 || ''}
              onChange={(e) => setShopLocation({ ...shopLocation, street2: e.target.value })}
              className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900"
              placeholder="Suite 100"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">City</label>
              <input
                type="text"
                value={shopLocation.city}
                onChange={(e) => setShopLocation({ ...shopLocation, city: e.target.value })}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900"
                placeholder="Evansville"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">State</label>
              <select
                value={shopLocation.state}
                onChange={(e) => setShopLocation({ ...shopLocation, state: e.target.value })}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-900 appearance-none"
              >
                {NEARBY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ZIP Code</label>
              <input
                type="text"
                value={shopLocation.zip}
                onChange={(e) => setShopLocation({ ...shopLocation, zip: e.target.value })}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900"
                placeholder="47711"
                maxLength={10}
              />
            </div>
          </div>

          {shopLocation.latitude && shopLocation.longitude && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-sm font-bold text-emerald-700">Location Verified</p>
                <p className="text-xs text-emerald-600">Coordinates: {shopLocation.latitude.toFixed(6)}, {shopLocation.longitude.toFixed(6)}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !shopLocation.street}
            className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-100"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {geocoding ? 'Geocoding...' : 'Saving...'}
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Shop Location
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
