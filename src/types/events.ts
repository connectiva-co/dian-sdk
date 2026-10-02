import type { DianResponse } from './billing.js';

export interface SendEventRequest {
  contentFile: string;
}

export type SendEventResponse = DianResponse;
