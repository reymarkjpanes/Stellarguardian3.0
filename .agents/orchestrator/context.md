# Context & State — Stellar Guardian 3.0

## Environment Context
- Project: Stellar Guardian 3.0
- Workspace Root: `c:\Users\Reymark\Documents\Antigravity-Project\stellar-guardian-3.0`
- User Request File: `c:\Users\Reymark\Documents\Antigravity-Project\stellar-guardian-3.0\.agents\ORIGINAL_REQUEST.md`

## Requirements Summary
- **R1**: Dedicated `/onboarding` page blocking access to `/dashboard` until display name & default workspace are provided.
- **R2**: Explicit state transition buttons on Event Dashboard to progress event lifecycle, with confirmation dialogs for irreversible actions.
- **R3**: Automated background job or API webhook endpoint watching for `PrizeApproved` state to automatically trigger on-chain payout via Soroban contracts.

## Architecture Notes (To be updated by Explorers)
- Stack: Next.js/React (Web), Supabase/PostgreSQL (DB/Auth/Webhooks), Soroban Smart Contracts (Stellar blockchain).
