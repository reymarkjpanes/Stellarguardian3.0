export interface Command<T = any> {
  type: string;
  payload: T;
}

export interface CommandHandler<TCommand extends Command = Command, TResult = any> {
  execute(command: TCommand, ctx?: any): Promise<TResult>;
}

export class CommandBus {
  private handlers = new Map<string, CommandHandler>();

  public register(commandType: string, handler: CommandHandler): void {
    if (this.handlers.has(commandType)) {
      console.warn(`[CommandBus] Overwriting handler for ${commandType}`);
    }
    this.handlers.set(commandType, handler);
  }

  public async execute<TResult = any>(command: Command, ctx?: any): Promise<TResult> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(`[CommandBus] No handler registered for ${command.type}`);
    }

    // Middleware could go here in the future
    return handler.execute(command, ctx);
  }
}
