# GreenState CRM - Route Optimization Fix

Bug fixes for geocoding and route optimization that was causing pins in Africa instead of Indiana.

## MAJOR UPDATE: Structured Address Fields (January 2026)

Complete refactor from single `address` string to structured fields.

## Completed Tasks

### Phase 2: Structured Address Refactor
- [x] Create `utils/addressUtils.ts` with `formatFullAddress()` and `parseAddressString()`
- [x] Update `types.ts` - Customer now has: street, street2, city, state, zip
- [x] Update `storageService.ts` with auto-migration from old format
- [x] Update `geocodingService.ts` with `geocodeStructuredAddress()`
- [x] Update `CustomerList.tsx` with structured address form fields
- [x] Update `RoutePlanner.tsx` to use structured geocoding
- [x] Update `geminiService.ts` for structured addresses
- [x] Rebuild and deploy Docker container

### Phase 1: Initial Debugging
- [x] Diagnose root cause of geocoding failures (Nominatim API quirks with free-form queries)
- [x] Fix CSV import that was mapping columns incorrectly (state+zip to email, city to phone)
- [x] Rewrite geocodingService.ts with multi-strategy fallback approach
- [x] Add address parsing to extract street, city, state, zip components
- [x] Implement Strategy 1: Structured query (street, city, state, country)
- [x] Implement Strategy 2: Street name + ZIP code fallback
- [x] Implement Strategy 3: City-level fallback (last resort)
- [x] Add Indiana/Midwest bounding box validation
- [x] Add result scoring to select best geocoding match
- [x] Add progress callback for batch geocoding
- [x] Remove redundant Indiana validation from RoutePlanner.tsx
- [x] Add clearAllCoordinates() to storageService.ts
- [x] Rebuild and deploy Docker container

## In Progress Tasks

- [ ] User testing of complete flow: Clear customers -> Import CSV -> Geocode -> Optimize route

### Fix Applied (January 2026): Strict Indiana-Only Geocoding

**Root Cause of 710+ Mile Routes:**
Nominatim was returning streets from Michigan, Ohio, Missouri, and Kentucky that matched street names in the query. The previous code penalized non-Indiana results but still accepted them if no Indiana result was found.

**Fix:**
Modified `selectBestResult()` to **strictly reject** any geocoding result outside Indiana's bounding box:
- Results not in Indiana are logged as "REJECTED" and skipped entirely
- If no Indiana result is found, the address is marked as failed (returns null)
- City-level fallback still works (Evansville, IN will be used)

**Additional Improvements:**
- Strategy 1 now uses "IN" abbreviation instead of "Indiana" for better Nominatim compatibility
- Strategy 2 now includes full city/state context in queries

## Implementation Details

### Root Cause Analysis

1. **CSV Import Bug**: Addresses like "7713 Dry Branch Rd, Evansville, IN 47711" were being split on ALL commas, not just the intended field separators. This caused:
   - State+ZIP ("IN 47711") to go in email field
   - City ("Evansville") to go in phone field

2. **Geocoding Failures**: Nominatim free-form queries (`q=...`) often return empty results or wrong locations for addresses it doesn't fully recognize. Testing showed:
   - Structured queries work better but not for all addresses
   - Street + ZIP queries find roads when exact addresses fail
   - City-level fallback ensures route planning can still work

### Multi-Strategy Geocoding Approach

```
Strategy 1: Structured Query
  - Uses street, city, state, country parameters
  - Best for exact address matches
  - Returns confidence: high for house/building, medium for street

Strategy 2: Street + ZIP
  - Removes house number, queries "Street Name + ZIP"
  - Falls back to "Street Name + City + State" if no ZIP
  - Returns confidence: medium

Strategy 3: City Fallback
  - Queries "City, State, USA"
  - Returns confidence: low
  - Still useful for route planning
```

### Relevant Files

- `services/geocodingService.ts` - Complete rewrite with multi-strategy fallback
- `components/CustomerList.tsx` - Fixed CSV import with smart field detection
- `services/storageService.ts` - Added clearAllCoordinates method
- `components/RoutePlanner.tsx` - Simplified coordinate loading

### Testing URLs

Test the Nominatim API directly:
```bash
# Structured query
curl "https://nominatim.openstreetmap.org/search?format=json&street=123+Main+St&city=Evansville&state=Indiana&country=USA"

# Street + ZIP fallback
curl "https://nominatim.openstreetmap.org/search?format=json&q=Main+St+47711&countrycodes=us"
```

## Future Improvements

- [ ] Consider caching geocoding results to local storage for persistence
- [ ] Add visual indicators in UI for geocoding confidence level
- [ ] Implement geocoding retry logic for failed addresses
