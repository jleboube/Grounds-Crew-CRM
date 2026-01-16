
import { Customer, Employee, RegisteredUser, User, ShopLocation } from '../types';
import { parseAddressString, formatFullAddress, DEFAULT_CITY, DEFAULT_STATE } from '../utils/addressUtils';

const CUSTOMERS_KEY = 'greenstate_customers';
const EMPLOYEES_KEY = 'greenstate_employees';
const USERS_KEY = 'greenstate_users';
const SESSION_KEY = 'greenstate_session';

// Re-export formatFullAddress for convenience
export { formatFullAddress };

// Simple hash function for passwords (in production, use bcrypt on backend)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Migrate old customer data format (single address string) to structured fields
function migrateCustomerAddress(customer: any): Customer {
  // If customer already has structured address fields, return as-is
  if (customer.street !== undefined) {
    return customer as Customer;
  }

  // Migrate from old 'address' string field
  if (customer.address && typeof customer.address === 'string') {
    const parsed = parseAddressString(customer.address);
    const { address, ...rest } = customer; // Remove old address field
    return {
      ...rest,
      street: parsed.street,
      street2: parsed.street2 || '',
      city: parsed.city || DEFAULT_CITY,
      state: parsed.state || DEFAULT_STATE,
      zip: parsed.zip || ''
    } as Customer;
  }

  // Fallback: empty structured fields
  return {
    ...customer,
    street: '',
    street2: '',
    city: DEFAULT_CITY,
    state: DEFAULT_STATE,
    zip: ''
  } as Customer;
}

export const storage = {
  // Customer methods
  getCustomers(): Customer[] {
    const data = localStorage.getItem(CUSTOMERS_KEY);
    if (!data) return [];

    const rawCustomers = JSON.parse(data);

    // Check if migration is needed
    const needsMigration = rawCustomers.some((c: any) => c.address && c.street === undefined);

    if (needsMigration) {
      console.log('[Storage] Migrating customer addresses to structured format...');
      const migratedCustomers = rawCustomers.map(migrateCustomerAddress);
      localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(migratedCustomers));
      console.log(`[Storage] Migrated ${migratedCustomers.length} customers`);
      return migratedCustomers;
    }

    return rawCustomers;
  },

  saveCustomer(customer: Customer) {
    const customers = this.getCustomers();
    const existingIndex = customers.findIndex(c => c.id === customer.id);
    if (existingIndex > -1) {
      customers[existingIndex] = customer;
    } else {
      customers.push(customer);
    }
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
  },

  deleteCustomer(id: string) {
    const customers = this.getCustomers().filter(c => c.id !== id);
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
  },

  // Employee methods
  getEmployees(): Employee[] {
    const data = localStorage.getItem(EMPLOYEES_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveEmployee(employee: Employee) {
    const employees = this.getEmployees();
    const existingIndex = employees.findIndex(e => e.id === employee.id);
    if (existingIndex > -1) {
      employees[existingIndex] = employee;
    } else {
      employees.push(employee);
    }
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
  },

  deleteEmployee(id: string) {
    const employees = this.getEmployees().filter(e => e.id !== id);
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
  },

  clearAllData() {
    localStorage.removeItem(CUSTOMERS_KEY);
    localStorage.removeItem(EMPLOYEES_KEY);
  },

  // Clear all cached coordinates to force re-geocoding
  clearAllCoordinates() {
    const customers = this.getCustomers();
    const updated = customers.map(c => ({
      ...c,
      latitude: undefined,
      longitude: undefined
    }));
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(updated));
    return updated.length;
  },

  // Auth methods
  getRegisteredUsers(): RegisteredUser[] {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  async registerUser(name: string, email: string, password: string, role: 'owner' | 'team' = 'owner'): Promise<{ success: boolean; error?: string; user?: User }> {
    const users = this.getRegisteredUsers();

    // Check if email already exists
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, error: 'An account with this email already exists' };
    }

    const passwordHash = await hashPassword(password);
    const newUser: RegisteredUser = {
      id: crypto.randomUUID(),
      name,
      email: email.toLowerCase(),
      role,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    // Return user without password hash
    const { passwordHash: _, ...user } = newUser;
    return { success: true, user };
  },

  async loginUser(email: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> {
    const users = this.getRegisteredUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return { success: false, error: 'No account found with this email' };
    }

    const passwordHash = await hashPassword(password);
    if (user.passwordHash !== passwordHash) {
      return { success: false, error: 'Incorrect password' };
    }

    // Store session
    const { passwordHash: _, ...sessionUser } = user;
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));

    return { success: true, user: sessionUser };
  },

  getCurrentSession(): User | null {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
  },

  // Shop Location methods
  getShopLocation(): ShopLocation | null {
    const session = this.getCurrentSession();
    if (!session) return null;

    const users = this.getRegisteredUsers();
    const user = users.find(u => u.id === session.id);
    return user?.shopLocation || null;
  },

  saveShopLocation(shopLocation: ShopLocation) {
    const session = this.getCurrentSession();
    if (!session) return;

    const users = this.getRegisteredUsers();
    const userIndex = users.findIndex(u => u.id === session.id);
    if (userIndex > -1) {
      users[userIndex].shopLocation = shopLocation;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
  }
};
