/**
 * Default/fallback Delivery Note Particulars list (rows 1-20 of the pre-printed
 * pad, with sub-options 15a-15f under "Column Box"). This is now the SEED value
 * for the database-backed list managed in the Superadmin panel - the live app
 * reads the editable version from GET /api/settings, and only falls back to
 * this file if that request fails (e.g. a network hiccup).
 *
 * Row order matches the corrected pad layout: Clamp / Jacky / Column Pin /
 * Column Box (+ its Column Box sheet sizes) / Generator / Earth Wire /
 * Supporting come first (rows 9-18), with Adjustment Sheet and
 * Lifting/Vibrator Machine moved to the end as rows 19-20.
 *
 * `label` = Tamil text shown when the UI language is Tamil.
 * `labelEn` = English text shown when the UI language is English.
 */
const STANDARD_PARTICULARS = [
  // Sheets (Centering): was 8 separate rows (1-8), now one row with 8 size
  // variants - same "one row, many variants" pattern as Jacky/Welding
  // Machine below. Named "(Centering)" to stay distinct from row 15
  // "Sheets" (the smaller Column Box sizes).
  {
    no: '1',
    label: 'சீட்டு (சென்டரிங்)',
    labelEn: 'Sheets (Centering)',
    variants: [
      { label: '3\'9" x 2\'0"', rate: 0, perDayRate: 0 },
      { label: '3\'0" x 2\'0"', rate: 0, perDayRate: 0 },
      { label: '3\'9" x 1\'6"', rate: 0, perDayRate: 0 },
      { label: '3\'0" x 1\'6"', rate: 0, perDayRate: 0 },
      { label: '3\'9" x 1\'3"', rate: 0, perDayRate: 0 },
      { label: '3\'0" x 1\'3"', rate: 0, perDayRate: 0 },
      { label: '3\'9" x 1\'0"', rate: 0, perDayRate: 0 },
      { label: '3\'0" x 1\'0"', rate: 0, perDayRate: 0 },
    ],
  },
  { no: '9', label: 'கிளாம்பு', labelEn: 'Clamp' },
  {
    no: '10',
    label: 'ஜாக்கி',
    labelEn: 'Jacky',
    variants: [
      { label: '7 Feet', rate: 0, perDayRate: 0 },
      { label: '10 Feet', rate: 0, perDayRate: 0 },
      { label: '20 Feet', rate: 0, perDayRate: 0 },
    ],
  },
  { no: '13', label: 'காலம் ஆணி', labelEn: 'Column Pin/Nail' },
  // Column Box: plain row, no variant dropdown - same shape as row 13
  // "Column Pin/Nail" (Quantity/Rate only). The size-variant dropdown
  // (9"x9", 1'0"x9", ...) lives only on row 15 "Sheets" below.
  { no: '14', label: 'காலம் பாக்ஸ் (போல்ட் நட் உள்பட)', labelEn: 'Column Box (incl. bolt & nut)' },
  {
    no: '15',
    label: 'சீட்டு',
    labelEn: 'Sheets',
    variantSizeSource: 'settings.sheetSizeOptions',
    variants: [
      { label: '9" x 9"', rate: 0, perDayRate: 0 },
      { label: '1\'0" x 9"', rate: 0, perDayRate: 0 },
      { label: '1\'3" x 9"', rate: 0, perDayRate: 0 },
      { label: '1\'6" x 9"', rate: 0, perDayRate: 0 },
      { label: '1\'3" x 1\'0"', rate: 0, perDayRate: 0 },
      { label: '1\'6" x 1\'0"', rate: 0, perDayRate: 0 },
    ],
  },
  { no: '16', label: 'ஜெனரேட்டர்', labelEn: 'Generator', defaultPerDayRate: 1000 },
  { no: '17', label: 'எர்த் வயர்', labelEn: 'Earth Wire' },
  { no: '18', label: 'சப்போர்ட்டிங் (சாரம் போட்டு தரப்படும்)', labelEn: 'Supporting (Scaffolding - provided with support)' },
  { no: '19', label: 'அட்ஜஸ்ட்மெண்ட் Sheet', labelEn: 'Adjustment Sheet' },
  { no: '20', label: 'லிப்டிங் மெஷின் / வைப்ரேட்டர் மெஷின்', labelEn: 'Lifting Machine / Vibrator Machine' },
  { no: '21', label: 'லிப்ட் மெஷின்', labelEn: 'Lift Machine', defaultPerDayRate: 1500, defaultMonthlyRate: 15000 },
  { no: '22', label: 'சுவர் வெட்டும் இயந்திரம் 16 இன்ச்', labelEn: 'Wall Cutter Machine 16inch', defaultPerDayRate: 1500 },
  { no: '23', label: 'எர்த் ரேம்மர்', labelEn: 'Earth Rammer', defaultPerDayRate: 1500 },
  { no: '24', label: 'சாரக்கட்டு', labelEn: 'Sucff holding', defaultRate: 2 },
  // Demolish Machine: was 2 separate rows (25-26), now one row with a
  // Big/Small variant dropdown.
  {
    no: '25',
    label: 'டெமாலிஷ் மெஷின்',
    labelEn: 'Demolish Machine',
    variants: [
      { label: 'Big', rate: 0, perDayRate: 800 },
      { label: 'Small', rate: 0, perDayRate: 500 },
    ],
  },
  {
    no: '27',
    label: 'வெல்டிங் மெஷின்',
    labelEn: 'Welding Machine',
    defaultPerDayRate: 500,
    variants: [
      { label: '200A', rate: 0, perDayRate: 500 },
      { label: '250A', rate: 0, perDayRate: 600 },
      { label: '350A', rate: 0, perDayRate: 800 },
    ],
  },
  { no: '28', label: 'ஹேண்ட் கட்டர்', labelEn: 'Hand Cutter', defaultPerDayRate: 150 },
  {
    no: '29',
    label: 'கோர் கட்டிங்',
    labelEn: 'Core Cutting',
    // Flat per-variant Rate (not Per-Day Rate) - same pattern as Jacky/Sheets.
    // Only 1"/2" are offered; 3"/4" were removed per founder direction.
    variants: [
      { label: '1 inch', rate: 600, perDayRate: 0 },
      { label: '2 inch', rate: 800, perDayRate: 0 },
    ],
  },
  // Wood: was 2 separate rows (33-34), now one row with a Cutting
  // Machine/Router Machine variant dropdown.
  {
    no: '33',
    label: 'வுட்',
    labelEn: 'Wood',
    variants: [
      { label: 'Cutting Machine', rate: 0, perDayRate: 650 },
      { label: 'Router Machine', rate: 0, perDayRate: 650 },
    ],
  },
  {
    no: '35',
    label: 'ஜாக்கெட் ஸ்பேன்',
    labelEn: 'Jacket Span',
    variants: [
      { label: '10 Feet', rate: 0, perDayRate: 5 },
      { label: '14 Feet', rate: 0, perDayRate: 8 },
    ],
  },
  // Steel: was 6 separate rows (36-41), now one row with a mm-size variant
  // dropdown.
  {
    no: '36',
    label: 'ஸ்டீல்',
    labelEn: 'Steel',
    variants: [
      { label: '6mm', rate: 0, perDayRate: 0 },
      { label: '8mm', rate: 0, perDayRate: 0 },
      { label: '10mm', rate: 0, perDayRate: 0 },
      { label: '12mm', rate: 0, perDayRate: 0 },
      { label: '16mm', rate: 0, perDayRate: 0 },
      { label: '20mm', rate: 0, perDayRate: 0 },
    ],
  },
  { no: '42', label: 'பைண்டிங் வயர்', labelEn: 'Binding Wire' },
];

export const DEFAULT_MATERIAL_CATEGORIES = ['General', 'Structural', 'Equipment Rental', 'Electrical', 'Plumbing'];
export const DEFAULT_MATERIAL_UNITS = ['Bags', 'Tons', 'Nos', 'Ft', 'Kg', 'Ltr'];
// Shared size options for Column Box + Sheets (see variantSizeSource on both rows above).
export const DEFAULT_SHEET_SIZE_OPTIONS = [
  '9" x 9"',
  '1\'0" x 9"',
  '1\'3" x 9"',
  '1\'6" x 9"',
  '1\'3" x 1\'0"',
  '1\'6" x 1\'0"',
];

export default STANDARD_PARTICULARS;
