export type ApiErrorKind = 'timeout' | 'network' | 'auth' | 'server' | 'parse' | 'config';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  constructor(message: string, kind: ApiErrorKind = 'server') {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
  }
}
