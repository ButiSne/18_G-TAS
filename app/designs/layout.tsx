// Team-only until the public vote (CLAUDE.md §0.9): never indexed.
export const metadata = { robots: { index: false, follow: false } };

export default function DesignsLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-[70svh] max-w-5xl px-4 pt-6 pb-14">{children}</div>;
}
