export type ApiErrorKind = 'timeout' | 'network' | 'auth' | 'server' | 'parse' | 'config' | 'cancelled';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  constructor(message: string, kind: ApiErrorKind = 'server') {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
  }
}

export class EmptyReplyError extends ApiError {
  constructor(message = 'The server sent an empty reply.') {
    super(message, 'parse');
    this.name = 'EmptyReplyError';
  }
}

export const isEmptyReply = (e: unknown): e is EmptyReplyError => e instanceof EmptyReplyError;

/** A request that was dropped on purpose (the person left the page or changed the filters). Never shown as an error. */
export const isCancelled = (e: unknown): boolean => e instanceof ApiError && e.kind === 'cancelled';
