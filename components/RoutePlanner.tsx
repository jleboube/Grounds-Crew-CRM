
import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Navigation,
  Mail,
  GripVertical,
  BrainCircuit,
  Calendar,
  Sparkles,
  RefreshCw,
  X,
  Check,
  Search,
  UserPlus,
  Trash2,
  MapPin,
  Loader2,
  AlertCircle,
  Building2
} from 'lucide-react';
import { storage, formatFullAddress } from '../services/storageService';
import { geocodeStructuredAddress, calculateTotalRouteDistance, fullyOptimizeRoute, clearGeocodingCache } from '../services/geocodingService';
import { Customer, CustomerServices, ShopLocation } from '../types';
import { RouteMap, MapMarker } from './RouteMap';

interface CustomerWithCoords extends Customer {
  lat?: number;
  lng?: number;
  geocoded?: boolean;
  geocoding?: boolean;
  confidence?: 'high' | 'medium' | 'low';
}

export const RoutePlanner: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [allCustomers, setAllCustomers] = useState<CustomerWithCoords[]>([]);
  const [routeCustomerIds, setRouteCustomerIds] = useState<string[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [geocodingStatus, setGeocodingStatus] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [totalDistance, setTotalDistance] = useState<number | null>(null);
  const [shopLocation, setShopLocation] = useState<ShopLocation | null>(null);

  // Customer Picker Modal State
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);

  // Load customers and shop location on mount
  useEffect(() => {
    const customers = storage.getCustomers();
    setAllCustomers(customers.map(c => ({
      ...c,
      lat: c.latitude,
      lng: c.longitude,
      geocoded: !!(c.latitude && c.longitude),
      confidence: c.geocodeConfidence
    })));

    // Load shop location
    const shop = storage.getShopLocation();
    setShopLocation(shop);
  }, []);

  // Geocode customers that don't have coordinates
  const geocodeCustomers = useCallback(async (customerIds: string[]) => {
    const customersToGeocode = allCustomers.filter(
      c => customerIds.includes(c.id) && !c.geocoded && !c.geocoding
    );

    if (customersToGeocode.length === 0) return;

    setGeocodingStatus(`Geocoding ${customersToGeocode.length} address${customersToGeocode.length > 1 ? 'es' : ''}...`);

    for (const customer of customersToGeocode) {
      // Mark as geocoding
      setAllCustomers(prev => prev.map(c =>
        c.id === customer.id ? { ...c, geocoding: true } : c
      ));

      try {
        // Use structured address for geocoding
        const result = await geocodeStructuredAddress({
          street: customer.street,
          street2: customer.street2,
          city: customer.city,
          state: customer.state,
          zip: customer.zip
        });
        if (result) {
          // Update customer with coordinates and confidence
          setAllCustomers(prev => prev.map(c =>
            c.id === customer.id
              ? { ...c, lat: result.latitude, lng: result.longitude, geocoded: true, geocoding: false, confidence: result.confidence }
              : c
          ));

          // Save coordinates and confidence to storage
          const updatedCustomer = {
            ...customer,
            latitude: result.latitude,
            longitude: result.longitude,
            geocodeConfidence: result.confidence
          };
          storage.saveCustomer(updatedCustomer);
        } else {
          setAllCustomers(prev => prev.map(c =>
            c.id === customer.id ? { ...c, geocoding: false } : c
          ));
        }
      } catch (error) {
        console.error('Geocoding error for', customer.name, error);
        setAllCustomers(prev => prev.map(c =>
          c.id === customer.id ? { ...c, geocoding: false } : c
        ));
      }
    }

    setGeocodingStatus('');
  }, [allCustomers]);

  // Geocode when route customers change
  useEffect(() => {
    if (routeCustomerIds.length > 0) {
      geocodeCustomers(routeCustomerIds);
    }
  }, [routeCustomerIds]);

  // Calculate total distance when route changes (including shop as start/end)
  useEffect(() => {
    const displayOrder = optimizedRoute.length > 0 ? optimizedRoute : routeCustomerIds;
    const routeCustomers = displayOrder
      .map(id => allCustomers.find(c => c.id === id))
      .filter((c): c is CustomerWithCoords => !!c && !!c.lat && !!c.lng);

    if (routeCustomers.length >= 1) {
      const customerCoords = routeCustomers.map(c => ({ lat: c.lat!, lng: c.lng! }));

      // Include shop location as start and end if available
      if (shopLocation?.latitude && shopLocation?.longitude) {
        const shopCoord = { lat: shopLocation.latitude, lng: shopLocation.longitude };
        const fullRoute = [shopCoord, ...customerCoords, shopCoord];
        const distance = calculateTotalRouteDistance(fullRoute);
        setTotalDistance(distance);
      } else if (routeCustomers.length >= 2) {
        const distance = calculateTotalRouteDistance(customerCoords);
        setTotalDistance(distance);
      } else {
        setTotalDistance(null);
      }
    } else {
      setTotalDistance(null);
    }
  }, [optimizedRoute, routeCustomerIds, allCustomers, shopLocation]);

  // Get customers that are in the route
  const routeCustomers = routeCustomerIds
    .map(id => allCustomers.find(c => c.id === id))
    .filter(Boolean) as CustomerWithCoords[];

  // Get customers available to add (not already in route)
  const availableToAdd = allCustomers.filter(c => !routeCustomerIds.includes(c.id));

  // Filtered available customers based on search
  const filteredAvailable = availableToAdd.filter(c => {
    const query = searchQuery.toLowerCase();
    const fullAddress = formatFullAddress(c).toLowerCase();
    return c.name.toLowerCase().includes(query) || fullAddress.includes(query);
  });

  const openCustomerPicker = () => {
    setSearchQuery('');
    setSelectedToAdd([]);
    setIsPickerOpen(true);
  };

  const toggleSelectCustomer = (customerId: string) => {
    setSelectedToAdd(prev =>
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const addSelectedToRoute = () => {
    if (selectedToAdd.length > 0) {
      setRouteCustomerIds(prev => [...prev, ...selectedToAdd]);
      setOptimizedRoute([]);
      setStatusMsg(`Added ${selectedToAdd.length} customer${selectedToAdd.length > 1 ? 's' : ''} to route.`);
      setTimeout(() => setStatusMsg(''), 3000);
    }
    setIsPickerOpen(false);
  };

  const removeFromRoute = (customerId: string) => {
    setRouteCustomerIds(prev => prev.filter(id => id !== customerId));
    setOptimizedRoute(prev => prev.filter(id => id !== customerId));
  };

  // Re-geocode all customers (clears bad cached coordinates)
  const regeocodeAll = async () => {
    setLoading(true);
    setStatusMsg('Clearing cached coordinates...');

    // Clear storage and cache
    storage.clearAllCoordinates();
    clearGeocodingCache();

    // Reset all customers to not geocoded
    const customers = storage.getCustomers();
    const reset = customers.map(c => ({
      ...c,
      lat: undefined,
      lng: undefined,
      geocoded: false,
      geocoding: false
    }));
    setAllCustomers(reset);

    // Clear optimized route
    setOptimizedRoute([]);

    setStatusMsg('Re-geocoding addresses with Indiana bias...');
    setLoading(false);

    // Trigger re-geocoding for route customers
    if (routeCustomerIds.length > 0) {
      // Small delay to let state update
      setTimeout(() => {
        geocodeCustomers(routeCustomerIds);
      }, 100);
    } else {
      setStatusMsg('Coordinates cleared. Add customers to route to geocode.');
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  const runOptimizer = async () => {
    if (routeCustomers.length === 0) {
      setStatusMsg('Add customers to the route first.');
      setTimeout(() => setStatusMsg(''), 3000);
      return;
    }

    // Filter to only customers with valid coordinates
    const customersWithCoords = routeCustomers.filter(
      (c): c is CustomerWithCoords & { lat: number; lng: number } =>
        c.geocoded === true && typeof c.lat === 'number' && typeof c.lng === 'number'
    );

    if (customersWithCoords.length < 2) {
      setStatusMsg('Need at least 2 mapped addresses to optimize.');
      setTimeout(() => setStatusMsg(''), 3000);
      return;
    }

    setLoading(true);
    setStatusMsg('Calculating optimal route...');

    try {
      // Run local optimization algorithm (Nearest Neighbor + 2-opt)
      const result = fullyOptimizeRoute(customersWithCoords);

      // Add any customers without coordinates at the end
      const unmappedIds = routeCustomers
        .filter(c => !c.geocoded || !c.lat || !c.lng)
        .map(c => c.id);

      const fullRoute = [...result.order, ...unmappedIds];
      setOptimizedRoute(fullRoute);

      if (result.savings > 0.1) {
        setStatusMsg(`Route optimized! Saved ${result.savings.toFixed(1)} miles.`);
      } else {
        setStatusMsg('Route optimized!');
      }
    } catch (e) {
      console.error('Optimization error:', e);
      setStatusMsg('Optimization failed. Using added order.');
    } finally {
      setLoading(false);
      setTimeout(() => setStatusMsg(''), 4000);
    }
  };

  const getCustomer = (id: string) => allCustomers.find(c => c.id === id);

  // Display order: use optimized route if available, otherwise use add order
  const displayOrder = optimizedRoute.length > 0 ? optimizedRoute : routeCustomerIds;

  // Create map markers from route (including shop as start/end)
  const mapMarkers: MapMarker[] = (() => {
    const markers: MapMarker[] = [];
    const hasShop = shopLocation?.latitude && shopLocation?.longitude;

    // Add shop as start point
    if (hasShop) {
      markers.push({
        id: 'shop-start',
        name: 'Shop (Start)',
        address: `${shopLocation.street}, ${shopLocation.city}, ${shopLocation.state} ${shopLocation.zip}`,
        lat: shopLocation.latitude!,
        lng: shopLocation.longitude!,
        order: 0,
        isShop: true
      });
    }

    // Add customer stops
    displayOrder.forEach((id, index) => {
      const customer = getCustomer(id);
      if (!customer || !customer.lat || !customer.lng) return;
      markers.push({
        id: customer.id,
        name: customer.name,
        address: formatFullAddress(customer),
        lat: customer.lat,
        lng: customer.lng,
        order: hasShop ? index + 1 : index + 1
      });
    });

    // Add shop as end point (same location, different marker)
    if (hasShop && displayOrder.length > 0) {
      markers.push({
        id: 'shop-end',
        name: 'Shop (End)',
        address: `${shopLocation.street}, ${shopLocation.city}, ${shopLocation.state} ${shopLocation.zip}`,
        lat: shopLocation.latitude!,
        lng: shopLocation.longitude!,
        order: markers.length,
        isShop: true
      });
    }

    return markers;
  })();

  // Count customers being geocoded
  const geocodingCount = allCustomers.filter(c => c.geocoding).length;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Route Optimization</h1>
          <p className="text-slate-500 mt-1">Smart logistics powered by AI and real-time mapping.</p>
        </div>
        <div className="flex items-center gap-3">
           <button
             onClick={regeocodeAll}
             disabled={loading || allCustomers.length === 0}
             className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 font-bold hover:bg-amber-100 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
             title="Clear bad coordinates and re-geocode all addresses"
           >
             <RefreshCw className="w-3.5 h-3.5" />
             Re-geocode
           </button>
           <button
             onClick={openCustomerPicker}
             disabled={availableToAdd.length === 0}
             className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <Plus className="w-4 h-4" />
             Customer
           </button>
           <div className="relative bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm flex items-center gap-2">
             <Calendar className="w-4 h-4 text-emerald-600" />
             <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="outline-none text-sm font-bold text-slate-700 bg-transparent"
             />
           </div>
           <button
            onClick={runOptimizer}
            disabled={loading || routeCustomers.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg"
           >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
            {loading ? 'Optimizing...' : 'Optimize Route'}
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        <div className="xl:col-span-4 space-y-6">
          {/* Shop Location Status */}
          {shopLocation?.latitude && shopLocation?.longitude ? (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-blue-900">Shop Location Set</p>
                <p className="text-xs text-blue-700 truncate">{shopLocation.street}, {shopLocation.city}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 bg-blue-600 text-white rounded-lg shrink-0">START/END</span>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-900">No Shop Location</p>
                <p className="text-xs text-amber-700">Go to Settings to set your shop address as route start/end point.</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-6 relative">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Route Stops</h2>
              <div className="flex items-center gap-2">
                {geocodingCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Mapping...
                  </span>
                )}
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{displayOrder.length} STOPS</span>
              </div>
            </div>

            {/* Distance summary */}
            {totalDistance !== null && displayOrder.length >= 1 && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-sm text-emerald-700 font-medium">Total Route Distance</span>
                  {shopLocation?.latitude && shopLocation?.longitude && (
                    <p className="text-[10px] text-emerald-600">Includes shop round trip</p>
                  )}
                </div>
                <span className="text-lg font-bold text-emerald-700">{totalDistance.toFixed(1)} mi</span>
              </div>
            )}

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {displayOrder.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl">
                  <UserPlus className="w-12 h-12 text-emerald-100 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm px-4">Click "+ Customer" to add stops to this route.</p>
                  {allCustomers.length === 0 && (
                    <p className="text-slate-300 text-xs mt-2">No customers yet. Add some in the Customers tab first.</p>
                  )}
                </div>
              ) : (
                displayOrder.map((id, index) => {
                  const customer = getCustomer(id);
                  if (!customer) return null;
                  return (
                    <div key={id} className="flex gap-4 group">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 z-10 ${
                          index === 0 ? 'bg-emerald-600 text-white' :
                          index === displayOrder.length - 1 ? 'bg-slate-900 text-white' :
                          'bg-emerald-100 text-emerald-700 border-2 border-white'
                        }`}>
                          {index + 1}
                        </div>
                        {index !== displayOrder.length - 1 && (
                          <div className="w-0.5 flex-1 bg-slate-100 my-1 group-hover:bg-emerald-100 transition-colors"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-all hover:bg-white hover:shadow-md">
                          <div className="flex justify-between items-start">
                             <p className="font-bold text-slate-800 text-sm">{customer.name}</p>
                             <div className="flex items-center gap-1">
                               <button
                                 onClick={() => removeFromRoute(customer.id)}
                                 className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                 title="Remove from route"
                               >
                                 <Trash2 className="w-3.5 h-3.5" />
                               </button>
                               <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-400 cursor-grab" />
                             </div>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">{formatFullAddress(customer)}</p>
                          <div className="flex items-center gap-2 mt-3">
                             {customer.geocoding ? (
                               <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded flex items-center gap-1">
                                 <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                 MAPPING
                               </span>
                             ) : customer.geocoded && customer.confidence === 'high' ? (
                               <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded flex items-center gap-1">
                                 <MapPin className="w-2.5 h-2.5" />
                                 EXACT
                               </span>
                             ) : customer.geocoded && customer.confidence === 'medium' ? (
                               <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded flex items-center gap-1">
                                 <MapPin className="w-2.5 h-2.5" />
                                 STREET
                               </span>
                             ) : customer.geocoded && customer.confidence === 'low' ? (
                               <span className="text-[10px] font-bold px-1.5 py-0.5 bg-orange-50 text-orange-600 border border-orange-100 rounded flex items-center gap-1">
                                 <AlertCircle className="w-2.5 h-2.5" />
                                 APPROX
                               </span>
                             ) : customer.geocoded ? (
                               <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded flex items-center gap-1">
                                 <MapPin className="w-2.5 h-2.5" />
                                 MAPPED
                               </span>
                             ) : (
                               <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-50 text-red-500 border border-red-100 rounded flex items-center gap-1">
                                 <AlertCircle className="w-2.5 h-2.5" />
                                 NO COORDS
                               </span>
                             )}
                             <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white text-slate-400 border border-slate-100 rounded uppercase">
                                Est. {Object.entries(customer.services).filter(([k,v]) => typeof v === 'boolean' && v).reduce((acc, [k]) => acc + (customer.services[`${k}Duration` as keyof CustomerServices] as number || 0), 0)} min
                             </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {displayOrder.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                <button
                  onClick={() => {
                    if (mapMarkers.length > 0) {
                      const first = mapMarkers[0];
                      const url = `https://www.google.com/maps/dir/${mapMarkers.map(m => `${m.lat},${m.lng}`).join('/')}`;
                      window.open(url, '_blank');
                    }
                  }}
                  disabled={mapMarkers.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
                >
                  <Navigation className="w-4 h-4" />
                  Open in Google Maps
                </button>
                <button className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all">
                  <Mail className="w-4 h-4" />
                  Email Team Route
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Map Section */}
        <div className="xl:col-span-8 h-[700px] sticky top-24">
          <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl border-8 border-white relative">
            {mapMarkers.length > 0 ? (
              <RouteMap markers={mapMarkers} showRoute={true} height="100%" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-24 h-24 text-slate-300 mx-auto mb-6" />
                  <h3 className="text-xl font-bold text-slate-400 mb-2">Add Customers to See Route</h3>
                  <p className="text-slate-400 text-sm max-w-sm">
                    {allCustomers.length === 0
                      ? 'Create customers in the Customers tab first, then add them here.'
                      : 'Click "+ Customer" to add stops to your route.'}
                  </p>
                </div>
              </div>
            )}

            {/* Status overlay */}
            {(statusMsg || geocodingStatus) && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000]">
                <div className="bg-slate-900/90 backdrop-blur-md px-6 py-3 rounded-full text-white text-sm font-bold flex items-center gap-3 shadow-2xl border border-white/20 animate-in slide-in-from-bottom-2 duration-300">
                  {(loading || geocodingStatus) ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-400" />
                  )}
                  {geocodingStatus || statusMsg}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer Picker Modal */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-teal-600 text-white relative">
              <button onClick={() => setIsPickerOpen(false)} className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-black">Add Customers to Route</h3>
              <p className="text-emerald-50 text-sm font-medium opacity-80 mt-1">Select customers to include in today's route.</p>
            </div>

            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium text-slate-900"
                />
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {filteredAvailable.length === 0 ? (
                <div className="p-8 text-center">
                  <Sparkles className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 font-medium">
                    {allCustomers.length === 0
                      ? 'No customers in your directory yet.'
                      : availableToAdd.length === 0
                        ? 'All customers already added to route.'
                        : 'No customers match your search.'}
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {filteredAvailable.map((customer) => {
                    const isSelected = selectedToAdd.includes(customer.id);
                    return (
                      <button
                        key={customer.id}
                        onClick={() => toggleSelectCustomer(customer.id)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left ${
                          isSelected
                            ? 'bg-emerald-50 border-2 border-emerald-500'
                            : 'hover:bg-slate-50 border-2 border-transparent'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {isSelected ? <Check className="w-5 h-5" /> : customer.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 truncate">{customer.name}</p>
                          <p className="text-xs text-slate-500 truncate">{formatFullAddress(customer)}</p>
                        </div>
                        {customer.geocoded ? (
                          <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-400 rounded-lg shrink-0">
                            NEW
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
              <p className="text-sm text-slate-500">
                {selectedToAdd.length > 0
                  ? <span className="font-bold text-emerald-600">{selectedToAdd.length} selected</span>
                  : 'Select customers to add'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsPickerOpen(false)}
                  className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={addSelectedToRoute}
                  disabled={selectedToAdd.length === 0}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-100"
                >
                  Add to Route
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
