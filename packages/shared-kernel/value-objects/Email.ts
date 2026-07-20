import { ValueObject } from "./ValueObject";
import { VALIDATION_SCHEMA } from "../constants/errors";

interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  public get value(): string {
    return this.props.value;
  }

  public static create(email: string): Email {
    if (!email || email.trim().length === 0) {
      throw new Error(VALIDATION_SCHEMA + ": Email cannot be empty");
    }
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email)) {
      throw new Error(VALIDATION_SCHEMA + ": Invalid email format");
    }
    return new Email({ value: email.trim().toLowerCase() });
  }
}
