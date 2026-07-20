import { Registry } from "./Registry";
import { AggregateRoot } from "../interfaces/AggregateRoot";

export const AggregateRegistry = new Registry<typeof AggregateRoot<any>>();
