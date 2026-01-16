
import React, { useState } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
  Phone,
  Mail,
  Calendar,
  UserCog,
  Check,
  AlertCircle
} from 'lucide-react';
import { storage } from '../services/storageService';
import { Employee } from '../types';

type EmployeeRole = 'manager' | 'crew_lead' | 'technician';
type EmployeeStatus = 'active' | 'inactive';

export const EmployeeList: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>(storage.getEmployees());
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const getInitialFormState = (): Employee => ({
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'technician',
    hireDate: new Date().toISOString().split('T')[0],
    status: 'active',
    notes: ''
  });

  const [formData, setFormData] = useState<Employee>(getInitialFormState());

  const openModal = (employee?: Employee) => {
    if (employee) {
      setFormData(employee);
      setEditingId(employee.id);
    } else {
      setFormData(getInitialFormState());
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (formData.firstName && formData.lastName) {
      const employee: Employee = {
        ...formData,
        id: editingId || Math.random().toString(36).substr(2, 9),
      };

      storage.saveEmployee(employee);
      setEmployees(storage.getEmployees());
      setIsModalOpen(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this employee?')) {
      storage.deleteEmployee(id);
      setEmployees(storage.getEmployees());
    }
  };

  const filteredEmployees = employees.filter(e =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeColor = (role: EmployeeRole) => {
    switch (role) {
      case 'manager': return 'bg-purple-100 text-purple-700';
      case 'crew_lead': return 'bg-blue-100 text-blue-700';
      case 'technician': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getRoleLabel = (role: EmployeeRole) => {
    switch (role) {
      case 'manager': return 'Manager';
      case 'crew_lead': return 'Crew Lead';
      case 'technician': return 'Technician';
      default: return role;
    }
  };

  const getStatusBadge = (status: EmployeeStatus) => {
    return status === 'active'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-slate-100 text-slate-500';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Employee Directory</h1>
          <p className="text-slate-500 mt-1">Manage your team members and their roles.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm text-slate-900 font-medium"
            />
          </div>
          <div className="text-sm text-slate-500 font-medium">
            {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Role & Status</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <UserCog className="w-12 h-12 opacity-20" />
                      <p className="text-lg font-medium">No employees found</p>
                      <p className="text-sm">Add your first team member to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-emerald-50/30 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-bold text-slate-600 shadow-inner">
                          {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{employee.firstName} {employee.lastName}</p>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            Hired {new Date(employee.hireDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="space-y-1.5">
                        {employee.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{employee.email}</span>
                          </div>
                        )}
                        {employee.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{employee.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight ${getRoleBadgeColor(employee.role)}`}>
                          {getRoleLabel(employee.role)}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight ${getStatusBadge(employee.status)}`}>
                          {employee.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openModal(employee)}
                          className="p-2.5 hover:bg-white hover:shadow-md rounded-xl text-slate-400 hover:text-blue-600 transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(employee.id)}
                          className="p-2.5 hover:bg-white hover:shadow-md rounded-xl text-slate-400 hover:text-red-600 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
            <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-slate-700 to-slate-800 text-white relative">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-8 right-8 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-2xl font-black">{editingId ? 'Edit Employee' : 'New Employee'}</h3>
              <p className="text-slate-300 text-sm font-medium opacity-80 mt-1">
                {editingId ? `Updating ${formData.firstName} ${formData.lastName}` : 'Add a new team member'}
              </p>
            </div>

            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900"
                    placeholder="John"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900"
                    placeholder="Smith"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900"
                    placeholder="john@company.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as EmployeeRole })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-900 appearance-none"
                  >
                    <option value="technician">Technician</option>
                    <option value="crew_lead">Crew Lead</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as EmployeeStatus })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-900 appearance-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hire Date</label>
                  <input
                    type="date"
                    value={formData.hireDate}
                    onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold text-slate-900 resize-none"
                    placeholder="Any additional notes about this employee..."
                  />
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.firstName || !formData.lastName}
                className="px-8 py-3 bg-slate-800 text-white rounded-xl font-black hover:bg-slate-700 disabled:opacity-50 transition-all shadow-xl shadow-slate-200"
              >
                {editingId ? 'Update Employee' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
