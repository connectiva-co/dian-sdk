export type DianEnvironment = 'HABILITACION' | 'PRODUCCION' | 'VPFE_HAB' | 'VPFE_PROD';

export interface CertificateConfig {
  /** PKCS#12 (.p12 or .pfx) certificate file Buffer or Base64 string */
  pkcs12: Buffer | string;
  /** Password for the PKCS#12 certificate */
  password: string;
}

export interface RawKeysConfig {
  /** RSA Private Key in PEM format */
  privateKeyPem: string;
  /** X.509 Certificate in Base64 DER format (without BEGIN/END header) */
  certificateBase64: string;
}

export interface DianClientConfig {
  /** DIAN environment (HABILITACION for sandbox / testing or PRODUCCION for live) */
  environment: DianEnvironment;
  /** Certificate credentials (.p12/.pfx buffer and password, or raw PEM/Base64) */
  certificate: CertificateConfig | RawKeysConfig;
  /** Custom endpoint URL if overriding standard DIAN WCF service URL */
  customEndpoint?: string;
  /** Request timeout in milliseconds (default: 30000ms) */
  timeoutMs?: number;
  /** Custom fetch implementation (defaults to global fetch) */
  fetch?: typeof fetch;
}

export interface LoadedCertificate {
  privateKeyPem: string;
  certificateBase64: string;
}
