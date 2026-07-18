# Automatic Prompt Detection & Trigger System Rules

You MUST evaluate the user's prompt against these auto-detection rules on every request and immediately trigger the corresponding skill/tool.

## 1. Documentation & API Lookup
- **`context7` (MCP)**: Trigger automatically whenever the user asks a coding question, asks how to use an API/library, or whenever you need to look up official documentation or code snippets for React, Vite, Express, Tailwind, SQLite, Firebase, etc.

## 2. Frontend Design & Taste Frameworks (Anti-Slop)
- **`design-taste-frontend`**: Trigger automatically when asked to build, restyle, create, or redesign any UI, webpage, component, or landing page. Enforces anti-generic, high-agency design choices.
- **`high-end-visual-design`**: Trigger automatically when asked for agency-level, luxury, or high-end visual design, typography, spacing, cards, or custom design tokens.
- **`redesign-existing-projects`**: Trigger automatically when asked to upgrade, audit, refresh, modernise, or redesign existing pages, components, or UI themes.
- **`minimalist-ui`**: Trigger automatically when asked for clean, warm monochrome, editorial, or minimalist UI designs.
- **`industrial-brutalist-ui`**: Trigger automatically when asked for dark-mode, tech, terminal, cyberpunk, mechanical, or brutalist UI themes.
- **`gpt-taste`**: Trigger automatically when creating landing pages, portfolio layouts, or complex scroll-driven interactive sections.
- **`stitch-design-taste`**: Trigger automatically when generating semantic design system guidelines (`DESIGN.md`).
- **`frontend-design`**: Trigger automatically for general styling, CSS, Tailwind utility choices, or visual hierarchy decisions.

## 3. Image & Asset Generation Skills
- **`image-to-code`**: Trigger automatically when converting design images, wireframes, or screenshots into frontend code.
- **`imagegen-frontend-web`**: Trigger automatically when generating visual design reference comps for web pages.
- **`imagegen-frontend-mobile`**: Trigger automatically when designing or mockup-framing mobile app screens.
- **`brandkit`**: Trigger automatically when asked to generate brand guideline boards, logo concepts, or identity assets.

## 4. Engineering & Architecture Skills
- **`react-patterns`**: Trigger automatically when creating or refactoring React components, custom hooks, state management, or React Router navigation.
- **`react-performance`**: Trigger automatically when optimizing React re-renders, state updates, bundle size, lazy loading, or virtualized lists.
- **`vite-patterns`**: Trigger automatically when modifying `vite.config.ts`, bundler settings, dev server proxy, or asset pipelines.
- **`backend-patterns`**: Trigger automatically when creating or modifying Express API endpoints, middleware, authentication, or server logic.
- **`database-migrations`**: Trigger automatically when adding/modifying SQLite tables, schema changes, or database scripts (e.g., `run_migrations.cjs`).
- **`motion-ui`**: Trigger automatically when implementing page transitions, micro-animations, or Framer Motion (`motion`) effects.
- **`claude-api`**: Trigger automatically when working with Anthropic/Claude API integrations, prompt models, or token usage.

## 5. Artifacts & Complete Code Enforcement
- **`web-artifacts-builder`**: Trigger automatically when creating multi-component React UI features or stateful interactive modules.
- **`full-output-enforcement`**: Trigger automatically whenever generating full multi-component UI files or complex code to prevent any code truncation or placeholder shortcuts.

## 6. Testing & Discovery
- **`webapp-testing`**: Trigger automatically when asked to test, verify, run assertions, or check frontend behavior using Playwright or browser devtools.
- **`find-skills`**: Trigger automatically when the prompt asks to perform a task outside existing skills or requests to discover/install new skills.
