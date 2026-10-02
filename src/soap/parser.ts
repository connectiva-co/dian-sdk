import { DianSoapFaultError, type SoapFaultDetail } from '../errors/DianError.js';
import type { GetAcquirerResponse } from '../types/acquirer.js';
import type { DianResponse, UploadDocumentResponse } from '../types/billing.js';
import type { NumberingRangeItem, NumberingRangeResponse } from '../types/numbering.js';

/**
 * Extracts inner text of a tag matching localName
 */
export function extractTagValue(xml: string, localName: string): string | undefined {
  const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${localName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${localName}>`, 'i');
  const match = xml.match(regex);
  if (match && match[1] !== undefined) {
    return match[1].trim();
  }
  return undefined;
}

/**
 * Extracts all matching tag values as an array of strings
 */
export function extractAllTagValues(xml: string, localName: string): string[] {
  const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${localName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${localName}>`, 'gi');
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    if (match[1] !== undefined) {
      results.push(match[1].trim());
    }
  }
  return results;
}

/**
 * Checks for and parses SOAP 1.2 / SOAP 1.1 Fault
 */
export function checkSoapFault(xml: string, httpStatus = 200): void {
  if (!xml.includes('Fault') && !xml.includes(':Fault>')) {
    return;
  }

  const faultCode = extractTagValue(xml, 'Value') || extractTagValue(xml, 'faultcode') || extractTagValue(xml, 'Code');
  const faultSubcode = extractTagValue(xml, 'Subcode');
  const faultReason = extractTagValue(xml, 'Text') || extractTagValue(xml, 'faultstring') || extractTagValue(xml, 'Reason');
  const faultDetail = extractTagValue(xml, 'Detail') || extractTagValue(xml, 'detail');

  const fault: SoapFaultDetail = {
    code: faultCode,
    subcode: faultSubcode,
    reason: faultReason,
    detail: faultDetail,
  };

  throw new DianSoapFaultError(fault, httpStatus, xml);
}

/**
 * Parses GetAcquirer SOAP response
 */
export function parseGetAcquirerResponse(xml: string): GetAcquirerResponse {
  checkSoapFault(xml);

  const acquirerXml = extractTagValue(xml, 'GetAcquirerResult') || extractTagValue(xml, 'AcquirerResponse') || xml;

  const identificationType = extractTagValue(acquirerXml, 'IdentificationType');
  const identificationNumber = extractTagValue(acquirerXml, 'IdentificationNumber');
  const name = extractTagValue(acquirerXml, 'Name');
  const email = extractTagValue(acquirerXml, 'Email');
  const statusCode = extractTagValue(acquirerXml, 'StatusCode');
  const statusMessage = extractTagValue(acquirerXml, 'StatusMessage');

  return {
    identificationType,
    identificationNumber,
    name,
    businessName: name,
    email,
    statusCode,
    statusMessage,
    rawXml: xml,
  };
}

/**
 * Parses generic DianResponse (used by SendBillSync, GetStatus, etc.)
 */
export function parseDianResponse(xml: string, resultTag = 'SendBillSyncResult'): DianResponse {
  checkSoapFault(xml);

  const containerXml = extractTagValue(xml, resultTag) || extractTagValue(xml, 'DianResponse') || xml;

  const isValidStr = extractTagValue(containerXml, 'IsValid');
  const isValid = isValidStr ? isValidStr.toLowerCase() === 'true' : false;
  const statusCode = extractTagValue(containerXml, 'StatusCode') || '';
  const statusMessage = extractTagValue(containerXml, 'StatusMessage');
  const statusDescription = extractTagValue(containerXml, 'StatusDescription');
  const xmlBase64Bytes = extractTagValue(containerXml, 'XmlBase64Bytes');
  const docState = extractTagValue(containerXml, 'DocState');

  // Parse error messages if present
  const errorMessage = extractAllTagValues(containerXml, 'string');

  return {
    isValid,
    statusCode,
    statusMessage,
    statusDescription,
    xmlBase64Bytes,
    xmlBytes: xmlBase64Bytes ? Buffer.from(xmlBase64Bytes, 'base64') : undefined,
    errorMessage: errorMessage.length > 0 ? errorMessage : undefined,
    docState,
    rawXml: xml,
  };
}

/**
 * Parses SendTestSetAsync / SendBillAsync response
 */
export function parseUploadDocumentResponse(xml: string, resultTag = 'SendTestSetAsyncResult'): UploadDocumentResponse {
  checkSoapFault(xml);

  const containerXml = extractTagValue(xml, resultTag) || extractTagValue(xml, 'UploadDocumentResponse') || xml;
  const zipKey = extractTagValue(containerXml, 'ZipKey') || extractTagValue(containerXml, 'TrackId') || '';

  return {
    zipKey,
    rawXml: xml,
  };
}

/**
 * Parses GetNumberingRange response
 */
export function parseNumberingRangeResponse(xml: string): NumberingRangeResponse {
  checkSoapFault(xml);

  const containerXml = extractTagValue(xml, 'GetNumberingRangeResult') || extractTagValue(xml, 'NumberingRangeResponse') || xml;
  const operationCode = extractTagValue(containerXml, 'OperationCode');
  const operationDescription = extractTagValue(containerXml, 'OperationDescription');

  const items: NumberingRangeItem[] = [];

  // Match all <NumberingRangeResponse> or <b:NumberingRangeResponse> items in list
  const itemRegex = /<(?:[a-zA-Z0-9_]+:)?NumberingRangeResponseItem(?:[^>]*)>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?NumberingRangeResponseItem>|<(?:[a-zA-Z0-9_]+:)?NumberingRangeResponse(?:[^>]*)>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?NumberingRangeResponse>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(containerXml)) !== null) {
    const itemXml = match[1] || match[2] || '';
    if (itemXml.includes('ResolutionNumber')) {
      items.push({
        resolutionNumber: extractTagValue(itemXml, 'ResolutionNumber') || '',
        resolutionDate: extractTagValue(itemXml, 'ResolutionDate'),
        prefix: extractTagValue(itemXml, 'Prefix'),
        fromNumber: extractTagValue(itemXml, 'FromNumber') || 0,
        toNumber: extractTagValue(itemXml, 'ToNumber') || 0,
        validDateFrom: extractTagValue(itemXml, 'ValidDateFrom'),
        validDateTo: extractTagValue(itemXml, 'ValidDateTo'),
        technicalKey: extractTagValue(itemXml, 'TechnicalKey'),
      });
    }
  }

  // Fallback if list structure is direct
  if (items.length === 0 && containerXml.includes('ResolutionNumber')) {
    items.push({
      resolutionNumber: extractTagValue(containerXml, 'ResolutionNumber') || '',
      resolutionDate: extractTagValue(containerXml, 'ResolutionDate'),
      prefix: extractTagValue(containerXml, 'Prefix'),
      fromNumber: extractTagValue(containerXml, 'FromNumber') || 0,
      toNumber: extractTagValue(containerXml, 'ToNumber') || 0,
      validDateFrom: extractTagValue(containerXml, 'ValidDateFrom'),
      validDateTo: extractTagValue(containerXml, 'ValidDateTo'),
      technicalKey: extractTagValue(containerXml, 'TechnicalKey'),
    });
  }

  return {
    operationCode,
    operationDescription,
    responseList: items,
    rawXml: xml,
  };
}
