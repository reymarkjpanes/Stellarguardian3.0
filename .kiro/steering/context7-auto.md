# Context7 — Automatic Documentation Lookup

You MUST use the Context7 MCP tool (`resolve-library-id` then `get-library-docs`) on EVERY prompt that involves:

- Writing or modifying code (any language, any framework)
- Answering questions about APIs, libraries, or frameworks
- Reviewing code that uses external dependencies
- Debugging issues related to library behavior
- Looking up correct usage patterns

## Libraries to always look up when relevant

| Technology        | Context7 library slug         |
|-------------------|-------------------------------|
| React             | react                         |
| React Router      | react-router                  |
| Express           | express                       |
| Vite              | vite                          |
| Tailwind CSS      | tailwindcss                   |
| better-sqlite3    | better-sqlite3                |
| Firebase          | firebase                      |
| Stellar SDK       | stellar-sdk                   |
| Zod               | zod                           |
| Framer Motion     | framer-motion                 |
| jsonwebtoken      | jsonwebtoken                  |
| Vitest            | vitest                        |
| Kysely            | kysely                        |
| Resend            | resend                        |

## Rules

1. Before writing any code that touches an external library, call Context7 to get the latest docs.
2. Do NOT rely on training data for API signatures — always verify via Context7 first.
3. If Context7 is unavailable (server not running), proceed with best-effort but note it.
4. When generating output or explanations about library behavior, cite the Context7 lookup.
5. This applies to EVERY interaction — no exceptions.
