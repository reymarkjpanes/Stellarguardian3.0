import { AggregateRoot } from "./AggregateRoot";
import { Specification } from "../domain/SpecificationRegistry";

export interface Repository<T extends AggregateRoot<any>> {
  save(aggregate: T, ctx?: any): Promise<void>;
  findById(id: string, ctx?: any): Promise<T | null>;
  delete?(id: string, ctx?: any): Promise<void>;
  
  // Optional but recommended for specification pattern support
  match?(specification: Specification<T>, ctx?: any): Promise<T[]>;
}
