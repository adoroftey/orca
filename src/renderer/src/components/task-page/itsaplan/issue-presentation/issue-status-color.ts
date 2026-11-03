export function issueStatusColor(color?: string): string {
  return color && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)
    ? color
    : 'var(--muted-foreground)'
}
