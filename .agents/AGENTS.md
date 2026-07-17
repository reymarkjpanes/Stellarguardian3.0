# Custom Rules

- **Use Context7 Automatically**: Whenever the user asks a coding question or you need to look up documentation, APIs, libraries, or frameworks, automatically use the `context7` MCP server to retrieve the latest documentation and verified code snippets.

- **Auto-Detect and Trigger Skills**:
  - **`frontend-design`**: Trigger automatically when the prompt asks to create, modify, restyle, or design any UI component, page layout, or CSS (Vite, Tailwind, React styling).
  - **`web-artifacts-builder`**: Trigger automatically when building complex, stateful multi-component UI features in React/TSX.
  - **`webapp-testing`**: Trigger automatically when asked to test, verify, run assertions, or check frontend behavior using Playwright/browser testing.
  - **`find-skills`**: Trigger automatically when the user asks how to perform a task outside existing capabilities, asks to search for skills, or expresses interest in extending agent features.
  - **`react-patterns`**: Trigger when writing React components, hooks, state, routing, or general React architecture.
  - **`react-performance`**: Trigger when optimizing render cycles, lazy loading, state updates, or bundle sizes.
  - **`vite-patterns`**: Trigger when modifying `vite.config.ts`, bundler settings, or build pipelines.
  - **`backend-patterns`**: Trigger when modifying Express endpoints, middleware, SQLite data access, or backend models.
  - **`database-migrations`**: Trigger when adding/modifying SQLite tables, schemas, or running migration scripts (like `run_migrations.cjs`).
  - **`motion-ui`**: Trigger when implementing or tweaking animations, transitions, or using Framer Motion (`motion`).
  - **`make-interfaces-feel-better`**: Trigger when tweaking micro-interactions, hovers, active states, loading indicators, or user feedback loops.


