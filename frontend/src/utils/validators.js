// Shared validators for the Create Delivery Note form (and anywhere else that
// collects a customer phone number or vehicle registration number). Mirrors
// the same rules enforced server-side in backend/models/Customer.js and
// backend/models/DeliveryNote.js, so the user gets an immediate inline error
// instead of only finding out after the request round-trip.

// Indian mobile number: exactly 10 digits, starting 6-9. Optional +91/91 prefix.
const PHONE_REGEX = /^(?:\+?91[\-\s]?)?[6-9][0-9]{9}$/;

// Indian vehicle registration number, e.g. TN49CH8736. Spaces/hyphens are
// ignored for the check (so "TN 49 CH 8736" and "TN-49-CH-8736" both pass).
const VEHICLE_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;

// Keeps only characters that could ever be valid in a phone number as the
// user types (digits, plus a leading +), so invalid characters never even
// appear in the field.
export function sanitizePhoneInput(raw) {
  let v = String(raw || '').replace(/[^\d+]/g, '');
  // Only allow a leading '+', never in the middle of the number.
  if (v.includes('+')) {
    v = '+' + v.replace(/\+/g, '');
  }
  return v;
}

export function isValidPhone(value) {
  const v = String(value || '').trim();
  if (!v) return false;
  return PHONE_REGEX.test(v);
}

export const PHONE_HELP = '10-digit mobile number, e.g. 9876543210';

// Keeps only letters/digits/spaces/hyphens as the user types a vehicle number,
// and force-uppercases it (registration numbers are always shown uppercase).
export function sanitizeVehicleInput(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, '');
}

// Vehicle number is a required field on the Delivery Note - a blank value is
// NOT valid (see isVehicleNumberProvided below for the separate "did they even
// fill it in" check used to show a distinct "required" vs "wrong format" message).
export function isValidVehicleNumber(value) {
  const v = String(value || '').trim();
  if (!v) return false;
  const compact = v.replace(/[\s-]/g, '');
  return VEHICLE_REGEX.test(compact);
}

export function isVehicleNumberProvided(value) {
  return !!String(value || '').trim();
}

export const VEHICLE_HELP = 'Format: TN49CH8736 (2 letters, 1-2 digits, 1-3 letters, 4 digits)';
export const VEHICLE_REQUIRED_HELP = 'Vehicle number is required.';
