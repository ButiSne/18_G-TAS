// Team area: never indexed, phone-sized column.
export const metadata = { robots: { index: false, follow: false } };

export default function MembersLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-[70svh] max-w-xl px-4 pt-6 pb-14">{children}</div>;
}
