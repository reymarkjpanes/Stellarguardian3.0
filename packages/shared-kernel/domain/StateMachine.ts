export interface Transition<TState, TContext> {
  from: TState;
  to: TState;
  guards?: Array<(ctx: TContext) => boolean | Promise<boolean>>;
  actions?: Array<(ctx: TContext) => void | Promise<void>>;
}

export class StateMachine<TState, TContext> {
  private currentState: TState;
  private readonly transitions: Map<TState, Transition<TState, TContext>[]> = new Map();

  constructor(initialState: TState, transitions: Transition<TState, TContext>[]) {
    this.currentState = initialState;

    for (const t of transitions) {
      if (!this.transitions.has(t.from)) {
        this.transitions.set(t.from, []);
      }
      this.transitions.get(t.from)!.push(t);
    }
  }

  public get state(): TState {
    return this.currentState;
  }

  public async transition(to: TState, context: TContext): Promise<boolean> {
    const possibleTransitions = this.transitions.get(this.currentState) || [];
    const transition = possibleTransitions.find(t => t.to === to);

    if (!transition) {
      return false; // Invalid transition
    }

    if (transition.guards) {
      for (const guard of transition.guards) {
        const passed = await guard(context);
        if (!passed) {
          return false;
        }
      }
    }

    // Update state
    this.currentState = to;

    if (transition.actions) {
      for (const action of transition.actions) {
        await action(context);
      }
    }

    return true;
  }

  public canTransition(to: TState): boolean {
    const possibleTransitions = this.transitions.get(this.currentState) || [];
    return possibleTransitions.some(t => t.to === to);
  }
}
