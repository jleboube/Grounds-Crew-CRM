
import React from 'react';
import {
  LayoutDashboard,
  Users,
  MapPin,
  LogOut,
  ChevronRight,
  Leaf,
  UserCog,
  Settings
} from 'lucide-react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentUser, activeTab, setActiveTab, onLogout }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'routes', label: 'Route Planner', icon: MapPin },
    { id: 'employees', label: 'Employees', icon: UserCog },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-emerald-600">
            <Leaf className="w-8 h-8 fill-emerald-600" />
            <h1 className="font-bold text-xl tracking-tight text-slate-800">GreenState</h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-100' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </div>
              {activeTab === item.id && <ChevronRight className="w-4 h-4" />}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{currentUser.name}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{currentUser.role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 p-3 text-slate-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex justify-between items-center md:hidden">
          <div className="flex items-center gap-2 text-emerald-600">
             <Leaf className="w-6 h-6 fill-emerald-600" />
             <span className="font-bold text-lg">GreenState</span>
          </div>
          <button onClick={() => {}} className="p-2 bg-slate-100 rounded-lg">
             <LayoutDashboard className="w-6 h-6 text-slate-600" />
          </button>
        </header>

        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
