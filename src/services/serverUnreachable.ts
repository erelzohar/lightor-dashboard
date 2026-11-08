/**
 * LT-614: the error code of a request that got no answer from the server (no
 * internet, a timeout, the server down), as opposed to the server's refusal.
 * Its own module, so the auth context reads it even where tests mock authApi.
 */
export const SERVER_UNREACHABLE = 'SERVER_UNREACHABLE';

export const isServerUnreachable = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === SERVER_UNREACHABLE;
