# Feature Gap Analysis — StellarGuardian 3.0

## Classification Legend

- 🔴 **Critical** — Blocks core functionality; must fix before any deployment
- 🟠 **High** — Significantly impacts user experience or data integrity
- 🟡 **Medium** — Missing feature that affects completeness
- 🟢 **Low** — Nice-to-have enhancement

---

## 1. Authentication & Onboarding Gaps

| # | Title | Severity | Module | Description | Recommendation | Effort |
|---|-------|----------|--------|-------------|----------------|--------|
| 1 | No signup page | 🔴 | Auth | `/signup` link exists but no page implementation | Implement email/password signup with Supabase Auth | 4h |
| 2 | No password reset flow | 🟠 | Auth | `/forgot-password` link exists but no page | Implement reset flow using Supabase `resetPasswordForEmail` | 4h |
| 3 | No email verification | 🟡 | Auth | Users can log in without verifying email | Enable Supabase email confirmation; add verification page | 4h |
| 4 | No OAuth/social login | 🟡 | Auth | Only email/password available | Add Google/GitHub OAuth via Supabase | 4h |
| 5 | No onboarding wizard | 🟡 | UX | First-time users land on empty dashboard | Add guided onboarding (create workspace → create/join event) | 2d |
| 6 | No MFA for financial ops | 🟠 | Security | Fund/disburse/refund have no 2FA | Add TOTP or SMS verification before financial actions | 2d |

---

## 2. Workspace Management Gaps

| # | Title | Severity | Module | Description | Recommendation | Effort |
|---|-------|----------|--------|-------------|----------------|--------|
| 7 | No workspace creation page | 🟠 | Workspace | Quick action links to `/workspaces/new` — page missing | Build workspace creation form | 4h |
| 8 | No workspace member management | 🟠 | Workspace | Cannot invite/remove members via UI | Build member table with invite by email, role assignment | 2d |
| 9 | No workspace switcher | 🟡 | UX | Users with multiple workspaces can't switch | Add dropdown in nav showing all workspaces | 4h |
| 10 | No workspace settings page | 🟡 | Workspace | Settings schema exists but no management UI | Build settings form (timezone, defaults, billing) | 1d |
| 11 | No workspace billing UI | 🟡 | Workspace | Billing schema defined but no implementation | Build billing page with plan display | 2d |
| 12 | No white-label configuration | 🟢 | Workspace | Schema supports custom domain/branding | Build white-label settings form | 2d |
| 13 | No feature flags UI | 🟢 | Workspace | `feature_flags jsonb` column exists | Build feature flag toggle panel for admins | 1d |

---

## 3. Event Management Gaps

| # | Title | Severity | Module | Description | Recommendation | Effort |
|---|-------|----------|--------|-------------|----------------|--------|
| 14 | Event state stepper shows wrong states | 🟠 | Events | UI shows 5 states; DB has 18 | Align stepper with actual lifecycle states | 1d |
| 15 | No event Review state workflow | 🟡 | Events | Design specifies Draft → Review → Published | Implement review step with approval gate | 1d |
| 16 | No multi-round judging | 🟡 | Judging | DB has JudgingRound1/Round2; code doesn't | Implement round configuration and progression | 3d |
| 17 | No analytics dashboard | 🟡 | Events | No event-level analytics page | Build analytics with participation rates, scores, timelines | 3d |
| 18 | No bulk member operations | 🟡 | Events | Cannot approve all pending members at once | Add "approve all" / "assign judges" bulk actions | 4h |
| 19 | No event duplication | 🟢 | Events | Organizers must recreate from scratch | Add "duplicate event" with template pre-fill | 4h |
| 20 | No event archival automation | 🟢 | Events | `retention_days` exists but no auto-archive | Add cron job to archive events past retention | 4h |

---

## 4. Team & Participation Gaps

| # | Title | Severity | Module | Description | Recommendation | Effort |
|---|-------|----------|--------|-------------|----------------|--------|
| 21 | No team search/discovery | 🟡 | Teams | Participants can't find teams to join | Build team listing with open slots, skill matching | 1d |
| 22 | No team invitation flow | 🟡 | Teams | Captains can't invite specific participants | Wire invitation service to team UI | 4h |
| 23 | No team disbandment flow | 🟡 | Teams | Captain can't disband team cleanly | Add disband action with member notification | 4h |
| 24 | No mentor matching | 🟢 | Teams | Mentor role exists but no matching | Build mentor request/assignment UI | 2d |

---

## 5. Submission & Judging Gaps

| # | Title | Severity | Module | Description | Recommendation | Effort |
|---|-------|----------|--------|-------------|----------------|--------|
| 25 | No file upload UI | 🟡 | Submissions | Upload route exists but no UI | Build drag-drop file upload with progress | 1d |
| 26 | No evaluation feedback display | 🟡 | Judging | Participants can't see judge feedback | Build read-only evaluation view for participants (post-judging) | 4h |
| 27 | No conflict of interest UI | 🟡 | Judging | DB flag exists, no way to declare | Add COI checkbox/reason field in judge evaluation form | 2h |
| 28 | No scoring criteria configuration | 🟡 | Judging | Judges evaluate without defined rubric | Build criteria builder for organizers, display for judges | 2d |
| 29 | No submission diff view | 🟢 | Submissions | `diff_summary` stored but not displayed | Build version comparison view | 1d |

---

## 6. Financial & Escrow Gaps

| # | Title | Severity | Module | Description | Recommendation | Effort |
|---|-------|----------|--------|-------------|----------------|--------|
| 30 | Transaction signing not implemented | 🔴 | Escrow | XDR built but never signed with escrow key | Decrypt key → sign → submit | 4h |
| 31 | No settlement service | 🟠 | Escrow | `settlements` table exists, no service | Build settlement recording on terminal escrow states | 1d |
| 32 | No periodic reconciliation | 🟠 | Escrow | Only reconciles on transition attempts | Add cron job for funded escrows | 4h |
| 33 | No fee accounting | 🟡 | Escrow | Stellar fees not tracked | Add fee estimation and tracking in expected_balance | 4h |
| 34 | No partial refund logic | 🟡 | Escrow | Always refunds full balance | Calculate remaining after confirmed disbursements | 4h |
| 35 | No payout status page (winners) | 🟡 | Prizes | Winners can't see their disbursement status | Build "my prizes" page for recipients | 1d |
| 36 | No claimable balance implementation | 🟢 | Escrow | Design mentions it for held winners | Implement Stellar claimable balances for unverified wallets | 2d |
| 37 | Soroban state query broken | 🟠 | Blockchain | Returns hardcoded zeros | Implement proper ScVal parsing | 4h |

---

## 7. Communication & Notification Gaps

| # | Title | Severity | Module | Description | Recommendation | Effort |
|---|-------|----------|--------|-------------|----------------|--------|
| 38 | No notification inbox page | 🟠 | Notifications | Notifications sent but no reading UI | Build inbox page with mark-read, categories | 1d |
| 39 | No real-time notification badge | 🟡 | Notifications | No visual indicator of unread | Add bell icon with count in nav, realtime subscription | 4h |
| 40 | No email notification preferences | 🟡 | Notifications | All emails sent regardless of preference | Build preference page per category (Req 16.3) | 1d |
| 41 | No digest email scheduling | 🟢 | Notifications | Design mentions hourly digest | Implement cron-based digest aggregation | 1d |
| 42 | No in-app comments | 🟡 | Communication | `/api/comments/` exists but no UI | Build comment thread on submissions | 1d |

---

## 8. Compliance & Legal Gaps

| # | Title | Severity | Module | Description | Recommendation | Effort |
|---|-------|----------|--------|-------------|----------------|--------|
| 43 | No Terms of Service page | 🟠 | Legal | Link exists, page doesn't | Write ToS and create page | 1d |
| 44 | No Privacy Policy page | 🟠 | Legal | Link exists, page doesn't | Write privacy policy and create page | 1d |
| 45 | No cookie consent banner | 🟡 | Legal | Session cookies used without consent | Add cookie consent with preference storage | 4h |
| 46 | No GDPR data export | 🟡 | Legal | No user data export mechanism | Build "download my data" endpoint | 1d |
| 47 | No account deletion | 🟡 | Legal | `deactivated_at` exists but no workflow | Build account deletion with data retention handling | 1d |

---

## 9. Infrastructure & Operations Gaps

| # | Title | Severity | Module | Description | Recommendation | Effort |
|---|-------|----------|--------|-------------|----------------|--------|
| 48 | No CI/CD pipeline | 🟠 | DevOps | No automated deployment | Set up GitHub Actions or Vercel CI | 4h |
| 49 | No error tracking | 🟠 | Observability | No Sentry/equivalent | Integrate error tracking service | 2h |
| 50 | No application monitoring | 🟡 | Observability | No APM or metrics | Add Vercel Analytics or custom metrics | 4h |
| 51 | No log aggregation | 🟡 | Observability | `console.error` only | Integrate structured logging service | 4h |
| 52 | No migration rollback scripts | 🟡 | Database | Only 1 down migration exists | Write down migrations for all migrations | 3d |
| 53 | No backup verification | 🟡 | Operations | No DR drill documented | Schedule quarterly restore drills | 2h |

---

## 10. Summary Statistics

| Severity | Count | Estimated Total Effort |
|----------|-------|----------------------|
| 🔴 Critical | 7 | ~2 days |
| 🟠 High | 16 | ~15 days |
| 🟡 Medium | 23 | ~25 days |
| 🟢 Low | 7 | ~10 days |
| **Total** | **53** | **~52 days** |

---

## 11. Priority Roadmap

### Sprint 1 (Week 1): Critical Fixes
Items: 1, 2, 30, 3 (migration fix), 6 (state alignment), transaction boundaries

### Sprint 2 (Weeks 2-3): Core UX Completeness
Items: 7, 8, 9, 14, 38, 39, 43, 44, 48, 49

### Sprint 3 (Weeks 4-5): Financial Hardening
Items: 31, 32, 33, 34, 35, 37, 6 (MFA), plus test coverage push

### Sprint 4 (Weeks 6-7): Platform Polish
Items: 15, 16, 17, 18, 25, 26, 28, 40, 45, 46, 47

### Sprint 5 (Weeks 8-9): Advanced Features
Items: 21, 22, 24, 29, 36, 41, 42, 19, 20

### Sprint 6 (Weeks 10-11): Production Hardening
Items: 50, 51, 52, 53, security audit, load testing, contract audit
