import type { Meta, StoryObj } from '@storybook/svelte';
import Pagination from '../Pagination.svelte';

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

const meta = {
  title: 'Primitives/Pagination',
  component: Pagination,
  tags: ['autodocs'],
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

/** First page: Previous is disabled, Next is live. */
export const FirstPage: Story = {
  args: {
    page: 0,
    totalPages: 12,
    perPage: 24,
    perPageOptions: PAGE_SIZE_OPTIONS,
    onPageChange: () => {},
    onPerPageChange: () => {},
  },
};

/** Somewhere in the middle: both directions available. */
export const MiddlePage: Story = {
  args: {
    page: 5,
    totalPages: 12,
    perPage: 24,
    perPageOptions: PAGE_SIZE_OPTIONS,
    onPageChange: () => {},
    onPerPageChange: () => {},
  },
};

/** Last page: Next is disabled. */
export const LastPage: Story = {
  args: {
    page: 11,
    totalPages: 12,
    perPage: 24,
    perPageOptions: PAGE_SIZE_OPTIONS,
    onPageChange: () => {},
    onPerPageChange: () => {},
  },
};

/** One page of results: both buttons dead and the page count suppressed, leaving just the size control. */
export const SinglePage: Story = {
  args: {
    page: 0,
    totalPages: 1,
    perPage: 24,
    perPageOptions: PAGE_SIZE_OPTIONS,
    onPageChange: () => {},
    onPerPageChange: () => {},
  },
};

/** Without `perPage`/`perPageOptions` the size control drops and only prev/next remain. */
export const WithoutPerPage: Story = {
  args: {
    page: 2,
    totalPages: 8,
    onPageChange: () => {},
  },
};

/** Large counts are grouped, so "Page 3 of 1,204" stays readable (SearchPage hits this). */
export const ManyPages: Story = {
  args: {
    page: 2,
    totalPages: 1204,
    perPage: 48,
    perPageOptions: PAGE_SIZE_OPTIONS,
    onPageChange: () => {},
    onPerPageChange: () => {},
  },
};
