import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import FollowList from './FollowList.svelte';

const users = [
  { id: 'user_alice', username: 'alice', firstname: 'Alice', lastname: 'A', viewerFollowStatus: 'FOLLOWING' },
  { id: 'user_carol', username: 'carol', viewerFollowStatus: 'NONE' },
];

describe('FollowList', () => {
  it('lists people with links to their pages', () => {
    render(FollowList, { props: { users, total: 2, page: 1, limit: 30, baseHref: '/u/bob/followers', empty: 'Nobody yet.' } });
    expect(screen.getByRole('link', { name: /Alice A/ })).toHaveAttribute('href', '/u/alice');
    expect(screen.getByRole('link', { name: /carol/ })).toHaveAttribute('href', '/u/carol');
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull();
  });

  it('pages when there is more than one page', () => {
    render(FollowList, { props: { users, total: 70, page: 2, limit: 30, baseHref: '/u/bob/followers', empty: 'Nobody yet.' } });
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/u/bob/followers?page=3');
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/u/bob/followers?page=1');
  });

  it('explains a hidden list and an empty one', () => {
    const { unmount } = render(FollowList, { props: { users: [], total: 4, page: 1, limit: 30, baseHref: '/u/bob/followers', empty: 'Nobody yet.', hidden: true } });
    expect(screen.getByText('Only followers can see this')).toBeInTheDocument();
    unmount();
    render(FollowList, { props: { users: [], total: 0, page: 1, limit: 30, baseHref: '/u/bob/followers', empty: 'Nobody yet.' } });
    expect(screen.getByText('Nobody yet.')).toBeInTheDocument();
  });
});
