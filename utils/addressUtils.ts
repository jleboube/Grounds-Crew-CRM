
// Address utility functions for structured address handling

export const DEFAULT_CITY = 'Evansville';
export const DEFAULT_STATE = 'Indiana';

export const NEARBY_STATES = [
  'Indiana',
  'Illinois',
  'Kentucky',
  'Ohio',
  'Michigan',
  'Tennessee'
];

export interface StructuredAddress {
  street: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
}

/**
 * Format structured address fields into a single display string
 */
export function formatFullAddress(address: StructuredAddress): string {
  const parts: string[] = [];

  if (address.street) {
    parts.push(address.street);
  }

  if (address.street2) {
    parts.push(address.street2);
  }

  const cityStateZip = [
    address.city,
    address.state,
    address.zip
  ].filter(Boolean).join(', ').replace(/, ([^,]+)$/, ' $1'); // "City, State ZIP" format

  if (cityStateZip) {
    parts.push(cityStateZip);
  }

  return parts.join(', ');
}

/**
 * Parse a legacy single-line address string into structured components
 * Used for migration from old data format
 */
export function parseAddressString(address: string): StructuredAddress {
  const trimmed = address.trim();

  // Extract ZIP code (5 digits, optionally with -4 extension)
  const zipMatch = trimmed.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[1] : '';

  // Remove ZIP from address for further parsing
  let remaining = trimmed.replace(/\b\d{5}(?:-\d{4})?\b/, '').trim();

  // Extract state (IN, Indiana, IL, Illinois, KY, Kentucky, etc.)
  const statePatterns = [
    { pattern: /,\s*(IN|Indiana)\s*$/i, state: 'Indiana' },
    { pattern: /,\s*(IN|Indiana)\s*,/i, state: 'Indiana' },
    { pattern: /\s+(IN|Indiana)\s*$/i, state: 'Indiana' },
    { pattern: /,\s*(IL|Illinois)\s*$/i, state: 'Illinois' },
    { pattern: /,\s*(IL|Illinois)\s*,/i, state: 'Illinois' },
    { pattern: /\s+(IL|Illinois)\s*$/i, state: 'Illinois' },
    { pattern: /,\s*(KY|Kentucky)\s*$/i, state: 'Kentucky' },
    { pattern: /,\s*(KY|Kentucky)\s*,/i, state: 'Kentucky' },
    { pattern: /\s+(KY|Kentucky)\s*$/i, state: 'Kentucky' },
    { pattern: /,\s*(OH|Ohio)\s*$/i, state: 'Ohio' },
    { pattern: /,\s*(OH|Ohio)\s*,/i, state: 'Ohio' },
    { pattern: /\s+(OH|Ohio)\s*$/i, state: 'Ohio' },
    { pattern: /,\s*(MI|Michigan)\s*$/i, state: 'Michigan' },
    { pattern: /,\s*(MI|Michigan)\s*,/i, state: 'Michigan' },
    { pattern: /\s+(MI|Michigan)\s*$/i, state: 'Michigan' },
    { pattern: /,\s*(TN|Tennessee)\s*$/i, state: 'Tennessee' },
    { pattern: /,\s*(TN|Tennessee)\s*,/i, state: 'Tennessee' },
    { pattern: /\s+(TN|Tennessee)\s*$/i, state: 'Tennessee' },
  ];

  let state = DEFAULT_STATE;
  for (const { pattern, state: stateName } of statePatterns) {
    if (pattern.test(remaining)) {
      state = stateName;
      remaining = remaining.replace(pattern, ',').replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim();
      break;
    }
  }

  // Split remaining into parts by comma
  const parts = remaining.split(',').map(p => p.trim()).filter(p => p);

  let street = '';
  let city = DEFAULT_CITY;

  if (parts.length >= 2) {
    street = parts[0];
    city = parts[1];
  } else if (parts.length === 1) {
    street = parts[0];
  }

  return {
    street,
    street2: '',
    city,
    state,
    zip
  };
}
