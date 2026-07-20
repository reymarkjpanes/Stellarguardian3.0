import { ValueObject } from "./ValueObject";
import { VALIDATION_SCHEMA } from "../constants/errors";

export const VisibilityType = {
  PUBLIC: "Public",
  PRIVATE: "Private"
} as const;

export type VisibilityTypeValue = typeof VisibilityType[keyof typeof VisibilityType];

interface VisibilityProps {
  value: VisibilityTypeValue;
}

export class Visibility extends ValueObject<VisibilityProps> {
  private constructor(props: VisibilityProps) {
    super(props);
  }

  public get value(): VisibilityTypeValue {
    return this.props.value;
  }

  public get isPublic(): boolean {
    return this.props.value === VisibilityType.PUBLIC;
  }

  public static create(visibility: string): Visibility {
    if (visibility !== VisibilityType.PUBLIC && visibility !== VisibilityType.PRIVATE) {
      throw new Error(VALIDATION_SCHEMA + ": Invalid visibility type");
    }
    return new Visibility({ value: visibility });
  }
}
