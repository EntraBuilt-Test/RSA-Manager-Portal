/**
 * The seven built-in tabs, in the exact shape the `Modules` collection stores.
 *
 * This is the single definition shared by:
 *  - scripts/seedModules.js  (the one-time cutover migration)
 *  - controllers/moduleController.js (auto-heals a missing system module on
 *    read, so a fresh database or a forgotten migration never leaves the app
 *    with an empty sidebar)
 *
 * Mirrors useTabs() in frontend/src/components/Layout/Layout.jsx and the
 * nav.* entries in frontend/src/i18n/translations.js.
 */
const SYSTEM_MODULES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    labelTa: 'டாஷ்போர்டு',
    short: 'DB',
    icon: '📊',
    path: '/dashboard',
    order: 1,
    description: 'Overview of billing, stock and pending payments.',
  },
  {
    key: 'billing',
    label: 'Billing / Delivery Note',
    labelTa: 'பில்லிங் / டெலிவரி நோட்',
    short: 'BI',
    icon: '🧾',
    path: '/billing',
    order: 2,
    description: 'Delivery Notes - the digital version of the pre-printed pad.',
  },
  {
    key: 'materials',
    label: 'Material Stock / Purchase Ledger',
    labelTa: 'மெட்டீரியல் ஸ்டாக் / கொள்முதல் லெட்ஜர்',
    short: 'MA',
    icon: '🧱',
    path: '/materials',
    order: 3,
    description: 'Material purchases and the running stock ledger.',
  },
  {
    key: 'labour',
    label: 'Labour',
    labelTa: 'லேபர்',
    short: 'LB',
    icon: '👷',
    path: '/labour',
    order: 4,
    description: 'Worker attendance, wages, advances and site sheets.',
  },
  {
    key: 'voucher',
    label: 'Voucher',
    labelTa: 'வவுச்சர்',
    short: 'VO',
    icon: '💵',
    path: '/voucher',
    order: 5,
    description: 'Cash vouchers issued against advances and payments.',
  },
  {
    key: 'stock',
    label: 'Stock View',
    labelTa: 'ஸ்டாக் நிலை',
    short: 'ST',
    icon: '📦',
    path: '/stock',
    order: 6,
    description: 'Current remaining stock and low-stock alerts.',
  },
  {
    key: 'reports',
    label: 'Reports',
    labelTa: 'அறிக்கைகள்',
    short: 'RE',
    icon: '📈',
    path: '/reports',
    order: 7,
    description: 'Daily, monthly and yearly reports plus Excel export.',
  },
];

const SYSTEM_MODULE_KEYS = SYSTEM_MODULES.map((m) => m.key);

module.exports = { SYSTEM_MODULES, SYSTEM_MODULE_KEYS };
