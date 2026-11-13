// Browser side of "one vote per phone" (owner's rule, Nov 2026): the vote receipt, a signed
// copy of the phone's random device code, kept in its own storage so that clearing cookies
// alone does not open a fresh vote. Nothing else about the phone is read or sent.
// Wrapped in try/catch: blocked storage must never stop someone voting.

const RECEIPT_KEY = "gtas_receipt";

export function readStoredReceipt(): string | null {
  try {
    return localStorage.getItem(RECEIPT_KEY);
  } catch {
    return null;
  }
}

export function storeReceipt(receipt: string) {
  try {
    localStorage.setItem(RECEIPT_KEY, receipt);
  } catch {
    // Private mode or blocked storage: the cookie still holds the vote.
  }
}
