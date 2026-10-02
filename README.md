# @connectiva-co/dian-sdk

SDK oficial y fuertemente tipificado en TypeScript para la integración con los Web Services WCF de la **DIAN** (Dirección de Impuestos y Aduanas Nacionales de Colombia).

## Características

- 🔐 **WS-Security y XMLDSig nativo**: Firma digital automatizada con certificado digital (`.p12` o `.pfx`) y Exclusive XML Canonicalization 1.0 (`C14N`).
- 📡 **SOAP 1.2 WCF Compliant**: Envío síncrono y asíncrono con formato estricto de timestamps (`.000Z`) y WS-Addressing.
- 📐 **100% tipificado en TypeScript**: Interfaces completas para cada operación, petición y respuesta de la DIAN.
- ⚡ **Utilidades DIAN integradas**:
  - Cálculo de **CUFE** y **CUDE** (`SHA-384`).
  - Cálculo de **SoftwareSecurityCode** (`SHA-384`).
  - Compresión y empaquetado ZIP automático.
  - Extracción y lectura automática de `ApplicationResponse.xml` desde `XmlBase64Bytes`.
- 📦 **Dual ESM & CommonJS**: Soporte completo para Node.js, Bun, Deno, Next.js y Edge.

---

## Instalación

```bash
npm install @connectiva-co/dian-sdk
# o directo desde GitHub:
npm install github:connectiva-co/dian-sdk
```

---

## Inicialización

```typescript
import fs from 'node:fs';
import { DianClient } from '@connectiva-co/dian-sdk';

const dian = new DianClient({
  environment: 'HABILITACION', // 'HABILITACION' o 'PRODUCCION'
  certificate: {
    pkcs12: fs.readFileSync('./certificado.p12'),
    password: process.env.CERTIFICATE_PASSWORD!,
  },
  timeoutMs: 30000,
});
```

---

## Operaciones Soportadas

### 1. Consultar Adquirente (`GetAcquirer`)

Consulta los datos registrados del comprador para autocompletar la factura electrónica:

```typescript
const acquirer = await dian.acquirer.getAcquirer({
  identificationType: '31', // NIT
  identificationNumber: '900123456',
});

console.log(acquirer.name, acquirer.email);
```

### 2. Enviar Factura / Documento Electrónico Síncrono (`SendBillSync`)

```typescript
import { createZipPackage, extractApplicationResponse } from '@connectiva-co/dian-sdk';

// 1. Empaquetar el XML firmado en ZIP Base64
const xmlFirmado = '<Invoice ...>...</Invoice>';
const contentFile = await createZipPackage(xmlFirmado, 'fv09001234560002600000001.xml');

// 2. Enviar a la DIAN
const response = await dian.billing.sendBillSync({
  fileName: 'ws09001234560002600000001.zip',
  contentFile,
});

if (response.isValid) {
  console.log('Factura Aceptada por la DIAN');
  
  // Extraer el ApplicationResponse firmado por la DIAN
  if (response.xmlBase64Bytes) {
    const appResponseXml = await extractApplicationResponse(response.xmlBase64Bytes);
    console.log('ApplicationResponse DIAN:', appResponseXml);
  }
} else {
  console.error('Errores de validación DIAN:', response.errorMessage);
}
```

### 3. Enviar Set de Pruebas Habilitación (`SendTestSetAsync`)

```typescript
const result = await dian.billing.sendTestSetAsync({
  fileName: 'ws09001234560002600000001.zip',
  contentFile,
  testSetId: 'f0c3d9a1-8e7b-4b1a-9f2c-5e6d7c8b9a0f',
});

console.log('TrackId / ZipKey:', result.zipKey);
```

### 4. Consultar Estado de Documento (`GetStatus` / `GetStatusZip`)

```typescript
const status = await dian.status.getStatus({
  trackId: 'f0c3d9a1-8e7b-4b1a-9f2c-5e6d7c8b9a0f',
});

console.log(`Estado: ${status.docState}, Válido: ${status.isValid}`);
```

### 5. Consultar Rangos de Numeración y Clave Técnica (`GetNumberingRange`)

```typescript
const ranges = await dian.numbering.getNumberingRange({
  accountCode: '900123456',
  accountCodeT: '900123456',
  softwareCode: '6c1a89c4-9a4f-4d98-b80c-7b8c6f1a89c4',
});

for (const r of ranges.responseList) {
  console.log(`Prefijo: ${r.prefix}, Rango: ${r.fromNumber} - ${r.toNumber}`);
  console.log(`Clave Técnica: ${r.technicalKey}`);
}
```

### 6. Cálculo de CUFE y CUDE

```typescript
import { calculateCufe, calculateCude } from '@connectiva-co/dian-sdk';

const cufe = calculateCufe({
  invoiceNumber: 'SETP1',
  issueDate: '2026-10-02',
  issueTime: '15:30:00-05:00',
  subtotal: 100000.00,
  tax1Value: 19000.00, // IVA
  totalAmount: 119000.00,
  issuerNit: '900123456',
  acquirerDocNumber: '109048401',
  technicalKey: 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c',
  environmentType: '2', // '1' Producción, '2' Habilitación
});
```

---

## Licencia

MIT © Connectiva
