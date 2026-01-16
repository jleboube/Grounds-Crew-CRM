
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { CustomerList } from './components/CustomerList';
import { RoutePlanner } from './components/RoutePlanner';
import { EmployeeList } from './components/EmployeeList';
import { Settings } from './components/Settings';
import { User } from './types';
import { storage } from './services/storageService';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

type AuthMode = 'login' | 'register';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'routes' | 'employees' | 'settings'>('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Check for existing session
    const session = storage.getCurrentSession();
    if (session) {
      setCurrentUser(session);
    }
  }, []);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
    setShowPassword(false);
  };

  const switchAuthMode = (mode: AuthMode) => {
    resetForm();
    setAuthMode(mode);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRegister = async () => {
    setError('');
    setSuccess('');

    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const result = await storage.registerUser(name.trim(), email.trim(), password);

      if (result.success && result.user) {
        setSuccess('Account created successfully! You can now log in.');
        resetForm();
        setTimeout(() => {
          setAuthMode('login');
          setSuccess('');
        }, 2000);
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);

    try {
      const result = await storage.loginUser(email.trim(), password);

      if (result.success && result.user) {
        setCurrentUser(result.user);
        resetForm();
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    storage.logout();
    setCurrentUser(null);
    resetForm();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      if (authMode === 'login') {
        handleLogin();
      } else {
        handleRegister();
      }
    }
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">🌿</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">GreenState CRM</h1>
            <p className="text-slate-500 mt-2">Intelligent lawn care management</p>
          </div>

          {/* Auth Mode Tabs */}
          <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
            <button
              onClick={() => switchAuthMode('login')}
              className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                authMode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => switchAuthMode('register')}
              className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                authMode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Register
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl mb-4 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl mb-4 text-emerald-700 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Name field (register only) */}
            {authMode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium text-slate-900"
                  placeholder="John Smith"
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Email field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium text-slate-900"
                placeholder="you@company.com"
                disabled={isLoading}
              />
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-4 py-3 pr-12 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium text-slate-900"
                  placeholder={authMode === 'register' ? 'Min 6 characters' : 'Enter password'}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password field (register only) */}
            {authMode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium text-slate-900"
                  placeholder="Confirm your password"
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={authMode === 'login' ? handleLogin : handleRegister}
              disabled={isLoading}
              className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-100 mt-6 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{authMode === 'login' ? 'Logging in...' : 'Creating account...'}</span>
                </>
              ) : (
                <span>{authMode === 'login' ? 'Log In' : 'Create Account'}</span>
              )}
            </button>
          </div>

          {/* Switch auth mode link */}
          <p className="text-sm text-slate-500 mt-6 text-center">
            {authMode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => switchAuthMode('register')}
                  className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
                >
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => switchAuthMode('login')}
                  className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
                >
                  Log In
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Layout
      currentUser={currentUser}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onLogout={handleLogout}
    >
      {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
      {activeTab === 'customers' && <CustomerList />}
      {activeTab === 'routes' && <RoutePlanner />}
      {activeTab === 'employees' && <EmployeeList />}
      {activeTab === 'settings' && <Settings />}
    </Layout>
  );
};

export default App;
