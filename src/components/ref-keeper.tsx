"use client";

import { useEffect } from "react";
import { rememberRef } from "@/src/lib/ref-memory";

/** On any page, keeps the ?ref= a visitor arrived with for this tab (src/lib/ref-memory.ts). */
export function RefKeeper() {
  useEffect(() => {
    rememberRef(new URLSearchParams(window.location.search).get("ref"));
  }, []);
  return null;
}
