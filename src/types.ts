export interface User {
  id: number;
  name: string;
  email: string;
  walletAddress?: string;
  isAdmin: number;
}

export interface Event {
  id: number;
  hostUserId: number;
  title: string;
  description: string;
  category: string;
  format: string;
  visibility: string;
  registrationDeadline: string;
  startDate: string;
  endDate: string;
  prizeTotal: number;
  prizeBreakdown: string;
  state: import('./lib/eventStatus').EventState; // 'Draft' | 'Funded' | 'Published' | 'Registration Open' | 'Registration Closed' | 'In Progress' | 'Judging' | 'Completed' | 'Cancelled' | 'Archived'
  fundingTxRef: string;
  tags: string;
  rulesPublished: number;
  timelineConfirmed: number;
  capacity?: number;
  teamSizeMax?: number;
  bannerUrl?: string;
  contactEmail?: string;
  
  host: User;
  myMembership?: {
    role: string;
    status: string;
  };
  myRsvp?: string;
  stats: {
    judgesCount: number;
    participantsCount: number;
    rsvps?: {
      going: number;
      maybe: number;
      notGoing: number;
    };
  };
  trustChecklist: {
    prizeFunded: boolean;
    organizerVerified: boolean;
    judgesAssigned: boolean;
    rulesPublished: boolean;
    timelineConfirmed: boolean;
  };
  
  members: EventMembership[];
  invitations: Invitation[];
  transactions: Transaction[];
  teams: Team[];
  sponsors: Sponsor[];
  milestones: Milestone[];
  announcements: Announcement[];
  submissions: Submission[];
  evaluations: Evaluation[];
  winners: Winner[];
}

export interface EventMembership {
  id: number;
  role: string; // 'Participant' | 'Judge' | 'Mentor'
  status: string; // 'pending' | 'accepted' | 'rejected'
  userId: number;
  name: string;
  email: string;
  walletAddress?: string;
  rsvpStatus?: string;
}

export interface Invitation {
  id: number;
  email: string;
  token: string;
  status: string;
  kind: string;
  expiresAt: string;
  invitedByName: string;
}

export interface Transaction {
  id: number;
  eventId: number;
  type: string;
  amountXLM: number;
  fromWallet: string;
  toWallet?: string;
  txRef: string;
  timestamp: string;
}

export interface Team {
  id: number;
  eventId: number;
  name: string;
  createdAt: string;
}

export interface Sponsor {
  id: number;
  eventId: number;
  name: string;
  logo: string;
  tier: string;
}

export interface Milestone {
  id: number;
  eventId: number;
  title: string;
  date: string;
  description: string;
}

export interface Announcement {
  id: number;
  eventId: number;
  title: string;
  body: string;
  createdAt: string;
}

export interface Submission {
  id: number;
  eventId: number;
  teamId?: number;
  userId: number;
  title: string;
  description: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  
  submitterName: string;
  teamName?: string;
  evaluationCount?: number;
  averageScore?: number;
}

export interface Evaluation {
  id: number;
  submissionId: number;
  judgeId: number;
  score: number;
  feedback: string;
  createdAt: string;
  judgeName: string;
}

export interface Winner {
  id: number;
  eventId: number;
  submissionId: number;
  rank: number;
  prizeAmount: number;
  
  submissionTitle: string;
  submissionUrl: string;
  teamName?: string;
  submitterName: string;
}
