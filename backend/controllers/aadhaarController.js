const Tesseract = require('tesseract.js');
const asyncHandler = require('../utils/asyncHandler');
const { uploadBufferToCloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

// Pulls a best-guess Name and Address out of raw Aadhaar OCR text. This is
// necessarily approximate (OCR quality on a photographed card varies a lot),
// which is why the caller always leaves the result editable rather than
// auto-submitting it - see the "Scan Aadhaar" button on the delivery note form.
// Ported unchanged from the old client-side version (formerly
// extractAadhaarFields in DeliveryNoteForm.jsx).
function extractNameAndAddress(rawText) {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const dateOrDobIdx = lines.findIndex((l) => /(dob|year of birth|\d{2}[\/\-]\d{2}[\/\-]\d{4})/i.test(l));
  let name = '';
  if (dateOrDobIdx > 0) {
    // The name line is typically the one right before the DOB/date line and
    // looks like a name (letters/spaces only, no digits).
    for (let i = dateOrDobIdx - 1; i >= 0 && i >= dateOrDobIdx - 3; i--) {
      const candidate = lines[i];
      if (/^[A-Za-z\s.]{3,50}$/.test(candidate) && !/government|india|male|female/i.test(candidate)) {
        name = candidate;
        break;
      }
    }
  }

  // Fallback for name: OCR sometimes garbles the DOB/year line badly enough
  // that dateOrDobIdx never matches at all - in that case take the first
  // plausible name-looking line near the top of the card instead of leaving
  // Name blank outright.
  if (!name) {
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      const candidate = lines[i];
      if (
        /^[A-Za-z\s.]{3,50}$/.test(candidate) &&
        !/government|india|male|female|aadhaar|unique|identification|authority/i.test(candidate)
      ) {
        name = candidate;
        break;
      }
    }
  }

  let address = '';
  // Real cards very often print the address label mid-line - "S/O: Foo,
  // Address: 12 Bar Street" all on one line (and Tesseract's own line
  // segmentation frequently merges adjacent short lines too) - so this must
  // find "address" ANYWHERE in a line, not just when it's the first word.
  const addressIdx = lines.findIndex((l) => /address[:\s]/i.test(l));
  if (addressIdx !== -1) {
    const afterColon = lines[addressIdx].replace(/^.*?address[:\s]*/i, '').trim();
    const rest = [];
    for (let i = addressIdx + 1; i < lines.length; i++) {
      if (/^\d{4}\s?\d{4}\s?\d{4}$/.test(lines[i]) || /^www\./i.test(lines[i])) break; // Aadhaar number / website line ends the address block
      rest.push(lines[i]);
      if (/\b\d{6}\b/.test(lines[i])) break; // stop after the PIN code line
    }
    address = [afterColon, ...rest].filter(Boolean).join(', ');
  } else {
    // Fallback: OCR dropped the word "Address" itself (common when that label
    // is printed small/faint). Aadhaar cards almost always print a
    // relationship line (S/O, D/O, W/O, C/O) immediately above the address
    // block, so start collecting from there instead of leaving Address blank
    // just because the literal word "Address" wasn't recognized.
    const relIdx = lines.findIndex((l) => /\b(s\/o|d\/o|w\/o|c\/o)\b/i.test(l));
    if (relIdx !== -1) {
      const rest = [];
      for (let i = relIdx; i < lines.length; i++) {
        if (/^\d{4}\s?\d{4}\s?\d{4}$/.test(lines[i]) || /^www\./i.test(lines[i])) break;
        rest.push(lines[i]);
        if (/\b\d{6}\b/.test(lines[i])) break; // stop after the PIN code line
      }
      address = rest.filter(Boolean).join(', ');
    }
  }

  return { name, address };
}

// A standard printed Aadhaar card - front or back - has no mobile number on
// it at all; that's a fact about the document, not a limitation of the OCR.
// Phone autofill only works when the photo being scanned has a number
// printed or written on it somewhere (a KYC/delivery slip stapled to the
// card, a handwritten number on the photo, an e-Aadhaar PDF page that
// includes a masked/partial mobile line, etc.) - this only ever fills in
// what's actually present in the OCR text.
function extractPhoneFromText(rawText) {
  // Aadhaar numbers are 12 digits, printed either as one run of 12 digits or
  // grouped "1234 5678 9012" - excluding those groupings first stops a stray
  // 10-digit slice of an Aadhaar number from being misread as a phone number.
  const withoutAadhaarGroups = rawText.replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, ' ');

  // Common explicit labels first - most reliable when present ("Mobile:",
  // "Phone:", "Ph:", "Contact:", optionally with a +91 country code).
  const labelled = withoutAadhaarGroups.match(
    /(?:mobile|phone|ph|contact|mob)[\s:.\-]*(?:\+?91[\s-]?)?([6-9]\d{9})\b/i
  );
  if (labelled) return labelled[1];

  // Otherwise fall back to any standalone valid Indian mobile pattern
  // (10 digits starting 6-9), with or without a +91 prefix.
  const bare = withoutAadhaarGroups.match(/(?:\+?91[\s-]?)?\b([6-9]\d{9})\b/);
  return bare ? bare[1] : '';
}

function extractAadhaarFields(rawText) {
  const { name, address } = extractNameAndAddress(rawText);
  const phone = extractPhoneFromText(rawText);
  return { name, address, phone };
}

// POST /api/customers/scan-aadhaar  (multipart, field name "aadhaar")
const scanAadhaar = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) {
    res.status(500);
    throw new Error('Photo storage is not set up yet - Cloudinary env vars are missing.');
  }
  if (!req.file) {
    res.status(400);
    throw new Error('No image uploaded');
  }

  // Upload the original photo to Cloudinary first (so it's saved even if OCR fails).
  const uploadResult = await uploadBufferToCloudinary(req.file.buffer, 'rsa-construction/aadhaar-scans');

  const {
    data: { text },
  } = await Tesseract.recognize(req.file.buffer, 'eng');
  const { name, address, phone } = extractAadhaarFields(text);

  res.json({
    success: true,
    data: {
      name,
      address,
      phone,
      photo: { url: uploadResult.secure_url, publicId: uploadResult.public_id },
      found: Boolean(name || address || phone),
    },
  });
});

module.exports = { scanAadhaar };
