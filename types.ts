
export enum ServiceType {
  LAWN_CARE = 'Lawn Care',
  LANDSCAPING = 'Landscaping',
  LEAF_REMOVAL = 'Leaf Removal',
  SNOW_REMOVAL = 'Snow Removal'
}

export enum GrassType {
  BERMUDA = 'Bermuda',
  FESCUE = 'Fescue',
  ZOYSIA = 'Zoysia',
  ST_AUGUSTINE = 'St. Augustine',
  BLUEGRASS = 'Bluegrass',
  UNKNOWN = 'Other/Unknown'
}

export enum SunExposure {
  FULL_SUN = 'Full Sun',
  PARTIAL_SHADE = 'Partial Shade',
  DENSE_SHADE = 'Dense Shade'
}

export interface CustomerServices {
  mow: boolean;
  mowDuration: number;
  fertilize: boolean;
  fertilizeDuration: number;
  leafRemoval: boolean;
  leafRemovalDuration: number;
  snowRemoval: boolean;
  snowRemovalDuration: number;
}

export interface Customer {
  id: string;
  name: string;
  // Structured address fields
  street: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  email: string;
  phone: string;
  notes: string;
  serviceType: ServiceType; // High level category
  services: CustomerServices; // Specific service checks
  grassType: GrassType;
  sunExposure: SunExposure;
  lastServiceDate: string;
  latitude?: number;
  longitude?: number;
  geocodeConfidence?: 'high' | 'medium' | 'low'; // high=exact, medium=street-level, low=city-level
}

export interface Recommendation {
  customerId: string;
  optimalTime: string;
  reason: string;
  score: number; // 0-100 priority
}

export interface Route {
  id: string;
  date: string;
  stops: string[]; // customer IDs
  status: 'planned' | 'in-progress' | 'completed';
}

export interface ShopLocation {
  street: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  latitude?: number;
  longitude?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'team';
}

export interface RegisteredUser extends User {
  passwordHash: string;
  createdAt: string;
  shopLocation?: ShopLocation;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'manager' | 'crew_lead' | 'technician';
  hireDate: string;
  status: 'active' | 'inactive';
  notes: string;
}
