import { ValueObject } from "./ValueObject";
import { VALIDATION_SCHEMA } from "../constants/errors";

interface TeamNameProps {
  value: string;
}

export class TeamName extends ValueObject<TeamNameProps> {
  private constructor(props: TeamNameProps) {
    super(props);
  }

  public get value(): string {
    return this.props.value;
  }

  public static create(name: string): TeamName {
    if (!name || name.trim().length === 0) {
      throw new Error(VALIDATION_SCHEMA + ": Team name cannot be empty");
    }
    if (name.length > 50) {
      throw new Error(VALIDATION_SCHEMA + ": Team name cannot exceed 50 characters");
    }
    return new TeamName({ value: name.trim() });
  }
}
