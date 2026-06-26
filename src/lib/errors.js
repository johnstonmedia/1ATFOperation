// Central error catalogue. Every failure maps to an internal 1ATF error code so
// RHQ can categorise and resolve issues fast. `reportable` marks genuine
// technical/system faults (auto-dispatched to RHQ); ordinary user-input
// problems (wrong password, etc.) are shown but NOT auto-reported, to avoid
// flooding the Help inbox.
//
// Code scheme:
//   ATF-NET-*   network / connectivity
//   ATF-AUTH-*  authentication
//   ATF-CFG-*   Firebase project configuration
//   ATF-DATA-*  database (Firestore)
//   ATF-INP-*   user input / validation
//   ATF-UNK-*   uncategorised

// Errors thrown by our own code carry an `appCode`.
export const APP_CODES = {
  VALIDATION: { code: 'ATF-INP-01', category: 'Account Issue', reportable: false },
  NO_ACCOUNT: { code: 'ATF-AUTH-03', category: 'Account Issue', reportable: false,
    message: 'No account found, or wrong password. If you have not set a password yet, use “Log in with temporary password”.' },
  BAD_PASSWORD: { code: 'ATF-AUTH-01', category: 'Account Issue', reportable: false,
    message: 'Incorrect ID number or password.' },
  BAD_TEMP: { code: 'ATF-AUTH-04', category: 'Account Issue', reportable: false,
    message: 'Invalid ID number or temporary password.' },
  ALREADY_REG: { code: 'ATF-AUTH-02', category: 'Account Issue', reportable: false,
    message: 'This ID is already registered. Use Sign in instead.' },
}

// Firebase error codes.
const FB_CODES = {
  'auth/network-request-failed': { code: 'ATF-NET-01', category: 'Account Issue', reportable: true,
    message: 'Could not reach the authentication server. Check your internet connection and disable any ad/privacy blockers for this site, then try again.' },
  'auth/too-many-requests': { code: 'ATF-AUTH-05', category: 'Account Issue', reportable: true,
    message: 'Too many attempts. Please wait a few minutes and try again.' },
  'auth/operation-not-allowed': { code: 'ATF-CFG-01', category: 'Account Issue', reportable: true,
    message: 'Email/Password sign-in is not enabled for this project. RHQ must enable it in Firebase.' },
  'auth/configuration-not-found': { code: 'ATF-CFG-02', category: 'Account Issue', reportable: true,
    message: 'Authentication is not configured. RHQ must enable Email/Password sign-in in Firebase.' },
  'auth/internal-error': { code: 'ATF-AUTH-99', category: 'Account Issue', reportable: true,
    message: 'An internal authentication error occurred. RHQ has been notified.' },
  'auth/invalid-credential': { code: 'ATF-AUTH-01', category: 'Account Issue', reportable: false,
    message: 'Incorrect ID number or password.' },
  'auth/invalid-email': { code: 'ATF-INP-02', category: 'Account Issue', reportable: false,
    message: 'That ID number is not valid.' },
  'auth/weak-password': { code: 'ATF-INP-03', category: 'Account Issue', reportable: false,
    message: 'Password must be at least 6 characters.' },
  'permission-denied': { code: 'ATF-DATA-01', category: 'Support', reportable: true,
    message: 'The server rejected the request (permissions). RHQ may need to publish the database rules.' },
  'unavailable': { code: 'ATF-DATA-02', category: 'Support', reportable: true,
    message: 'The database is temporarily unavailable. Please try again shortly.' },
}

const DEFAULT = { code: 'ATF-UNK-00', category: 'Support', reportable: true,
  message: 'An unexpected error occurred. RHQ has been notified.' }

// Classify any thrown value into a stable { code, category, reportable, message,
// rawCode, rawMessage }.
export function classify(err) {
  const rawCode = err?.appCode || err?.code || ''
  const rawMessage = err?.message || String(err)
  let entry = APP_CODES[err?.appCode] || FB_CODES[err?.code] || DEFAULT
  // Network failures from non-auth SDKs sometimes surface as plain messages.
  if (entry === DEFAULT && /network|offline|failed to fetch/i.test(rawMessage)) {
    entry = FB_CODES['auth/network-request-failed']
  }
  return {
    code: entry.code,
    category: entry.category,
    reportable: entry.reportable,
    message: entry.message || rawMessage,
    rawCode,
    rawMessage,
  }
}

// Build the detailed report body RHQ sees, with everything needed to diagnose.
export function buildReport(info, context, extra = {}) {
  return [
    'AUTO-REPORTED SYSTEM ERROR',
    `Code:    ${info.code}`,
    `Action:  ${context}`,
    `ID used: ${extra.idNumber || 'n/a'}`,
    `Summary: ${info.message}`,
    `Raw:     ${[info.rawCode, info.rawMessage].filter(Boolean).join(' — ')}`,
    `Page:    ${typeof location !== 'undefined' ? location.href : ''}`,
    `Device:  ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`,
    `Time:    ${new Date().toISOString()}`,
  ].join('\n')
}

// Helper to throw an app-level error carrying an internal code.
export function appError(appCode, message) {
  const e = new Error(message)
  e.appCode = appCode
  return e
}
