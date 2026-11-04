// Optional demographics (CLAUDE.md §2): anonymous, never required. Kept free of Node
// imports so the vote screen can use it in the browser.

export const AGE_BRACKETS = ["13-15", "16-17", "18-24", "25-34", "35+"] as const;

export const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
] as const;
