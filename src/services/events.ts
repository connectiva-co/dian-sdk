import type { SoapTransport } from '../http/transport.js';
import { parseDianResponse } from '../soap/parser.js';
import type { SendEventRequest, SendEventResponse } from '../types/events.js';

export class EventsService {
  constructor(private readonly transport: SoapTransport) {}

  /**
   * Submits electronic events / RADIAN ApplicationResponse
   * Action: http://wcf.dian.colombia/IWcfDianCustomerServices/SendEventUpdateStatus
   */
  async sendEvent(request: SendEventRequest): Promise<SendEventResponse> {
    const action = 'http://wcf.dian.colombia/IWcfDianCustomerServices/SendEventUpdateStatus';
    const body = `<wcf:SendEventUpdateStatus xmlns:wcf="http://wcf.dian.colombia"><wcf:contentFile>${request.contentFile}</wcf:contentFile></wcf:SendEventUpdateStatus>`;

    const responseXml = await this.transport.send(action, body);
    return parseDianResponse(responseXml, 'SendEventUpdateStatusResult');
  }
}
