/**
 * Shared anime status utilities
 * Single source of truth for status enum values, labels, and colors
 */

export type AnimeStatus = 'WATCHING' | 'COMPLETED' | 'ONHOLD' | 'DROPPED' | 'PLANTOWATCH';

export const STATUS_LABELS: Record<AnimeStatus, string> = {
  'WATCHING': 'Watching',
  'COMPLETED': 'Completed',
  'ONHOLD': 'On Hold',
  'DROPPED': 'Dropped',
  'PLANTOWATCH': 'Plan to Watch',
};

export const STATUS_OPTIONS: AnimeStatus[] = ['WATCHING', 'COMPLETED', 'ONHOLD', 'DROPPED', 'PLANTOWATCH'];

export const STATUS_COLORS: Record<AnimeStatus, string> = {
  'WATCHING': 'var(--weeb-green)',
  'COMPLETED': 'var(--weeb-accent)',
  'ONHOLD': 'var(--weeb-fg-muted)',
  'DROPPED': 'var(--weeb-red)',
  'PLANTOWATCH': 'var(--weeb-amber)',
};

export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return '';
  const upper = status.toUpperCase() as AnimeStatus;
  return STATUS_LABELS[upper] || status;
}

export function getStatusColor(status: string | null | undefined): string {
  if (!status) return 'var(--weeb-fg-muted)';
  const upper = status.toUpperCase() as AnimeStatus;
  return STATUS_COLORS[upper] || 'var(--weeb-fg-muted)';
}

export function normalizeStatus(status: string | null | undefined): AnimeStatus | null {
  if (!status) return null;
  const upper = status.toUpperCase();
  if (upper in STATUS_LABELS) return upper as AnimeStatus;
  // Handle legacy snake_case variants
  const mapped: Record<string, AnimeStatus> = {
    'PLAN_TO_WATCH': 'PLANTOWATCH',
    'ON_HOLD': 'ONHOLD',
  };
  return mapped[upper] || null;
}

export function isOnList(status: string | null | undefined): boolean {
  return normalizeStatus(status) !== null;
}
