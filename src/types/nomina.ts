import type { DianResponse } from './billing.js';

export interface SendNominaSyncRequest {
  fileName: string;
  contentFile: string;
}

export type SendNominaSyncResponse = DianResponse;
