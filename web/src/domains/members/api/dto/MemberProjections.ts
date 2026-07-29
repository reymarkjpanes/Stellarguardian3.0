export interface MemberSkill {
  id: string;
  name: string;
  category: string;
  experienceLevel: string | null;
}

export interface MemberLink {
  id: string;
  type: string; // e.g., 'github', 'portfolio'
  url: string;
}

export interface MemberDirectoryProjection {
  id: string; // The event_members record ID
  userId: string;
  eventId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  
  // Workspace specific
  eventRole: string; 
  membershipStatus: string; // Active, Suspended
  activityStatus: string; // Available for Team, In Team, Judge
  
  // Team Context
  teamId: string | null;
  teamName: string | null;
  teamRecruiting: boolean;
  
  // Profile Data
  timezone: string | null;
  skills: MemberSkill[];
  
  // Profile Completeness
  profileCompletionScore: number;
}

export interface MemberProfileProjection extends MemberDirectoryProjection {
  // Contains more sensitive / detailed data. Only accessible to Organizers or the User themselves.
  email?: string;
  walletAddress?: string;
  links: MemberLink[];
  bio: string | null;
}
