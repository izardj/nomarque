/** Shape of every error answer of the API. */
export interface ApiErrorDto {
  statusCode: number;
  /** Stable machine code, e.g. "already_joined", "invalid_token". */
  code: string;
  message: string;
}
