
import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  CloudRain, 
  AlertCircle,
  TrendingUp,
  Map as MapIcon,
  Search,
  ExternalLink,
  Wind,
  Thermometer,
  Zap,
  Info
} from 'lucide-react';
import { storage } from '../services/storageService';
import { gemini, WeatherResponse } from '../services/geminiService';
import { Recommendation, Customer } from '../types';

interface DashboardProps {
  onNavigate?: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [weatherData, setWeatherData] = useState<WeatherResponse | null>(null);
  const customers = storage.getCustomers();

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Get structured weather alert with sources
        const report = await gemini.getWeatherSummary("Lawn care conditions today");
        setWeatherData(report);

        // Get mower recommendations
        if (customers.length > 0) {
          const recs = await gemini.getMowingRecommendations(customers.slice(0, 10));
          setRecommendations(recs);
        }
      } catch (error) {
        console.error("Dashboard data fetch error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const stats = [
    { label: 'Total Customers', value: customers.length.toString(), icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Completed', value: '0', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Pending AI Review', value: recommendations.length.toString(), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Routes Created', value: '0', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  // Helper to parse the Gemini markdown text into structured blocks
  const renderParsedWeather = (text: string) => {
    const sections = text.split('###').filter(s => s.trim() !== '');
    
    // First section might be a general intro
    const intro = sections[0].includes(':') ? null : sections.shift();

    return (
      <div className="space-y-6">
        {intro && (
          <p className="text-lg font-medium text-emerald-50 leading-relaxed border-b border-white/20 pb-4">
            {intro.replace(/\*\*/g, '').trim()}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map((section, idx) => {
            const [title, ...contentLines] = section.split('\n');
            const content = contentLines.join('\n').replace(/\*\*/g, '').replace(/\*/g, '').trim();
            const cleanTitle = title.replace(/\*\*/g, '').trim();
            
            return (
              <div key={idx} className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 hover:bg-white/15 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-emerald-500/30 rounded-lg">
                    {cleanTitle.toLowerCase().includes('dew') || cleanTitle.toLowerCase().includes('frost') ? <Thermometer className="w-5 h-5" /> : 
                     cleanTitle.toLowerCase().includes('rain') || cleanTitle.toLowerCase().includes('precip') ? <CloudRain className="w-5 h-5" /> :
                     cleanTitle.toLowerCase().includes('mow') || cleanTitle.toLowerCase().includes('window') ? <Zap className="w-5 h-5" /> :
                     <Info className="w-5 h-5" />}
                  </div>
                  <h4 className="font-bold text-white text-sm uppercase tracking-wider">{cleanTitle}</h4>
                </div>
                <p className="text-emerald-50/90 text-sm leading-relaxed">
                  {content}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">System Overview</h1>
          <p className="text-slate-500 mt-1">Intelligent insights for your lawn care operations.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search data..." className="bg-transparent outline-none text-sm w-48" />
          </div>
        </div>
      </header>

      {/* Alerts / Weather Report */}
      {weatherData && (
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden border border-white/10">
          <div className="relative z-10 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-xl shadow-inner border border-white/30">
                  <CloudRain className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight">Weather Intelligence Report</h3>
                  <p className="text-emerald-100/70 text-sm font-bold uppercase tracking-widest">Live Grounded Analysis</p>
                </div>
              </div>
            </div>

            {renderParsedWeather(weatherData.text)}

            {/* Source Links - Mandatory Grounding Requirement */}
            {weatherData.links.length > 0 && (
              <div className="pt-6 border-t border-white/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100/50 mb-3">Verification Sources</p>
                <div className="flex flex-wrap gap-3">
                  {weatherData.links.slice(0, 3).map((link, i) => (
                    <a 
                      key={i} 
                      href={link.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-xl text-xs font-bold transition-all border border-white/5"
                    >
                      <span className="truncate max-w-[150px]">{link.title}</span>
                      <ExternalLink className="w-3 h-3 text-emerald-400" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Abstract Decorations */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/10 rounded-full blur-2xl -ml-20 -mb-20"></div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-7 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className={`${stat.bg} ${stat.color} w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-sm`}>
              <stat.icon className="w-7 h-7" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recommendations */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">AI Scheduling Recommendations</h2>
            <button className="text-emerald-600 font-bold text-sm hover:underline flex items-center gap-1">
              Refine All <Zap className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-4">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="bg-white p-6 rounded-3xl h-24 animate-pulse border border-slate-100"></div>
              ))
            ) : recommendations.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 p-16 text-center rounded-[2rem]">
                <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-medium">No priority recommendations for this timeframe.</p>
              </div>
            ) : (
              recommendations.map((rec) => {
                const customer = customers.find(c => c.id === rec.customerId);
                return (
                  <div key={rec.customerId} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-6 hover:border-emerald-200 hover:shadow-xl transition-all group cursor-default">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex-shrink-0 flex items-center justify-center border border-slate-100 group-hover:bg-emerald-50 transition-colors">
                      <Clock className="w-8 h-8 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-black text-slate-800 tracking-tight">{customer?.name || 'Unknown Customer'}</h4>
                      <p className="text-sm text-slate-500 line-clamp-1 mt-0.5">{rec.reason}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-[10px] font-black px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full uppercase tracking-tighter">
                          {rec.optimalTime}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Priority {rec.score}%
                        </span>
                      </div>
                    </div>
                    <button className="px-6 py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-slate-200">
                      Schedule
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Route Info */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900">Active Route</h2>
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-lg overflow-hidden h-full hover:shadow-2xl transition-shadow duration-500">
            <div className="h-56 bg-gradient-to-br from-slate-100 to-slate-200 relative group overflow-hidden flex items-center justify-center">
               <div className="text-center">
                  <MapIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-400 font-medium">No active route</p>
               </div>
            </div>
            <div className="p-8">
              <div className="space-y-5">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Progress</span>
                  <span className="font-black text-slate-900 text-lg">0 / 0 <span className="text-xs font-medium text-slate-400 ml-1">STOPS</span></span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 p-1">
                  <div className="bg-emerald-500 h-1 rounded-full shadow-sm" style={{ width: '0%' }}></div>
                </div>
                <div className="flex justify-between items-center pt-2">
                   <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-300" />
                      <span className="text-xs font-bold text-slate-500">Est. Finish</span>
                   </div>
                   <span className="font-black text-slate-400">--:-- --</span>
                </div>
              </div>
              <button
                onClick={() => onNavigate?.('routes')}
                className="w-full mt-8 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-black hover:bg-slate-100 hover:border-slate-300 transition-all"
              >
                Create New Route
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
