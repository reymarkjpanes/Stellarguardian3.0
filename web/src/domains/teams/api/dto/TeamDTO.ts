export interface TeamListDTO {
  id: string;
  name: string;
  tagline?: string;
  logoUrl?: string;
  status: string;
  visibility: string;
  lookingForMembers: boolean;
  memberCount: number;
  maxMembers: number;
  captainName?: string;
  createdAt: string;
}

export interface TeamDetailDTO extends TeamListDTO {
  description?: string;
  bannerUrl?: string;
  members: {
    eventMemberId: string;
    role: string;
    name: string;
    avatarUrl?: string;
    joinedAt: string;
  }[];
  preferredSkills?: string[];
}
