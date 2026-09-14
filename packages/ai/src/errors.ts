/** A configuration or provider problem with a user-facing message and hint. */
export class AIProviderError extends Error {
  override readonly name = 'AIProviderError';
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
  }
}
