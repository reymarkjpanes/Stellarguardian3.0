import { ValueObject } from "./ValueObject";
import { Role, Roles } from "../constants/roles";
import { VALIDATION_SCHEMA } from "../constants/errors";

interface MemberRoleProps {
  value: Role;
}

export class MemberRole extends ValueObject<MemberRoleProps> {
  private constructor(props: MemberRoleProps) {
    super(props);
  }

  public get value(): Role {
    return this.props.value;
  }

  public get isCaptain(): boolean {
    return this.props.value === Roles.CAPTAIN;
  }

  public get isParticipant(): boolean {
    return this.props.value === Roles.PARTICIPANT;
  }

  public static create(role: string): MemberRole {
    const validRoles = Object.values(Roles);
    if (!validRoles.includes(role as Role)) {
      throw new Error(VALIDATION_SCHEMA + ": Invalid member role");
    }
    return new MemberRole({ value: role as Role });
  }
}
