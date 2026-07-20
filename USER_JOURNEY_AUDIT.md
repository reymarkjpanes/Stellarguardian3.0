# User Journey Audit — StellarGuardian 3.0

## 1. Role-Based Journey Assessment

### Guest (Unauthenticated)

| Journey Step | Page Exists? | Functional? | Notes |
|-------------|-------------|-------------|-------|
| Landing page | ✅ `/` (page.tsx) | ✅ | Landing page exists |
| Event discovery | ✅ `/(public)/discover` | ✅ | Public discovery page exists |
| Event detail (public view) | ⚠️ | ⚠️ | Events page requires auth (non-draft visible via RLS, but route is in `(app)`) |
| Login | ✅ `/(auth)/login` | ✅ | Email/password login |
| Signup | ⚠️ | ❌ | Link exists in login page but `/signup` page not found in routes |
| Forgot password | ⚠️ | ❌ | Link exists but `/forgot-password` page not found |
| Terms/Privacy | ⚠️ | ❌ | Links in footer but pages not found |

**Journey Issues**:
- 🟠 No signup page implementation found
- 🟠 No password recovery flow
- 🟡 Public event viewing requires navigating to the app-authenticated route group

---

### Participant

| Journey Step | Page Exists? | Functional? | Notes |
|-------------|-------------|-------------|-------|
| Registration | ✅ `/events/[id]/register` | ⚠️ | Route exists, implementation unclear |
| Team joining | ✅ `/events/[id]/teams` | ✅ | Teams page exists |
| Submission | ✅ `/events/[id]/submissions` | ✅ | Submissions page exists |
| View winners | ✅ `/events/[id]/winners` | ✅ | Winners page exists |
| Wallet verification | ✅ | ⚠️ | `wallet-connect.tsx` exists in components |
| View prizes/payouts | ⚠️ | ❌ | No "my prizes" page for participants |
| View evaluation feedback | ⚠️ | ❌ | Evaluations visible to judges/organizers only |

**Journey Issues**:
- 🟠 No "my submissions" consolidated view across events
- 🟠 No notification center page
- 🟡 No way for participants to see their evaluation scores/feedback

---

### Organizer

| Journey Step | Page Exists? | Functional? | Notes |
|-------------|-------------|-------------|-------|
| Create event | ✅ `/events/new` | ✅ | Event creation page exists |
| Edit event | ✅ `/events/[id]/edit` | ✅ | Edit page exists |
| Manage members | ✅ `/events/[id]/members` | ✅ | Members page exists |
| Manage teams | ✅ `/events/[id]/teams` | ✅ | |
| View submissions | ✅ `/events/[id]/submissions` | ✅ | |
| Manage judging | ✅ `/events/[id]/judging` | ✅ | |
| Manage prizes | ✅ `/events/[id]/prizes` | ✅ | |
| Fund escrow | ✅ `/events/[id]/escrow` | ✅ | Escrow page exists |
| View disputes | ✅ `/events/[id]/disputes` | ✅ | Disputes page exists |
| Transition event state | ⚠️ | ⚠️ | `event-lifecycle-stepper.tsx` exists but only renders 5 states |
| Dashboard with action items | ✅ `/dashboard` | ✅ | `OrganizerActionCenter` component |
| View analytics | ❌ | ❌ | No analytics page found |
| Export audit logs | ❌ | ❌ | No export UI |

**Journey Issues**:
- 🟠 Event lifecycle stepper shows 5 states but DB has 18 — confusing UX
- 🟠 No analytics dashboard
- 🟡 No bulk operations (approve all members, assign judges in batch)

---

### Judge

| Journey Step | Page Exists? | Functional? | Notes |
|-------------|-------------|-------------|-------|
| View assigned submissions | ✅ `/events/[id]/judge` | ✅ | Judge-specific route exists |
| Submit evaluations | ⚠️ | ⚠️ | Judging domain has services but UI unclear |
| View scoring criteria | ⚠️ | ❌ | No criteria display found |
| Flag conflict of interest | ⚠️ | ⚠️ | DB column exists but no UI control found |
| View judging progress | ⚠️ | ❌ | No progress indicator for judges |

**Journey Issues**:
- 🟠 Judge experience is underdeveloped compared to organizer
- 🟡 No clear indicator of remaining submissions to evaluate

---

### Sponsor

| Journey Step | Page Exists? | Functional? | Notes |
|-------------|-------------|-------------|-------|
| View sponsored events | ❌ | ❌ | No sponsor dashboard |
| Add sponsorship | ⚠️ | ⚠️ | API route exists (`/api/events/[id]/sponsors`) |
| Track milestone delivery | ⚠️ | ⚠️ | API route exists (`/api/events/[id]/milestones`) |
| View disbursement status | ❌ | ❌ | No sponsor-specific view |

**Journey Issues**:
- 🔴 Sponsor role has almost no dedicated UI
- 🟠 Milestone tracking exists in API but no page

---

### Workspace Owner/Admin

| Journey Step | Page Exists? | Functional? | Notes |
|-------------|-------------|-------------|-------|
| Create workspace | ⚠️ | ❌ | Quick action link exists but no `/workspaces/new` page found |
| Manage workspace members | ⚠️ | ❌ | No workspace management page found |
| Configure workspace settings | ✅ `/settings` | ⚠️ | Settings page exists |
| View workspace events | ⚠️ | ❌ | No workspace-scoped event list |
| Manage billing | ❌ | ❌ | Schema exists but no UI |
| Configure white-label | ❌ | ❌ | Schema exists but no UI |
| Feature flags | ❌ | ❌ | Schema exists but no UI |

**Journey Issues**:
- 🔴 Multi-workspace architecture designed but almost no workspace management UI exists
- 🟠 No workspace selection flow when user belongs to multiple workspaces
- 🟠 No member invitation flow for workspaces

---

## 2. Navigation Assessment

### App Navigation (`app-nav.tsx`)

- ✅ User profile display with wallet status
- ✅ Navigation to dashboard, events, discover
- ✅ Command palette (`Cmd+K`) for quick navigation
- ⚠️ No workspace switcher (critical for multi-workspace)
- ⚠️ No notification badge/bell
- ⚠️ No breadcrumbs on nested event pages

---

## 3. Empty States / Loading States / Error States

| Component | Empty State | Loading State | Error State |
|-----------|------------|---------------|-------------|
| Dashboard | ✅ "Get started by joining an event" | ⚠️ No skeleton | ❌ None |
| Event list | ⚠️ Implicit (empty filter results) | ⚠️ No skeleton | ❌ None |
| Teams page | ❌ Unknown | ❌ Unknown | ❌ Unknown |
| Submissions | ❌ Unknown | ❌ Unknown | ❌ Unknown |
| Escrow page | ❌ Unknown | ❌ Unknown | ❌ Unknown |

**Assessment**: UI states are severely under-implemented. A financial platform MUST have clear error/loading/empty states for every critical view.

---

## 4. Broken / Missing Journeys

| Issue | Severity | Description |
|-------|----------|-------------|
| No signup flow | 🔴 Critical | Users cannot register |
| No workspace creation | 🟠 High | First-time users cannot create a workspace |
| No invitation acceptance | 🟠 High | Invited users have no flow to accept |
| No password reset | 🟠 High | Users cannot recover accounts |
| No notification inbox | 🟠 High | Notifications sent but nowhere to read them |
| No sponsor dashboard | 🟠 High | Sponsors have no dedicated view |
| No participant prize view | 🟡 Medium | Winners can't see their payout status |
| No workspace switcher | 🟡 Medium | Multi-workspace users stuck |
| No account settings | 🟡 Medium | Cannot update profile, change password |
| No email verification | 🟡 Medium | No confirmation flow after signup |

---

## 5. Recommendations

### Critical (Blocks User Adoption)

1. **Implement signup page** — Email/password registration with email verification
2. **Implement workspace creation** — First-time onboarding flow
3. **Add notification inbox** — Page listing all notifications with mark-as-read

### High Priority

4. **Build sponsor dashboard** — Event list, milestone tracking, payout status
5. **Add workspace management** — Member invite, role management, settings
6. **Implement password reset** — Supabase Auth supports this; just need the UI
7. **Add breadcrumb navigation** — Critical for nested event sub-pages

### Medium Priority

8. **Build participant prize/payout view** — Show disbursement status per winner
9. **Add workspace switcher** — Dropdown in nav for multi-workspace users
10. **Implement all empty/loading/error states** — Every page needs all three
