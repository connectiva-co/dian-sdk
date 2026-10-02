import type { DianResponse } from './billing.js';

export interface GetStatusRequest {
  /** UUID of the document (ZipKey) or CUFE/CUDE hash */
  trackId: string;
}

export interface GetStatusZipRequest {
  trackId: string;
}

export type GetStatusResponse = DianResponse;

export interface GetStatusZipResponse extends DianResponse {
  dianResponseList?: DianResponse[];
}
