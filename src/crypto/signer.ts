import crypto from 'node:crypto';
import type { LoadedCertificate } from '../types/config.js';
import { canonicalizeExclusive } from './c14n.js';

export interface SoapSignOptions {
  action: string;
  to: string;
  bodyContent: string;
  certificate: LoadedCertificate;
  now?: Date;
}

export interface SignedSoapEnvelope {
  soapXml: string;
  action: string;
  to: string;
}

export const XMLNS = {
  SOAP_12: 'http://www.w3.org/2003/05/soap-envelope',
  WSA: 'http://www.w3.org/2005/08/addressing',
  WSSE: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd',
  WSU: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd',
  DS: 'http://www.w3.org/2000/09/xmldsig#',
  C14N_EXC: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  SHA256: 'http://www.w3.org/2001/04/xmlenc#sha256',
  RSA_SHA256: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  X509_TOKEN: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3',
  BASE64_BINARY: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary',
  DIAN_WCF: 'http://wcf.dian.colombia',
} as const;

/**
 * Builds and signs a SOAP 1.2 WCF message with WS-Security and XMLDSig
 */
export function buildSignedSoapEnvelope(options: SoapSignOptions): SignedSoapEnvelope {
  const { action, to, bodyContent, certificate } = options;
  const now = options.now ?? new Date();

  // Format timestamps exactly as DIAN requires: UTC with .000Z
  const createdStr = now.toISOString().replace(/\.\d{3}Z$/, '.000Z');
  const expiresDate = new Date(now.getTime() + 5 * 60 * 1000);
  const expiresStr = expiresDate.toISOString().replace(/\.\d{3}Z$/, '.000Z');

  // 1. Construct Timestamp fragment with explicit namespaces for canonicalization
  const timestampXml = `<wsu:Timestamp xmlns:wsu="${XMLNS.WSU}" wsu:Id="_0"><wsu:Created>${createdStr}</wsu:Created><wsu:Expires>${expiresStr}</wsu:Expires></wsu:Timestamp>`;
  const c14nTimestamp = canonicalizeExclusive(timestampXml);
  const timestampDigest = crypto.createHash('sha256').update(c14nTimestamp, 'utf8').digest('base64');

  // 2. Construct Body fragment with wsu:Id="id-body"
  const bodyXml = `<soap:Body xmlns:soap="${XMLNS.SOAP_12}" xmlns:wsu="${XMLNS.WSU}" wsu:Id="id-body">${bodyContent}</soap:Body>`;
  const c14nBody = canonicalizeExclusive(bodyXml);
  const bodyDigest = crypto.createHash('sha256').update(c14nBody, 'utf8').digest('base64');

  // 3. Construct SignedInfo fragment
  const signedInfoXml = `<ds:SignedInfo xmlns:ds="${XMLNS.DS}"><ds:CanonicalizationMethod Algorithm="${XMLNS.C14N_EXC}"></ds:CanonicalizationMethod><ds:SignatureMethod Algorithm="${XMLNS.RSA_SHA256}"></ds:SignatureMethod><ds:Reference URI="#_0"><ds:Transforms><ds:Transform Algorithm="${XMLNS.C14N_EXC}"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="${XMLNS.SHA256}"></ds:DigestMethod><ds:DigestValue>${timestampDigest}</ds:DigestValue></ds:Reference><ds:Reference URI="#id-body"><ds:Transforms><ds:Transform Algorithm="${XMLNS.C14N_EXC}"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="${XMLNS.SHA256}"></ds:DigestMethod><ds:DigestValue>${bodyDigest}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;

  const c14nSignedInfo = canonicalizeExclusive(signedInfoXml);

  // 4. Sign SignedInfo with RSA private key
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(c14nSignedInfo, 'utf8');
  const signatureValue = signer.sign(certificate.privateKeyPem, 'base64');

  // 5. Construct full SOAP 1.2 Envelope
  const soapEnvelope = `<soap:Envelope xmlns:soap="${XMLNS.SOAP_12}" xmlns:wsa="${XMLNS.WSA}" xmlns:wcf="${XMLNS.DIAN_WCF}"><soap:Header><wsa:Action soap:mustUnderstand="1">${action}</wsa:Action><wsa:To soap:mustUnderstand="1">${to}</wsa:To><wsse:Security soap:mustUnderstand="1" xmlns:wsse="${XMLNS.WSSE}" xmlns:wsu="${XMLNS.WSU}"><wsu:Timestamp wsu:Id="_0"><wsu:Created>${createdStr}</wsu:Created><wsu:Expires>${expiresStr}</wsu:Expires></wsu:Timestamp><wsse:BinarySecurityToken wsu:Id="CertId-1" ValueType="${XMLNS.X509_TOKEN}" EncodingType="${XMLNS.BASE64_BINARY}">${certificate.certificateBase64}</wsse:BinarySecurityToken><ds:Signature xmlns:ds="${XMLNS.DS}"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="${XMLNS.C14N_EXC}"></ds:CanonicalizationMethod><ds:SignatureMethod Algorithm="${XMLNS.RSA_SHA256}"></ds:SignatureMethod><ds:Reference URI="#_0"><ds:Transforms><ds:Transform Algorithm="${XMLNS.C14N_EXC}"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="${XMLNS.SHA256}"></ds:DigestMethod><ds:DigestValue>${timestampDigest}</ds:DigestValue></ds:Reference><ds:Reference URI="#id-body"><ds:Transforms><ds:Transform Algorithm="${XMLNS.C14N_EXC}"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="${XMLNS.SHA256}"></ds:DigestMethod><ds:DigestValue>${bodyDigest}</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>${signatureValue}</ds:SignatureValue><ds:KeyInfo><wsse:SecurityTokenReference><wsse:Reference URI="#CertId-1" ValueType="${XMLNS.X509_TOKEN}"></wsse:Reference></wsse:SecurityTokenReference></ds:KeyInfo></ds:Signature></wsse:Security></soap:Header><soap:Body wsu:Id="id-body" xmlns:wsu="${XMLNS.WSU}">${bodyContent}</soap:Body></soap:Envelope>`;

  return {
    soapXml: soapEnvelope,
    action,
    to,
  };
}
