import { StateMachine, Transition } from "@packages/shared-kernel/domain/StateMachine";
import { TeamStatus, TeamStatusType } from "@packages/shared-kernel/constants/statuses";

export interface TeamContext {
  teamId: string;
  memberCount: number;
}

export const teamTransitions: Transition<TeamStatusType, TeamContext>[] = [
  {
    from: TeamStatus.DRAFT,
    to: TeamStatus.RECRUITING,
    guards: [
      (ctx) => ctx.memberCount > 0
    ]
  },
  {
    from: TeamStatus.RECRUITING,
    to: TeamStatus.READY,
    guards: [
      (ctx) => ctx.memberCount >= 2 // Assuming minimum 2 members for Ready
    ]
  },
  {
    from: TeamStatus.READY,
    to: TeamStatus.LOCKED
  },
  {
    from: TeamStatus.DRAFT,
    to: TeamStatus.ARCHIVED
  },
  {
    from: TeamStatus.RECRUITING,
    to: TeamStatus.ARCHIVED
  },
  {
    from: TeamStatus.READY,
    to: TeamStatus.ARCHIVED
  },
  {
    from: TeamStatus.LOCKED,
    to: TeamStatus.ARCHIVED
  }
];

export function createTeamStateMachine(initialState: TeamStatusType): StateMachine<TeamStatusType, TeamContext> {
  return new StateMachine(initialState, teamTransitions);
}
