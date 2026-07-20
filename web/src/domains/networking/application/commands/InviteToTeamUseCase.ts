import { RequestContext } from "@/src/shared/kernel/context/RequestContext";
import { CommandHandler } from "@packages/shared-kernel/domain/CommandBus";

export interface InviteToTeamCommand {
  type: 'InviteToTeam';
  payload: {
    eventId: string;
    teamId: string;
    targetUserId: string;
  };
}

export class InviteToTeamUseCase implements CommandHandler<InviteToTeamCommand, void> {
  async execute(command: InviteToTeamCommand, ctx: RequestContext): Promise<void> {
    // 1. Verify caller has InviteMember permission (is Captain/Organizer)
    // 2. Verify targetUserId is in the event workspace and available for team
    // 3. Verify no existing pending invite
    // 4. Create the invitation in DB
    // 5. Emit 'InvitationSent' event
  }
}
