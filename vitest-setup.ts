// Adds the jest-dom matchers (toBeInTheDocument, toBeDisabled, ...) to
// vitest's expect. Component tests rely on them; logic tests ignore them.
import '@testing-library/jest-dom/vitest';

// Unmounts anything @testing-library/svelte rendered, between tests. Not
// automatic here: the library registers its own cleanup off the *global*
// afterEach, and this project runs with `globals: false`, so without this
// import a second render would leave the first component's DOM behind and
// every query would find two matches.
import '@testing-library/svelte/vitest';
