export const EXIT_SUCCESS = 0;
export const EXIT_RUNTIME = 1;
export const EXIT_USAGE = 2;

export class CLIError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "CLIError";
  }
}

export function printError(message: string, hint?: string): never {
  throw new CLIError(message, EXIT_RUNTIME, hint);
}

export function printUsageError(message: string, hint?: string): never {
  throw new CLIError(message, EXIT_USAGE, hint);
}
