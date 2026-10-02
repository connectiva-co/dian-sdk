import type { SoapTransport } from '../http/transport.js';
import { parseDianResponse, parseUploadDocumentResponse } from '../soap/parser.js';
import type {
  DianResponse,
  SendBillAsyncRequest,
  SendBillSyncRequest,
  SendTestSetAsyncRequest,
  UploadDocumentResponse,
} from '../types/billing.js';

export class BillingService {
  constructor(private readonly transport: SoapTransport) {}

  /**
   * Synchronous electronic document submission (Invoices, Credit Notes, Debit Notes)
   * Action: http://wcf.dian.colombia/IWcfDianCustomerServices/SendBillSync
   */
  async sendBillSync(request: SendBillSyncRequest): Promise<DianResponse> {
    const action = 'http://wcf.dian.colombia/IWcfDianCustomerServices/SendBillSync';
    const body = `<wcf:SendBillSync xmlns:wcf="http://wcf.dian.colombia"><wcf:fileName>${request.fileName}</wcf:fileName><wcf:contentFile>${request.contentFile}</wcf:contentFile></wcf:SendBillSync>`;

    const responseXml = await this.transport.send(action, body);
    return parseDianResponse(responseXml, 'SendBillSyncResult');
  }

  /**
   * Asynchronous electronic document submission
   * Action: http://wcf.dian.colombia/IWcfDianCustomerServices/SendBillAsync
   */
  async sendBillAsync(request: SendBillAsyncRequest): Promise<UploadDocumentResponse> {
    const action = 'http://wcf.dian.colombia/IWcfDianCustomerServices/SendBillAsync';
    const body = `<wcf:SendBillAsync xmlns:wcf="http://wcf.dian.colombia"><wcf:fileName>${request.fileName}</wcf:fileName><wcf:contentFile>${request.contentFile}</wcf:contentFile></wcf:SendBillAsync>`;

    const responseXml = await this.transport.send(action, body);
    return parseUploadDocumentResponse(responseXml, 'SendBillAsyncResult');
  }

  /**
   * Asynchronous test set submission for software habilitación process
   * Action: http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsync
   */
  async sendTestSetAsync(request: SendTestSetAsyncRequest): Promise<UploadDocumentResponse> {
    const action = 'http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsync';
    const body = `<wcf:SendTestSetAsync xmlns:wcf="http://wcf.dian.colombia"><wcf:fileName>${request.fileName}</wcf:fileName><wcf:contentFile>${request.contentFile}</wcf:contentFile><wcf:testSetId>${request.testSetId}</wcf:testSetId></wcf:SendTestSetAsync>`;

    const responseXml = await this.transport.send(action, body);
    return parseUploadDocumentResponse(responseXml, 'SendTestSetAsyncResult');
  }
}
