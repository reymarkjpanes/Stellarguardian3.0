import { CaptainPolicy } from "./policies/CaptainPolicy";
import { TeamCapacityPolicy } from "./policies/TeamCapacityPolicy";
import { TeamStatePolicy } from "./policies/TeamStatePolicy";
import { StateTransitionError, BusinessRuleViolation, CapacityExceededError } from "@/src/shared/kernel/errors/DomainError";

export interface TeamMember {
  eventMemberId: string;
  role: "Captain" | "Member";
  status: "Active" | "Left" | "Removed";
}

export interface TeamProps {
  id: string;
  eventId: string;
  name: string;
  status: string;
  visibility: string;
  maxMembers: number;
  members: TeamMember[];
  version: number;
}

export class Team {
  constructor(public readonly props: TeamProps) {}

  get id(): string {
    return this.props.id;
  }

  get status(): string {
    return this.props.status;
  }

  get version(): number {
    return this.props.version;
  }

  get eventId() { return this.props.eventId; }
  get activeMembers() { return this.props.members.filter(m => m.status === "Active"); }
  
  get captainId(): string | undefined {
    return this.activeMembers.find(m => m.role === "Captain")?.eventMemberId;
  }

  isCaptain(eventMemberId: string): boolean {
    return this.captainId === eventMemberId;
  }

  acceptJoinRequest(targetMemberId: string, actorId: string): void {
    if (!this.isCaptain(actorId)) {
      throw new BusinessRuleViolation("Only the captain can accept join requests.", "TEAM_CAPTAIN_REQUIRED");
    }

    if (!TeamCapacityPolicy.canJoin(this.activeMembers.length, this.props.maxMembers)) {
      throw new CapacityExceededError("The team is already at maximum capacity.");
    }

    if (!TeamStatePolicy.canEdit(this.props.status)) {
      throw new StateTransitionError("Cannot accept members in current team state.");
    }
  }

  transferCaptain(targetMemberId: string, actorId: string): void {
    const targetMember = this.activeMembers.find(m => m.eventMemberId === targetMemberId);
    
    if (!targetMember || !CaptainPolicy.canTransfer(this.captainId!, actorId, targetMember.status)) {
      throw new BusinessRuleViolation("Cannot transfer captain role to this member.", "TEAM_CAPTAIN_TRANSFER_REQUIRED");
    }
    
    if (!TeamStatePolicy.canEdit(this.props.status)) {
      throw new StateTransitionError("Cannot transfer captain in current team state.");
    }
  }
}
