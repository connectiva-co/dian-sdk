import { buildSignedSoapEnvelope } from '../crypto/signer.js';
import { DianNetworkError, DianSoapFaultError } from '../errors/DianError.js';
import { checkSoapFault } from '../soap/parser.js';
import type { DianClientConfig, DianEnvironment, LoadedCertificate } from '../types/config.js';

export const DIAN_ENDPOINTS: Record<DianEnvironment, string> = {
  HABILITACION: 'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc',
  VPFE_HAB: 'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc',
  PRODUCCION: 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc',
  VPFE_PROD: 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc',
};

export class SoapTransport {
  readonly endpointUrl: string;
  private readonly certificate: LoadedCertificate;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: DianClientConfig, certificate: LoadedCertificate) {
    this.endpointUrl = config.customEndpoint ?? DIAN_ENDPOINTS[config.environment] ?? DIAN_ENDPOINTS.HABILITACION;
    this.certificate = certificate;
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.fetchImpl = config.fetch ?? fetch;
  }

  /**
   * Builds WS-Security signed envelope and sends HTTP POST to WCF service
   */
  async send(action: string, bodyContent: string): Promise<string> {
    const signed = buildSignedSoapEnvelope({
      action,
      to: this.endpointUrl,
      bodyContent,
      certificate: this.certificate,
    });

    const headers: Record<string, string> = {
      'Content-Type': `application/soap+xml;charset=UTF-8;action="${action}"`,
      'Accept': 'application/soap+xml, application/xml, text/xml',
      'Accept-Encoding': 'gzip, deflate',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpointUrl, {
        method: 'POST',
        headers,
        body: signed.soapXml,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new DianNetworkError(`Request timed out after ${this.timeoutMs}ms`, err);
      }
      throw new DianNetworkError((err as Error)?.message || 'Failed to connect to DIAN Web Services', err);
    } finally {
      clearTimeout(timeoutId);
    }

    const responseText = await response.text();

    if (!response.ok) {
      // WCF returns 500 when returning a SOAP Fault
      try {
        checkSoapFault(responseText, response.status);
      } catch (faultErr) {
        if (faultErr instanceof DianSoapFaultError) {
          throw faultErr;
        }
      }
      throw new DianNetworkError(`DIAN WCF returned HTTP ${response.status} ${response.statusText}: ${responseText}`);
    }

    return responseText;
  }
}
