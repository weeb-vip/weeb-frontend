// Teaches svelte-check about the jest-dom matchers that `vitest-setup.ts` adds
// to `expect` at runtime (toBeInTheDocument, toBeDisabled, ...). Without this
// the component tests type-check as errors even though they pass.
/// <reference types="@testing-library/jest-dom/vitest" />
