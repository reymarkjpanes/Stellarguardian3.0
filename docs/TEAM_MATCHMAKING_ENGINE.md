# Stellar Guardian 3.0 - Team Matchmaking Engine

## Executive Summary
The Matchmaking Engine is one of Stellar Guardian's signature features. It transforms the "Find a Team" experience into a highly intelligent marketplace by scoring compatibility between participants looking for teams and teams looking for members. 

## Recommendation Architecture
The Matchmaking Engine computes a **Compatibility Score** (0-100%) dynamically. Rather than storing this score, the API calculates it on the fly or via materialized views for performance.

### Score Components (The Compatibility Formula)
Compatibility is determined by the weighted sum of six key dimensions:

1. **Skill Match (35%)**
   - Does the user possess skills that complement the team's `team_preferred_skills` and existing roster?
   - Assesses the user's `user_skills` dictionary.

2. **Role Match (25%)**
   - Does the user's primary skill match a role the team is actively recruiting for in `team_roles_needed` or `team_preferred_roles`?
   - Bonus points for matching High Priority roles.

3. **Availability (15%)**
   - Does the user's `availability` state map to the team's needs (e.g. `Looking for Team`)?

4. **Timezone (10%)**
   - How close is the user's `timezone` (from global profile) to the majority of the team's active members? 
   - < 2 hours difference = 100% component score.
   - > 6 hours difference = 0% component score.

5. **Experience (10%)**
   - Does the user's experience level match the team's desired seniority?

6. **Language (5%)**
   - Does the user share a `preferred_language` with the team (`team_preferred_languages`)?

## Implementation Strategy
- **Phase 1 (V1)**: The compatibility score will be a simplified algorithm returning a percentage (e.g., `82% Match`) based purely on exact skill and timezone matches.
- **Phase 2 (V2)**: Introduces AI-driven embeddings to match semantic similarities in bios and project ideas.

## Marketplaces
The engine powers two primary views:
1. **For Participants**: A feed of Teams sorted by Compatibility Score, allowing one-click Join Requests.
2. **For Captains**: A feed of unteamed Participants sorted by how well they fill the Team's open `team_roles_needed`.
