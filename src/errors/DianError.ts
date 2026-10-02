export class DianError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DianError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface SoapFaultDetail {
  code?: string;
  subcode?: string;
  reason?: string;
  detail?: string;
  action?: string;
}

export class DianSoapFaultError extends DianError {
  readonly fault: SoapFaultDetail;
  readonly rawXml?: string;
  readonly statusCode: number;

  constructor(fault: SoapFaultDetail, statusCode = 500, rawXml?: string) {
    const reasonText = fault.reason || fault.detail || fault.code || 'SOAP Fault occurred';
    super(`DIAN SOAP Fault: ${reasonText}`);
    this.name = 'DianSoapFaultError';
    this.fault = fault;
    this.statusCode = statusCode;
    this.rawXml = rawXml;
  }
}

export class DianSecurityError extends DianError {
  constructor(message: string) {
    super(`DIAN Security/Certificate Error: ${message}`);
    this.name = 'DianSecurityError';
  }
}

export class DianValidationError extends DianError {
  readonly errors: string[];
  readonly statusCode?: string;

  constructor(message: string, errors: string[] = [], statusCode?: string) {
    super(message);
    this.name = 'DianValidationError';
    this.errors = errors;
    this.statusCode = statusCode;
  }
}

export class DianNetworkError extends DianError {
  readonly cause?: unknown;

  constructor(message = 'Network error occurred connecting to DIAN WCF services', cause?: unknown) {
    super(message);
    this.name = 'DianNetworkError';
    this.cause = cause;
  }
}
