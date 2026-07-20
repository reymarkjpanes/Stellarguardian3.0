export const Roles = {
  // Global
  ADMIN: "Admin",
  ORGANIZER: "Organizer",
  CO_ORGANIZER: "Co-organizer",
  // Evaluation
  JUDGE_LEAD: "Judge Lead",
  JUDGE: "Judge",
  // Mentorship
  MENTOR: "Mentor",
  // Participation
  PARTICIPANT: "Participant",
  CAPTAIN: "Captain",
  MEMBER: "Member",
  // Supporting
  SPONSOR: "Sponsor",
  VOLUNTEER: "Volunteer"
} as const;

export type Role = typeof Roles[keyof typeof Roles];
