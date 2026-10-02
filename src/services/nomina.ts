import type { SoapTransport } from '../http/transport.js';
import { parseDianResponse } from '../soap/parser.js';
import type { SendNominaSyncRequest, SendNominaSyncResponse } from '../types/nomina.js';

export class NominaService {
  constructor(private readonly transport: SoapTransport) {}

  /**
   * Synchronous electronic payroll submission (Nómina Electrónica)
   * Action: http://wcf.dian.colombia/IWcfDianCustomerServices/SendNominaSync
   */
  async sendNominaSync(request: SendNominaSyncRequest): Promise<SendNominaSyncResponse> {
    const action = 'http://wcf.dian.colombia/IWcfDianCustomerServices/SendNominaSync';
    const body = `<wcf:SendNominaSync xmlns:wcf="http://wcf.dian.colombia"><wcf:fileName>${request.fileName}</wcf:fileName><wcf:contentFile>${request.contentFile}</wcf:contentFile></wcf:SendNominaSync>`;

    const responseXml = await this.transport.send(action, body);
    return parseDianResponse(responseXml, 'SendNominaSyncResult');
  }
}
