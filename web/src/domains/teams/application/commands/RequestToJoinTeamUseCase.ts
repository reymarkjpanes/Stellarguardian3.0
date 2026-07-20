import { RequestContext } from "@/src/shared/kernel/context/RequestContext";
import { CommandHandler } from "@packages/shared-kernel/domain/CommandBus";

export interface RequestToJoinTeamCommand {
  type: 'RequestToJoinTeam';
  payload: {
    eventId: string;
    teamId: string;
    userId: string;
    message?: string;
  };
}

export class RequestToJoinTeamUseCase implements CommandHandler<RequestToJoinTeamCommand, void> {
  async execute(command: RequestToJoinTeamCommand, ctx: RequestContext): Promise<void> {
    // 1. Verify user is not already in a team for this event
    // 2. Verify team is 'Recruiting'
    // 3. Verify no existing pending request
    // 4. Create the join request in DB
    // 5. Emit 'JoinRequestCreated' event
  }
}
