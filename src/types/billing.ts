export interface SendBillSyncRequest {
  /** Name of the zip file: ws + NIT (10 digits) + DocCode (2 digits) + Consecutivo (8-10 chars) + .zip */
  fileName: string;
  /** Base64-encoded zip file containing the signed UBL 2.1 XML document */
  contentFile: string;
}

export interface SendBillAsyncRequest {
  fileName: string;
  contentFile: string;
}

export interface SendTestSetAsyncRequest {
  fileName: string;
  contentFile: string;
  /** UUID of the TestSet assigned by DIAN in the Habilitación portal */
  testSetId: string;
}

export interface DianResponse {
  isValid: boolean;
  statusCode: string;
  statusMessage?: string;
  statusDescription?: string;
  xmlBase64Bytes?: string;
  xmlBytes?: Buffer;
  errorMessage?: string[];
  docState?: string;
  rawXml?: string;
}

export interface UploadDocumentResponse {
  zipKey: string;
  rawXml?: string;
}
