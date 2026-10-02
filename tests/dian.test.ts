import crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  calculateCude,
  calculateCufe,
  calculateSoftwareSecurityCode,
  canonicalizeExclusive,
  createZipPackage,
  DianClient,
  DianSoapFaultError,
  extractApplicationResponse,
} from '../src/index.js';

// Generate in-memory RSA keypair for cryptographic testing
function generateTestKeys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
  const certificateBase64 = Buffer.from(publicKeyDer).toString('base64');

  return { privateKeyPem, certificateBase64, publicKey };
}

describe('Exclusive XML Canonicalization 1.0 (C14N)', () => {
  it('canonicalizes attributes in sorted order and formats tags correctly', () => {
    const input = `<wsu:Timestamp xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" wsu:Id="_0">
      <wsu:Created>2026-10-02T20:00:00.000Z</wsu:Created>
      <wsu:Expires>2026-10-02T20:05:00.000Z</wsu:Expires>
    </wsu:Timestamp>`;

    const c14n = canonicalizeExclusive(input);
    expect(c14n).toContain('<wsu:Timestamp');
    expect(c14n).toContain('wsu:Id="_0"');
    expect(c14n).toContain('<wsu:Created>2026-10-02T20:00:00.000Z</wsu:Created>');
    expect(c14n).toContain('<wsu:Expires>2026-10-02T20:05:00.000Z</wsu:Expires>');
    expect(c14n).not.toContain('\r');
  });
});

describe('WS-Security and XMLDSig Signing Engine', () => {
  it('builds a valid signed SOAP 1.2 envelope and validates signature', async () => {
    const { privateKeyPem, certificateBase64, publicKey } = generateTestKeys();

    let sentBody = '';
    let sentHeaders: Record<string, string> = {};

    const mockFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sentBody = init?.body as string;
      sentHeaders = init?.headers as Record<string, string>;

      return new Response(
        `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:b="http://schemas.datacontract.org/2004/07/DianResponse">
          <soap:Body>
            <GetAcquirerResponse xmlns="http://wcf.dian.colombia">
              <GetAcquirerResult>
                <b:IdentificationType>31</b:IdentificationType>
                <b:IdentificationNumber>3199991</b:IdentificationNumber>
                <b:Name>Nombre NIT 1</b:Name>
                <b:Email>Mail_NIT_1@mail.com</b:Email>
                <b:StatusCode>00</b:StatusCode>
                <b:StatusMessage>Consulta exitosa</b:StatusMessage>
              </GetAcquirerResult>
            </GetAcquirerResponse>
          </soap:Body>
        </soap:Envelope>`,
        { status: 200, headers: { 'Content-Type': 'application/soap+xml;charset=UTF-8' } },
      );
    });

    const client = new DianClient({
      environment: 'HABILITACION',
      certificate: {
        privateKeyPem,
        certificateBase64,
      },
      fetch: mockFetch as unknown as typeof fetch,
    });

    const response = await client.acquirer.getAcquirer({
      identificationType: '31',
      identificationNumber: '3199991',
    });

    expect(response.statusCode).toBe('00');
    expect(response.name).toBe('Nombre NIT 1');
    expect(response.email).toBe('Mail_NIT_1@mail.com');

    // Verify SOAP 1.2 Headers & Envelope structure
    expect(sentHeaders['Content-Type']).toContain('action="http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer"');
    expect(sentBody).toContain('<wsa:Action soap:mustUnderstand="1">http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer</wsa:Action>');
    expect(sentBody).toContain('<wsse:BinarySecurityToken wsu:Id="CertId-1"');
    expect(sentBody).toContain('<ds:Signature');
    expect(sentBody).toContain('<ds:Reference URI="#_0">');
    expect(sentBody).toContain('<ds:Reference URI="#id-body">');

    // Extract and verify signature
    const sigMatch = sentBody.match(/<ds:SignatureValue>([\s\S]*?)<\/ds:SignatureValue>/);
    expect(sigMatch).toBeDefined();
    const sigValue = sigMatch![1].trim();

    const signedInfoMatch = sentBody.match(/<ds:SignedInfo[\s\S]*?<\/ds:SignedInfo>/);
    expect(signedInfoMatch).toBeDefined();
    let signedInfoRaw = signedInfoMatch![0];
    if (!signedInfoRaw.includes('xmlns:ds')) {
      signedInfoRaw = signedInfoRaw.replace('<ds:SignedInfo', '<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"');
    }
    const c14nSignedInfo = canonicalizeExclusive(signedInfoRaw);

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(c14nSignedInfo, 'utf8');
    const isValid = verifier.verify(publicKey, sigValue, 'base64');
    expect(isValid).toBe(true);
  });

  it('handles SOAP 1.2 Fault gracefully with DianSoapFaultError', async () => {
    const { privateKeyPem, certificateBase64 } = generateTestKeys();

    const mockFetch = vi.fn(async () => {
      return new Response(
        `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
          <soap:Body>
            <soap:Fault>
              <soap:Code><soap:Value>soap:Sender</soap:Value></soap:Code>
              <soap:Reason><soap:Text xml:lang="es">El certificado digital no es válido o ha expirado</soap:Text></soap:Reason>
              <soap:Detail>Error en firma WS-Security</soap:Detail>
            </soap:Fault>
          </soap:Body>
        </soap:Envelope>`,
        { status: 500, headers: { 'Content-Type': 'application/soap+xml;charset=UTF-8' } },
      );
    });

    const client = new DianClient({
      environment: 'HABILITACION',
      certificate: { privateKeyPem, certificateBase64 },
      fetch: mockFetch as unknown as typeof fetch,
    });

    await expect(
      client.billing.sendBillSync({
        fileName: 'ws09001234560002600000001.zip',
        contentFile: 'UEsDBBQAAAA...',
      }),
    ).rejects.toThrow(DianSoapFaultError);
  });
});

describe('Numbering Range & Status Services', () => {
  it('retrieves numbering range and technical key', async () => {
    const { privateKeyPem, certificateBase64 } = generateTestKeys();

    const mockFetch = vi.fn(async () => {
      return new Response(
        `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:b="http://schemas.datacontract.org/2004/07/DianResponse">
          <soap:Body>
            <GetNumberingRangeResponse xmlns="http://wcf.dian.colombia">
              <GetNumberingRangeResult>
                <b:OperationCode>100</b:OperationCode>
                <b:OperationDescription>Consulta exitosa</b:OperationDescription>
                <b:ResponseList>
                  <b:NumberingRangeResponse>
                    <b:ResolutionNumber>18760000001</b:ResolutionNumber>
                    <b:ResolutionDate>2026-01-15</b:ResolutionDate>
                    <b:Prefix>SETP</b:Prefix>
                    <b:FromNumber>1</b:FromNumber>
                    <b:ToNumber>5000</b:ToNumber>
                    <b:ValidDateFrom>2026-01-15</b:ValidDateFrom>
                    <b:ValidDateTo>2027-01-15</b:ValidDateTo>
                    <b:TechnicalKey>fc8eac422eba16e22ffd8c6f94b3f40a6e38162c</b:TechnicalKey>
                  </b:NumberingRangeResponse>
                </b:ResponseList>
              </GetNumberingRangeResult>
            </GetNumberingRangeResponse>
          </soap:Body>
        </soap:Envelope>`,
        { status: 200, headers: { 'Content-Type': 'application/soap+xml' } },
      );
    });

    const client = new DianClient({
      environment: 'HABILITACION',
      certificate: { privateKeyPem, certificateBase64 },
      fetch: mockFetch as unknown as typeof fetch,
    });

    const result = await client.numbering.getNumberingRange({
      accountCode: '900123456',
      accountCodeT: '900123456',
      softwareCode: '6c1a89c4-9a4f-4d98-b80c-7b8c6f1a89c4',
    });

    expect(result.responseList.length).toBe(1);
    expect(result.responseList[0].prefix).toBe('SETP');
    expect(result.responseList[0].technicalKey).toBe('fc8eac422eba16e22ffd8c6f94b3f40a6e38162c');
  });

  it('queries document status by trackId', async () => {
    const { privateKeyPem, certificateBase64 } = generateTestKeys();

    const mockFetch = vi.fn(async () => {
      return new Response(
        `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:b="http://schemas.datacontract.org/2004/07/DianResponse">
          <soap:Body>
            <GetStatusResponse xmlns="http://wcf.dian.colombia">
              <GetStatusResult>
                <b:IsValid>true</b:IsValid>
                <b:StatusCode>00</b:StatusCode>
                <b:StatusDescription>Procesado Correctamente</b:StatusDescription>
                <b:DocState>Aceptado</b:DocState>
              </GetStatusResult>
            </GetStatusResponse>
          </soap:Body>
        </soap:Envelope>`,
        { status: 200, headers: { 'Content-Type': 'application/soap+xml' } },
      );
    });

    const client = new DianClient({
      environment: 'HABILITACION',
      certificate: { privateKeyPem, certificateBase64 },
      fetch: mockFetch as unknown as typeof fetch,
    });

    const status = await client.status.getStatus({ trackId: 'f0c3d9a1-8e7b-4b1a-9f2c-5e6d7c8b9a0f' });
    expect(status.isValid).toBe(true);
    expect(status.statusCode).toBe('00');
    expect(status.statusDescription).toBe('Procesado Correctamente');
  });
});

describe('DIAN Cryptographic Calculations & ZIP Utilities', () => {
  it('calculates CUFE according to SHA-384 formula', () => {
    const cufe = calculateCufe({
      invoiceNumber: 'SETP1',
      issueDate: '2026-10-02',
      issueTime: '15:30:00-05:00',
      subtotal: 100000,
      tax1Value: 19000,
      totalAmount: 119000,
      issuerNit: '900123456',
      acquirerDocNumber: '109048401',
      technicalKey: 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c',
      environmentType: '2',
    });

    expect(cufe).toHaveLength(96); // SHA-384 hex is 96 chars
    expect(typeof cufe).toBe('string');
  });

  it('calculates CUDE and software security code', () => {
    const cude = calculateCude({
      documentNumber: 'NC1',
      issueDate: '2026-10-02',
      issueTime: '15:30:00-05:00',
      subtotal: 50000,
      totalAmount: 50000,
      issuerNit: '900123456',
      acquirerDocNumber: '109048401',
      softwarePin: '12345',
      environmentType: '2',
    });

    expect(cude).toHaveLength(96);

    const secCode = calculateSoftwareSecurityCode('6c1a89c4-9a4f', '12345', 'SETP1');
    expect(secCode).toHaveLength(96);
  });

  it('packages XML to ZIP Base64 and extracts ApplicationResponse XML', async () => {
    const originalXml = '<ApplicationResponse xmlns="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"><ID>AR-1</ID></ApplicationResponse>';
    const zipBase64 = await createZipPackage(originalXml, 'ApplicationResponse.xml');
    expect(typeof zipBase64).toBe('string');

    const extracted = await extractApplicationResponse(zipBase64);
    expect(extracted).toBe(originalXml);
  });
});
