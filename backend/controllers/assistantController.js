const asyncHandler = require('../utils/asyncHandler');
const { toolDefinitions, describeAction, isDestructive, runAction } = require('./assistantActions');

/**
 * RSA Assistant.
 *
 * If GROQ_API_KEY is set (get a free key at https://console.groq.com), every
 * message is answered by a real LLM via Groq's OpenAI-compatible chat API,
 * grounded with a system prompt describing this app in detail so it gives
 * accurate, on-topic answers about R.S.A Construction's system and business
 * instead of generic ones.
 *
 * If GROQ_API_KEY is NOT set, or the Groq call fails for any reason (network
 * issue, invalid key, rate limit, quota), this falls back to the local,
 * keyword/overlap-based matcher below - so the widget never goes fully silent
 * and can still answer the great majority of "how do I..." questions about
 * this app on its own.
 */

// ---- Knowledge base (also used as fallback + grounding for the LLM) -------
// Each entry: id, keywords (phrases/words that should trigger it), answer.
// Keep entries specific and non-overlapping where possible; matchIntent()
// below scores every entry and picks the best match, so more/better keyword
// coverage directly improves both the fallback bot AND the LLM's grounding.
const KNOWLEDGE_BASE = [
  {
    id: 'greeting',
    keywords: ['hi', 'hello', 'hey', 'good morning', 'good evening', 'good afternoon', 'vanakkam'],
    answer:
      "Hi! I'm the RSA Construction assistant. Ask me anything about using this system - Delivery Notes/Billing, Material Stock, Labour, Vouchers, Reports, Superadmin settings - or general questions about R.S.A Construction's process.",
  },
  {
    id: 'thanks',
    keywords: ['thank', 'thanks', 'thank you', 'thankyou', 'nandri', 'super', 'great help'],
    answer: "You're welcome! Let me know if you need help with anything else in the app.",
  },
  {
    id: 'who-are-you',
    keywords: ['who are you', 'what are you', 'are you ai', 'are you claude', 'are you chatgpt', 'your name'],
    answer:
      "I'm the built-in RSA Construction assistant - here to help you navigate this Delivery Note / Billing / Material Ledger / Labour / Vouchers / Reports management system, and to answer general questions related to R.S.A Construction's work.",
  },
  {
    id: 'what-is-this-app',
    keywords: [
      'what is this app', 'what does this app do', 'what is this system', 'what can you do', 'help me',
      'what is rsa construction', 'about this app', 'features',
    ],
    answer:
      'This is R.S.A Construction\'s Construction Management System - a digital replacement for the old handwritten Delivery Note pad and Material Purchase Ledger. It covers: Billing/Delivery Notes, Material Stock & Purchase Ledger, Labour (worker attendance, wages, site sheets), Cash Vouchers, a Dashboard, Reports/exports, and a Superadmin settings panel. Ask me about any of these and I can walk you through it.',
  },
  {
    id: 'delivery-note-create',
    keywords: [
      'create delivery note', 'new delivery note', 'add delivery note', 'make delivery note',
      'billing', 'how to bill', 'raise a bill', 'delivery note', 'create bill', 'new bill',
      'issue a delivery note',
    ],
    answer:
      'To create a Delivery Note: go to "Billing / Delivery Note" in the sidebar, click "New", enter the Date, Vehicle Number, and Payment Status, then either add a New Customer (name + phone required) or pick an Existing Customer. Fill in quantity/rate for the pre-printed Particulars rows that apply, or use "+ Add Custom Item" for anything not on the list. Vehicle Number and Customer Phone are both required fields - the form won\'t save without them. The Amount per row and the Grand Total are calculated live, and you can print the note once it\'s saved.',
  },
  {
    id: 'delivery-note-required-fields',
    keywords: [
      'vehicle number required', 'phone number required', 'mandatory field', 'why cant i save',
      'form wont submit', 'required fields', 'cant create delivery note',
    ],
    answer:
      'Every Delivery Note needs a Vehicle Number and, for a new customer, a valid 10-digit phone number - both are mandatory so every note is properly traceable. If the form won\'t save, check that Vehicle Number is filled in with a valid registration format (e.g. TN49CH8736) and, for a new customer, that the phone number is a valid 10-digit Indian mobile number.',
  },
  {
    id: 'delivery-note-rental',
    keywords: [
      'per day rate', 'rental', 'rent equipment', 'scaffolding', 'date taken', 'date returned',
      'bill by day', 'daily rate',
    ],
    answer:
      'To bill rental items (like scaffolding or pipes) by the day instead of a flat rate: leave Rate blank and fill in the Per-Day Rate, plus Date Taken and Date Returned. The Amount is then computed as Per-Day Rate x Quantity x number of days between those two dates.',
  },
  {
    id: 'delivery-note-edit-delete',
    keywords: [
      'edit delivery note', 'delete delivery note', 'change a bill', 'update delivery note', 'cancel delivery note',
      'modify delivery note',
    ],
    answer:
      'Open the Billing / Delivery Note list, find the note, and use Edit or Delete from the row actions. Editing recalculates the total and adjusts stock for the new item quantities; deleting a note restores whatever stock had been auto-deducted for it.',
  },
  {
    id: 'delivery-note-print',
    keywords: ['print delivery note', 'print bill', 'print note', 'download delivery note', 'pdf', 'whatsapp'],
    answer:
      'Open the Delivery Note from the Billing / Delivery Note list and use Print - it opens a print-friendly, paper-exact layout (red R.S.A CONSTRUCTION header, particulars table, signatures, etc.) you can print directly or save as PDF from the browser\'s print dialog. There\'s also a "Share via WhatsApp" option to send the note as a PDF.',
  },
  {
    id: 'payment-status',
    keywords: ['payment status', 'paid or pending', 'mark as paid', 'pending payment', 'mark paid'],
    answer:
      'Each Delivery Note has a Payment Status field (Paid / Pending), set when creating or editing it, and toggleable from the Delivery Note list too. The Dashboard\'s "Pending Payments" card totals up everything still marked Pending.',
  },
  {
    id: 'customer-management',
    keywords: ['customer', 'existing customer', 'new customer', 'customer history', 'customer address'],
    answer:
      'When creating a Delivery Note you can either add a New Customer (name, phone, address) inline, or pick an Existing Customer from the dropdown. Customer name and phone are required for a new customer. Opening a customer\'s record also shows their past Delivery Notes.',
  },
  {
    id: 'material-add',
    keywords: [
      'add material', 'new material', 'material entry', 'purchase ledger', 'add stock',
      'record purchase', 'material stock', 'buy material', 'material purchase',
    ],
    answer:
      'Go to "Material Stock / Purchase Ledger" and use the entry form: Date, Material Name, Category, Quantity, Unit, Purchase Rate, Supplier, Remarks. The Total Amount (Quantity x Rate) is calculated live, and saving it updates the stock ledger and Remaining Stock automatically. Category and Unit suggestions come from the Superadmin panel.',
  },
  {
    id: 'stock-check',
    keywords: [
      'check stock', 'stock view', 'how much stock', 'remaining stock', 'current stock', 'low stock',
      'stock balance', 'reorder level',
    ],
    answer:
      'Stock View (left sidebar) shows Opening / Purchased / Used / Remaining quantity for every material. The Dashboard also has a "Low Stock Alert" card that flags any material at or below its configured reorder level.',
  },
  {
    id: 'stock-linkage',
    keywords: [
      'stock deducted', 'how does stock update', 'connection between billing and stock', 'auto deduct',
      'stock and billing',
    ],
    answer:
      'When you save a Delivery Note, each billed item is matched to the Material master (by explicit link or by matching name) and that quantity is automatically deducted from stock in the same database transaction - so billing and stock numbers never drift apart. Editing or deleting a note reverses the old stock impact first.',
  },
  {
    id: 'labour',
    keywords: [
      'labour', 'labor', 'worker', 'daily wage', 'attendance', 'site sheet', 'consolidated labour',
      'add worker', 'labour entry', 'worker balance', 'advance to worker',
    ],
    answer:
      'The Labour section has four tabs: Entry (record days worked / advance paid / balance per worker per date), Workers (add a worker\'s name, site, role, daily wage, opening balance), Site Sheet (labour cost for one site over a date range), and Consolidated (an overall labour summary across all sites). Sites shown here come from the Superadmin "Labour Sites" list.',
  },
  {
    id: 'vouchers',
    keywords: ['voucher', 'cash voucher', 'received by', 'advance payment voucher', 'part payment', 'full payment'],
    answer:
      'Vouchers (left sidebar) records cash paid out - Received From (defaults to R.S.A CONSTRUCTION), Received By, Purpose, Payment Type (Advance/Part/Full), Amount, and Remarks. Each gets an auto-generated voucher number (e.g. VCH-2026-0001) and a printable bilingual slip, the same pattern as the Delivery Note.',
  },
  {
    id: 'reports',
    keywords: [
      'report', 'reports', 'revenue report', 'material cost report', 'monthly report', 'export excel',
      'export report', 'yearly summary',
    ],
    answer:
      'Reports (left sidebar) covers Daily Billing & Material Movement, Monthly Revenue & Material Cost, and a Yearly Business Summary. You can export the Billing report to Excel, either from the browser (client-side) or via the server export endpoint.',
  },
  {
    id: 'dashboard',
    keywords: ['dashboard', 'today billing', 'monthly billing', 'yearly billing', 'total revenue', 'business overview'],
    answer:
      "The Dashboard gives an at-a-glance summary: Today's / Monthly / Yearly Billing, Total Revenue, Pending Payments, Total Materials, Low Stock Alerts, a monthly revenue chart, a paid/pending donut chart, and Recent Transactions.",
  },
  {
    id: 'superadmin',
    keywords: [
      'superadmin', 'settings', 'add particular', 'delivery note particulars', 'item columns',
      'material categories', 'labour sites', 'configure', 'reorder rows', 'move rows', 'discount column',
      'edit particulars',
    ],
    answer:
      'Superadmin (visible only to a user with isSuperAdmin = true, reached by clicking the sidebar logo 5 times within 1.5 seconds) has four sections, each with full add / edit / reorder (move up-down) / delete control: Delivery Note Particulars (the pre-printed row list, Tamil + English label), Item Columns like Discount or Surcharge (number/percent/text, add-to or subtract-from Amount), Material Categories & Units, and Labour Sites. Changes apply immediately across the app - no code deploy needed.',
  },
  {
    id: 'theme-language',
    keywords: ['dark mode', 'light mode', 'theme', 'tamil', 'english', 'language switch', 'change language'],
    answer:
      'The sidebar footer has a theme toggle (Light/Dark) and a language switcher (English/Tamil) - both are remembered per-browser. The Tamil toggle also switches the Delivery Note Particulars labels wherever an English label has been set in Superadmin.',
  },
  {
    id: 'sidebar',
    keywords: ['sidebar', 'collapse sidebar', 'ctrl+b', 'hide menu'],
    answer:
      'Click the «/» button at the top of the sidebar, or press Ctrl+B (Cmd+B on Mac), to collapse or expand the left sidebar on desktop. The mobile drawer always shows full labels.',
  },
  {
    id: 'login',
    keywords: ['login', 'log in', 'password', 'forgot password', 'sign in', 'cant login', 'reset password'],
    answer:
      "Login is at the app's root URL with the username/email and password issued by your admin. If you're locked out, ask a Superadmin user to reset your password from their side - there's no self-service reset yet.",
  },
  {
    id: 'roles',
    keywords: ['user roles', 'admin role', 'manager role', 'staff role', 'permissions', 'who can edit'],
    answer:
      'Accounts have a role - admin, manager, or staff - plus an optional isSuperAdmin flag. Superadmin status (not the same as the admin role) is what unlocks the Superadmin settings panel; ask whoever manages your database to grant it if you need it.',
  },
  {
    id: 'about-rsa',
    keywords: ['about rsa construction', 'company', 'r.s.a construction', 'contact', 'address of company'],
    answer:
      "R.S.A Construction uses this system to run its day-to-day billing and material tracking - it replaces the paper Delivery Note pad and Material Purchase Ledger with a digital, always-in-sync version. I don't have the company's specific contact/address details in this chat, but I can help with anything inside the app itself.",
  },
];

const FALLBACK_ANSWER =
  "I'm not fully sure how to answer that one yet, but I can help with anything about this RSA Construction system - Delivery Notes/Billing, Material Stock, Labour, Vouchers, Reports, or Superadmin settings. Try rephrasing, or ask something like \"how do I create a delivery note\" or \"how do I check stock\".";

// ---- Matching (used as the fallback when Groq isn't configured/available) -
function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Common filler words stripped out before word-level overlap scoring, so
// phrasing differences ("how do I..." vs "how to...") don't hurt matching.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'i', 'you', 'to', 'of', 'in', 'on',
  'for', 'and', 'or', 'how', 'what', 'where', 'when', 'can', 'my', 'me', 'it', 'this', 'that', 'please',
  'need', 'want', 'about',
]);

function contentWords(text) {
  return normalize(text)
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w));
}

function matchIntent(userText) {
  const text = normalize(userText);
  if (!text) return null;
  const userWords = new Set(contentWords(userText));

  let best = null;
  let bestScore = 0;

  for (const entry of KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of entry.keywords) {
      const kwNorm = normalize(kw);
      if (!kwNorm) continue;
      if (text.includes(kwNorm)) {
        // Exact phrase substring match - strong signal, weighted by phrase length.
        score += kwNorm.split(' ').length * 2;
      } else {
        // Partial credit: how many of the keyword's own content words also
        // appear anywhere in the user's message (handles reordered/looser
        // phrasing that isn't an exact substring, e.g. "worker daily wage
        // entry" vs the keyword "daily wage").
        const kwWords = kwNorm.split(' ').filter((w) => w && !STOPWORDS.has(w));
        if (kwWords.length > 0) {
          const overlap = kwWords.filter((w) => userWords.has(w)).length;
          if (overlap === kwWords.length && overlap > 0) score += overlap;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return bestScore > 0 ? best : null;
}

function keywordBotReply(lastUserMessage) {
  const matched = matchIntent(lastUserMessage);
  return matched ? matched.answer : FALLBACK_ANSWER;
}

// ---- Groq (LLM) path --------------------------------------------------------
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT =
  "You are the RSA Assistant, the helpful in-app support chatbot for R.S.A Construction's " +
  'Construction Management System. Your job is to answer ANY question the person might reasonably ' +
  'ask that relates to this app or R.S.A Construction\'s business - not just narrow "how do I click X" ' +
  'questions. That includes: how to use every module (Billing/Delivery Notes, Material Stock & ' +
  'Purchase Ledger, Labour, Vouchers, Dashboard, Reports, Superadmin settings), what a field or button ' +
  'means, why something might be required or failing to save, and general, reasonable questions about ' +
  'construction-site billing/material/labour practices that a construction-business assistant could help with ' +
  '(e.g. "what is a delivery note", "why track remaining stock", "what does per-day rental billing mean"). ' +
  "Ground every app-specific answer in the reference knowledge below - don't contradict it or invent " +
  'features/fields that aren\'t listed. If a question is about something this reference genuinely doesn\'t ' +
  'cover (e.g. exact company contact details, pricing outside the app, or something clearly unrelated to ' +
  'construction/billing/labour/materials), say briefly that you don\'t have that specific detail rather than ' +
  'inventing one, then offer to help with what you do know. Answer in a few clear, concise sentences (plain ' +
  'language, no unnecessary jargon), matching the language the person is writing in (English or Tamil) when ' +
  'possible. Never claim to take actions in the app yourself - only explain how the person can do it via the UI.\n\n' +
  'Reference knowledge about this app:\n' +
  KNOWLEDGE_BASE.map((k) => `- ${k.answer}`).join('\n');

async function callGroq(messages) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          // Only forward role+content, and only the last several turns, to
          // keep the request small and avoid sending anything unexpected.
          ...messages.slice(-12).map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content || '').slice(0, 2000),
          })),
        ],
        temperature: 0.4,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('Groq API error:', response.status, body);
      return null;
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    return reply || null;
  } catch (err) {
    console.error('Groq API request failed:', err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// POST /api/assistant/chat  { messages: [{ role: 'user'|'assistant', content: string }, ...] }
const chat = asyncHandler(async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400);
    throw new Error('messages array is required');
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');

  const groqReply = await callGroq(messages);
  const reply = groqReply || keywordBotReply(lastUserMessage?.content);

  res.json({ success: true, data: { reply, source: groqReply ? 'groq' : 'keyword' } });
});

// ---------------------------------------------------------------------------
// Superadmin action mode
// ---------------------------------------------------------------------------
/**
 * The assistant can carry out a fixed set of Superadmin tasks (see
 * assistantActions.js). It is split into two endpoints on purpose:
 *
 *   POST /action/propose  - reads the request, returns a DESCRIPTION of what
 *                           it would do. Never writes anything.
 *   POST /action/execute  - performs one named, whitelisted action.
 *
 * The confirmation step is therefore a property of the API, not of the UI. A
 * chat message on its own cannot change data, no matter what it says, because
 * the endpoint that could change data has to be called separately with an
 * explicit action name. Both are behind protect + requireSuperAdmin.
 */

const ACTION_SYSTEM_PROMPT =
  'You are the RSA Assistant operating in Superadmin mode for R.S.A Construction\'s management system. ' +
  'The person you are talking to is a verified superadmin. When they ask you to CHANGE the system\'s setup - ' +
  'add a category/unit/site, add a column to a module, create a new tab, rename or hide a tab, remove a column, ' +
  'or revoke someone\'s superadmin access - call the matching tool with the right arguments. ' +
  'Module keys are: dashboard, billing, materials, labour, voucher, stock, reports, plus any custom ones. ' +
  'If they are only ASKING a question rather than requesting a change, answer it in plain language and do not ' +
  'call a tool. If a request is ambiguous (you cannot tell which module they mean, or the name is missing), ask ' +
  'a short clarifying question instead of guessing. Never claim you have already made a change - a separate ' +
  'confirmation step actually performs it.';

async function callGroqWithTools(messages) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: ACTION_SYSTEM_PROMPT },
          ...messages.slice(-12).map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content || '').slice(0, 2000),
          })),
        ],
        tools: toolDefinitions(),
        tool_choice: 'auto',
        temperature: 0.2,
        max_tokens: 600,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('Groq tool-call error:', response.status, body);
      return null;
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message;
    if (!message) return null;

    const call = Array.isArray(message.tool_calls) ? message.tool_calls[0] : null;
    if (call && call.function) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch (err) {
        // A malformed argument blob means we can't describe the action
        // honestly, so treat it as "no action" rather than guessing.
        console.error('Could not parse tool arguments:', call.function.arguments);
        return { reply: "I couldn't work out the details for that - could you rephrase it?" };
      }
      return { action: call.function.name, args };
    }

    return { reply: (message.content || '').trim() };
  } catch (err) {
    console.error('Groq tool-call request failed:', err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Deterministic fallback for the handful of simplest requests, used when no
 * GROQ_API_KEY is configured. Not an attempt at understanding language - just
 * enough pattern matching that the action feature is usable and testable on a
 * deployment without an LLM key, instead of silently doing nothing.
 */
function parseActionFallback(text) {
  const message = String(text || '').trim();
  const lower = message.toLowerCase();

  const patterns = [
    { re: /add(?:\s+a)?\s+(?:material\s+)?category\s+(?:called\s+|named\s+)?["']?(.+?)["']?$/i, action: 'addMaterialCategory', key: 'value' },
    { re: /add(?:\s+a)?\s+unit\s+(?:called\s+|named\s+)?["']?(.+?)["']?$/i, action: 'addMaterialUnit', key: 'value' },
    { re: /add(?:\s+a)?\s+site\s+(?:called\s+|named\s+)?["']?(.+?)["']?$/i, action: 'addLabourSite', key: 'value' },
  ];

  for (const p of patterns) {
    const match = message.match(p.re);
    if (match) return { action: p.action, args: { [p.key]: match[1].trim() } };
  }

  // "add a column called X to materials" / "add column X on labour"
  const column = message.match(
    /add(?:\s+a)?\s+(?:column|field)\s+(?:called\s+|named\s+)?["']?(.+?)["']?\s+(?:to|on|in)\s+(?:the\s+)?(\w+)/i
  );
  if (column) {
    return { action: 'addColumn', args: { label: column[1].trim(), moduleKey: column[2].toLowerCase(), type: 'text' } };
  }

  if (/\b(add|create|make|rename|hide|remove|delete|revoke)\b/.test(lower)) {
    return {
      reply:
        "I can do that kind of change, but without an AI key configured I can only understand a few set phrasings. " +
        'Try "add a category called Bricks", "add a unit called Bags", "add a site called Anna Nagar", or ' +
        '"add a column called Discount to materials". For anything else, the Field Manager and Module Builder ' +
        'screens do all of it.',
    };
  }

  return { reply: keywordBotReply(message) };
}

// POST /api/assistant/action/propose  { messages: [...] }
const proposeAction = asyncHandler(async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400);
    throw new Error('messages array is required');
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  const outcome = (await callGroqWithTools(messages)) || parseActionFallback(lastUserMessage?.content);

  if (outcome.action) {
    const summary = describeAction(outcome.action, outcome.args);
    if (!summary) {
      return res.json({
        success: true,
        data: { reply: "That isn't one of the things I'm able to change." },
      });
    }
    return res.json({
      success: true,
      data: {
        proposal: {
          action: outcome.action,
          args: outcome.args,
          summary,
          destructive: isDestructive(outcome.action),
        },
      },
    });
  }

  res.json({ success: true, data: { reply: outcome.reply } });
});

// POST /api/assistant/action/execute  { action, args }
const executeAction = asyncHandler(async (req, res) => {
  const { action, args } = req.body;
  if (!action) {
    res.status(400);
    throw new Error('action is required');
  }

  let result;
  try {
    // req.auditSource makes any nested logAudit call record this as
    // assistant-driven, matching the explicit source on the action handlers.
    req.auditSource = 'assistant';
    result = await runAction(req, action, args);
  } catch (err) {
    res.status(400);
    throw err;
  }

  res.json({ success: true, data: { reply: result } });
});

module.exports = { chat, proposeAction, executeAction };
