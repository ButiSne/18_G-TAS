"use client";

import { useFormStatus } from "react-dom";

/** A form's submit button that shows progress and can't be double-tapped. */
export function SubmitButton({
  children,
  pending,
  className,
}: {
  children: React.ReactNode;
  pending: string;
  className?: string;
}) {
  const status = useFormStatus();
  return (
    <button type="submit" disabled={status.pending} className={className}>
      {status.pending ? pending : children}
    </button>
  );
}
