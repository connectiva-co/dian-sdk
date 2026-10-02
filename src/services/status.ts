import type { SoapTransport } from '../http/transport.js';
import { parseDianResponse } from '../soap/parser.js';
import type {
  GetStatusRequest,
  GetStatusResponse,
  GetStatusZipRequest,
  GetStatusZipResponse,
} from '../types/status.js';

export class StatusService {
  constructor(private readonly transport: SoapTransport) {}

  /**
   * Queries processing status of a document by trackId (ZipKey or CUFE/CUDE)
   * Action: http://wcf.dian.colombia/IWcfDianCustomerServices/GetStatus
   */
  async getStatus(request: GetStatusRequest): Promise<GetStatusResponse> {
    const action = 'http://wcf.dian.colombia/IWcfDianCustomerServices/GetStatus';
    const body = `<wcf:GetStatus xmlns:wcf="http://wcf.dian.colombia"><wcf:trackId>${request.trackId}</wcf:trackId></wcf:GetStatus>`;

    const responseXml = await this.transport.send(action, body);
    return parseDianResponse(responseXml, 'GetStatusResult');
  }

  /**
   * Queries processing status and attached document of a document package
   * Action: http://wcf.dian.colombia/IWcfDianCustomerServices/GetStatusZip
   */
  async getStatusZip(request: GetStatusZipRequest): Promise<GetStatusZipResponse> {
    const action = 'http://wcf.dian.colombia/IWcfDianCustomerServices/GetStatusZip';
    const body = `<wcf:GetStatusZip xmlns:wcf="http://wcf.dian.colombia"><wcf:trackId>${request.trackId}</wcf:trackId></wcf:GetStatusZip>`;

    const responseXml = await this.transport.send(action, body);
    return parseDianResponse(responseXml, 'GetStatusZipResult');
  }
}
