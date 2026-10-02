export interface GetNumberingRangeRequest {
  /** NIT of the emitter company without check digit */
  accountCode: string;
  /** NIT of the technological provider (or same emitter NIT if software propio) */
  accountCodeT: string;
  /** UUID of the software registered in DIAN */
  softwareCode: string;
}

export interface NumberingRangeItem {
  resolutionNumber: string;
  resolutionDate?: string;
  prefix?: string;
  fromNumber: number | string;
  toNumber: number | string;
  validDateFrom?: string;
  validDateTo?: string;
  technicalKey?: string;
}

export interface NumberingRangeResponse {
  operationCode?: string;
  operationDescription?: string;
  responseList: NumberingRangeItem[];
  rawXml?: string;
}
