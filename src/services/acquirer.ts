import type { SoapTransport } from '../http/transport.js';
import { parseGetAcquirerResponse } from '../soap/parser.js';
import type { GetAcquirerRequest, GetAcquirerResponse } from '../types/acquirer.js';

export class AcquirerService {
  constructor(private readonly transport: SoapTransport) {}

  /**
   * Queries buyer information from DIAN to autocomplete electronic invoice fields
   * Action: http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer
   */
  async getAcquirer(request: GetAcquirerRequest): Promise<GetAcquirerResponse> {
    const action = 'http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer';
    const body = `<wcf:GetAcquirer xmlns:wcf="http://wcf.dian.colombia"><wcf:identificationType>${request.identificationType}</wcf:identificationType><wcf:identificationNumber>${request.identificationNumber}</wcf:identificationNumber></wcf:GetAcquirer>`;

    const responseXml = await this.transport.send(action, body);
    return parseGetAcquirerResponse(responseXml);
  }
}
