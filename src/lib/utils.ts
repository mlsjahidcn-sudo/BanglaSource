// Tiny classname helper. Same API as clsx/cn but zero deps.
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
