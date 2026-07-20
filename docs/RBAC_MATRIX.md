# Stellar Guardian 3.0 - RBAC Matrix

Role-Based Access Control is enforced hierarchically. Workspaces govern Events, Events govern Teams.

## Workspace Roles

| Permission | Admin | Organizer | Member |
| :--- | :---: | :---: | :---: |
| Manage Workspace Settings | ✅ | ❌ | ❌ |
| Create Events | ✅ | ✅ | ❌ |
| Invite Workspace Members | ✅ | ✅ | ❌ |
| View Workspace Activity | ✅ | ✅ | ✅ |
| Manage Billing/Escrow | ✅ | ❌ | ❌ |

## Event Roles

| Permission | Admin / Organizer (from Workspace) | Participant | Mentor | Judge | Sponsor |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Edit Event Details | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Event Members | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create Teams | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Submissions (Draft) | ✅ | Own Team | ❌ | ❌ | ❌ |
| View Submissions (Submitted) | ✅ | All | All | All | All |
| Evaluate Submissions | ❌ | ❌ | ❌ | ✅ | ❌ |
| Manage Prize Payouts | ✅ | ❌ | ❌ | ❌ | ❌ |

## Team Roles

| Permission | Leader | Member | Event Organizer |
| :--- | :---: | :---: | :---: |
| Edit Team Profile | ✅ | ❌ | ✅ |
| Invite Members to Team | ✅ | ❌ | ❌ |
| Remove Members from Team | ✅ | ❌ | ✅ |
| Submit Project | ✅ | ❌ | ❌ |
| Delete Team | ✅ | ❌ | ✅ |

*Note: Workspace Admins and Organizers inherit all management capabilities within the events they host.*
