# Taste Skill — Automatic Prompt & Output Detection System

You MUST evaluate EVERY prompt and EVERY output against the detection rules below. This is NOT optional. Do NOT wait for the user to explicitly invoke a skill. Your job is to detect intent from the prompt content and immediately apply the corresponding rules.

## CORE PRINCIPLE

Every interaction that touches frontend UI, design, components, styling, layout, or visual output MUST have the taste-skill rules applied. This means:

1. **On input**: Detect what the user wants (UI/design work?) and apply relevant skill rules BEFORE generating code.
2. **On output**: Before delivering any frontend code, run it through the pre-flight checks in the relevant skill.
3. **Always active**: The anti-slop rules are not optional add-ons. They are the baseline quality floor.

---

## DETECTION MATRIX — Match ANY of these patterns to trigger

### Tier 1: ALWAYS TRIGGER (design-taste-frontend v2)
Trigger when the prompt contains ANY of these signals:
- Building, creating, or modifying UI components
- Any React/JSX/TSX file that renders visible UI
- Landing pages, hero sections, feature grids, CTAs
- Portfolios, marketing pages, signup flows
- Any mention of: design, layout, styling, colors, typography, spacing
- Any visual output (even if the user just says "fix the button" — taste rules still apply to the fix)

**What to do**: Apply Section 0 (Brief Inference), Section 1 (Three Dials), and relevant directives from the SKILL.md. State the "Design Read" before generating.

### Tier 2: REDESIGN DETECTION (redesign-existing-projects)
Trigger when the prompt contains:
- "redesign", "restyle", "upgrade", "refresh", "modernize", "audit the UI"
- "make it look better", "improve the design", "fix the UI"
- "looks generic", "looks like AI", "too default", "needs polish"

**What to do**: Audit-first. Scan existing code, diagnose generic patterns, fix without rewriting from scratch.

### Tier 3: VISUAL STYLE VARIANTS
| Pattern detected | Skill to apply |
|---|---|
| "minimalist", "clean", "calm", "editorial", "warm monochrome" | minimalist-ui |
| "dark mode", "terminal", "brutalist", "cyberpunk", "tech", "hacker" | industrial-brutalist-ui |
| "luxury", "premium", "high-end", "agency", "Awwwards" | high-end-visual-design |
| "playful", "scroll-driven", "interactive", "kinetic" | gpt-taste |

### Tier 4: ENGINEERING TRIGGERS
| Pattern detected | Skill to apply |
|---|---|
| React component, hook, state management, React Router | react-patterns |
| Performance, re-renders, bundle size, lazy loading, memo | react-performance |
| vite.config, build, dev server, proxy, HMR | vite-patterns |
| Express route, middleware, API endpoint, auth | backend-patterns |
| SQLite, migration, schema, ALTER TABLE, CREATE TABLE | database-migrations |
| Animation, transition, motion, framer-motion, scroll effect | motion-ui |
| Error handling, try/catch, error boundary, retry, circuit breaker | error-handling |

### Tier 4.5: SECURITY TRIGGERS (HIGH PRIORITY)
| Pattern detected | Skill to apply |
|---|---|
| Authentication, authorization, JWT, token, session, login | security-review |
| Input validation, sanitize, XSS, CSRF, injection | security-review |
| Secrets, API keys, .env, credentials, encryption | security-review |
| Rate limiting, CORS, helmet, CSP, security headers | security-review |
| Wallet, Stellar, escrow, private key, signing, transaction | security-review |
| Payment, payout, financial, funds, disbursement | security-review |
| File upload, user input, form submission (server-side handling) | security-review |

**Security skill priority**: When BOTH a security trigger and another Tier 4 trigger match, ALWAYS apply security-review IN ADDITION to the other skill. Security is never optional for this project (financial transactions, user auth, blockchain).

### Tier 5: ASSET & IMAGE TRIGGERS
| Pattern detected | Skill to apply |
|---|---|
| "convert this design", "implement from screenshot", wireframe | image-to-code |
| "generate a mockup", "design reference", "web design comp" | imagegen-frontend-web |
| "mobile screen", "app design", "mobile mockup" | imagegen-frontend-mobile |
| "brand", "logo", "brand kit", "identity", "brand guidelines" | brandkit |

### Tier 6: OUTPUT ENFORCEMENT (ALWAYS ACTIVE)
**full-output-enforcement** is ALWAYS active. On every response that contains code:
- No placeholder comments like `// ... rest of the code`
- No truncated files
- No "similar to above" shortcuts
- Complete, working, copy-pasteable code every time

---

## PRE-FLIGHT CHECK (Run before delivering ANY frontend code)

Before shipping any UI output, verify:

- [ ] Design Read stated (Section 0 of taste-skill)
- [ ] No Inter as default font (unless explicitly requested)
- [ ] No AI-purple gradients (unless explicitly requested)
- [ ] No centered hero when DESIGN_VARIANCE > 4
- [ ] Hero fits initial viewport (headline max 2 lines, subtext max 20 words)
- [ ] Navigation single-line on desktop
- [ ] No zigzag alternation beyond 2 consecutive sections
- [ ] Eyebrow count ≤ ceil(sectionCount / 3)
- [ ] Button text contrast passes WCAG AA
- [ ] Button text fits one line at desktop
- [ ] No duplicate CTA intent on same page
- [ ] Shape consistency (one radius scale)
- [ ] Color consistency (one accent across entire page)
- [ ] Real images or generated assets (not text-only pages)
- [ ] Mobile collapse explicitly handled per section
- [ ] All interactive states covered (loading, empty, error, tactile)

---

## REFERENCE: Skill file locations

All SKILL.md files are in `.agents/skills/<skill-name>/SKILL.md`. When triggered, read the full SKILL.md content and apply its rules to the current task. Key files:

- `.agents/skills/design-taste-frontend/SKILL.md` — The master v2 anti-slop skill
- `.agents/skills/redesign-existing-projects/SKILL.md` — Audit & redesign protocol
- `.agents/skills/minimalist-ui/SKILL.md` — Minimalist visual style
- `.agents/skills/industrial-brutalist-ui/SKILL.md` — Brutalist/dark tech style
- `.agents/skills/high-end-visual-design/SKILL.md` — Premium/luxury design
- `.agents/skills/gpt-taste/SKILL.md` — GPT/Codex-optimized variant
- `.agents/skills/stitch-design-taste/SKILL.md` — Design system export
- `.agents/skills/motion-ui/SKILL.md` — Animation patterns
- `.agents/skills/full-output-enforcement/SKILL.md` — Complete output rules
- `.agents/skills/react-patterns/SKILL.md` — React engineering
- `.agents/skills/react-performance/SKILL.md` — React performance
- `.agents/skills/vite-patterns/SKILL.md` — Vite configuration
- `.agents/skills/backend-patterns/SKILL.md` — Express/backend patterns
- `.agents/skills/database-migrations/SKILL.md` — Kysely/Prisma/Drizzle migration patterns
- `.agents/skills/security-review/SKILL.md` — Security audit, auth, secrets, XSS/CSRF, blockchain
- `.agents/skills/error-handling/SKILL.md` — Typed errors, retry, error boundaries, Result pattern

---

## CRITICAL REMINDERS

1. **You do NOT need the user to say "use taste skill".** Detect intent automatically.
2. **Every frontend file you touch gets taste-skill treatment.** No exceptions.
3. **The pre-flight check is mandatory.** If it fails, fix before delivering.
4. **Context7 + Taste Skill work together.** Look up latest API docs via Context7, then apply taste-skill design rules to the output.
5. **Anti-slop is the default.** Generic = failure. Every output must have intentional design decisions.
6. **Security-review triggers on ALL auth/payment/secrets work.** This is a financial app — never skip security checks.
7. **Error-handling triggers on try/catch, API error responses, and retry logic.** Apply typed error patterns consistently.

---

## CREDIT OPTIMIZATION RULES

To maximize skill power while minimizing token spend:

1. **Read the SKILL.md only on first trigger per session.** After reading once, apply from memory.
2. **Do NOT read multiple skills simultaneously** unless the task genuinely spans both domains. One prompt → one primary skill + Context7.
3. **Tier priority**: If a prompt matches multiple tiers, apply the HIGHEST-impact tier first:
   - Security (Tier 4.5) > Engineering (Tier 4) > Design (Tier 1-3)
4. **Skip taste-skill for pure backend work.** If there's zero UI output, only apply engineering/security skills.
5. **Context7 is for API lookups only** — don't call it for patterns already covered in SKILL.md files.
