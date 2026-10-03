import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ActivityFeed from './ActivityFeed.svelte';
import type { ActivityItem } from './activity';

const item = (key: string, overrides: Partial<ActivityItem> = {}): ActivityItem => ({
  key,
  actor: { id: 'user_bob', username: 'bob', name: 'Bob', profileImageUrl: null },
  verb: 'started watching',
  card: { id: 'anime-1', slug: 'cowboy-bebop', title: 'Cowboy Bebop', image: 'anime-1', imagePath: 'posters' },
  occurredAt: '2026-10-03T11:00:00Z',
  when: '1h',
  ...overrides,
});

describe('ActivityFeed', () => {
  it('shows the empty message when there is nothing', () => {
    render(ActivityFeed, { props: { items: [], empty: 'Quiet in here.' } });
    expect(screen.getByText('Quiet in here.')).toBeInTheDocument();
  });

  it('renders a card per item with who, what and when', () => {
    render(ActivityFeed, { props: { items: [item('a'), item('b', { verb: 'scored 9', when: '2d' })] } });
    expect(screen.getAllByText('Cowboy Bebop')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /Bob/ })).toHaveLength(2);
    expect(screen.getByText('started watching')).toBeInTheDocument();
    expect(screen.getByText('scored 9')).toBeInTheDocument();
    expect(screen.getByText('2d')).toBeInTheDocument();
  });

  it('can hide the actor for a page that is about one person', () => {
    render(ActivityFeed, { props: { items: [item('a')], showActor: false } });
    expect(screen.queryByRole('link', { name: /Bob/ })).toBeNull();
    expect(screen.getByText('started watching')).toBeInTheDocument();
  });
});
