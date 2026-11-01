// Restoration failure pauses writes until an explicit user action authorises replacement.
// Missing storage is a normal first visit; validation/storage failures remain distinct.
export function readProtectedDraft(storage, key, decode, fallback) {
  try { const target = typeof storage === 'function' ? storage() : storage;return { value: decode(target.getItem(key)) ?? fallback(), writeLocked: false }; }
  catch { return { value: fallback(), writeLocked: true }; }
}
export function writeProtectedDraft(storage, key, value, decode, writeLocked) {
  if (writeLocked) return { saved: false, reason: 'locked' };
  let raw;
  try { raw = JSON.stringify(value); decode(raw); }
  catch { return { saved: false, reason: 'invalid' }; }
  try { const target = typeof storage === 'function' ? storage() : storage;target.setItem(key, raw); return { saved: true, reason: '' }; }
  catch { return { saved: false, reason: 'storage' }; }
}
