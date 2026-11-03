// CLAUDE.md §4.6: remove exact duplicates by image hash. The first path (sorted) is kept,
// so the choice is the same on every run and every machine.

export type HashedFile = { path: string; hash: string };

export function findDuplicates(files: HashedFile[]): {
  keep: HashedFile[];
  duplicates: { path: string; duplicateOf: string }[];
} {
  const first = new Map<string, string>();
  const keep: HashedFile[] = [];
  const duplicates: { path: string; duplicateOf: string }[] = [];
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const original = first.get(f.hash);
    if (original) duplicates.push({ path: f.path, duplicateOf: original });
    else {
      first.set(f.hash, f.path);
      keep.push(f);
    }
  }
  return { keep, duplicates };
}
