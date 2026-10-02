import type { SoapTransport } from '../http/transport.js';
import { parseNumberingRangeResponse } from '../soap/parser.js';
import type { GetNumberingRangeRequest, NumberingRangeResponse } from '../types/numbering.js';

export class NumberingService {
  constructor(private readonly transport: SoapTransport) {}

  /**
   * Retrieves authorized numbering ranges and technical key (Clave Técnica) from DIAN
   * Action: http://wcf.dian.colombia/IWcfDianCustomerServices/GetNumberingRange
   */
  async getNumberingRange(request: GetNumberingRangeRequest): Promise<NumberingRangeResponse> {
    const action = 'http://wcf.dian.colombia/IWcfDianCustomerServices/GetNumberingRange';
    const body = `<wcf:GetNumberingRange xmlns:wcf="http://wcf.dian.colombia"><wcf:accountCode>${request.accountCode}</wcf:accountCode><wcf:accountCodeT>${request.accountCodeT}</wcf:accountCodeT><wcf:softwareCode>${request.softwareCode}</wcf:softwareCode></wcf:GetNumberingRange>`;

    const responseXml = await this.transport.send(action, body);
    return parseNumberingRangeResponse(responseXml);
  }
}
