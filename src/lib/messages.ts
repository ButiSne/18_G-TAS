import en from "@/messages/en.json";

// Strings live in /messages so isiZulu (zu.json) can be added without touching pages.
export type Messages = typeof en;

export function getMessages(): Messages {
  return en;
}
