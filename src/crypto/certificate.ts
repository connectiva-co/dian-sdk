import forge from 'node-forge';
import { DianSecurityError } from '../errors/DianError.js';
import type { CertificateConfig, LoadedCertificate, RawKeysConfig } from '../types/config.js';

export function isRawKeysConfig(config: CertificateConfig | RawKeysConfig): config is RawKeysConfig {
  return 'privateKeyPem' in config && 'certificateBase64' in config;
}

/**
 * Loads and extracts RSA private key and X.509 certificate from PKCS#12 (.p12/.pfx) or raw keys
 */
export function loadCertificate(config: CertificateConfig | RawKeysConfig): LoadedCertificate {
  if (isRawKeysConfig(config)) {
    if (!config.privateKeyPem || !config.certificateBase64) {
      throw new DianSecurityError('Raw keys config requires privateKeyPem and certificateBase64');
    }
    const cleanCert = config.certificateBase64
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, '');

    return {
      privateKeyPem: config.privateKeyPem,
      certificateBase64: cleanCert,
    };
  }

  const { pkcs12, password } = config;
  if (!pkcs12) {
    throw new DianSecurityError('PKCS#12 certificate data is required');
  }

  let binaryDer: string;
  if (Buffer.isBuffer(pkcs12)) {
    binaryDer = pkcs12.toString('binary');
  } else if (typeof pkcs12 === 'string') {
    // Check if base64 or binary string
    if (/^[A-Za-z0-9+/=\s]+$/.test(pkcs12.trim()) && pkcs12.length % 4 === 0) {
      binaryDer = Buffer.from(pkcs12.replace(/\s+/g, ''), 'base64').toString('binary');
    } else {
      binaryDer = pkcs12;
    }
  } else {
    throw new DianSecurityError('Invalid PKCS#12 certificate format. Expected Buffer or base64 string');
  }

  try {
    const asn1 = forge.asn1.fromDer(binaryDer);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password || '');

    // Extract private key
    let privateKeyPem: string | null = null;
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0] ||
      p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];

    if (keyBag && keyBag.key) {
      privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);
    }

    // Extract certificate
    let certificateBase64: string | null = null;
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBagList = certBags[forge.pki.oids.certBag];

    if (certBagList && certBagList.length > 0) {
      // Find leaf certificate
      const cert = certBagList[0].cert;
      if (cert) {
        const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
        certificateBase64 = Buffer.from(certDer, 'binary').toString('base64');
      }
    }

    if (!privateKeyPem) {
      throw new DianSecurityError('Failed to extract RSA private key from PKCS#12 certificate');
    }

    if (!certificateBase64) {
      throw new DianSecurityError('Failed to extract X.509 certificate from PKCS#12 file');
    }

    return {
      privateKeyPem,
      certificateBase64,
    };
  } catch (err: unknown) {
    if (err instanceof DianSecurityError) {
      throw err;
    }
    throw new DianSecurityError(`Error parsing PKCS#12 certificate: ${(err as Error)?.message || String(err)}`);
  }
}
