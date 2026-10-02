import crypto from 'node:crypto';

export interface CufeCalculationParams {
  /** Invoice number with prefix (e.g., SETP1, FEV100) */
  invoiceNumber: string;
  /** Issue date in format yyyy-MM-dd */
  issueDate: string;
  /** Issue time with timezone (e.g., 14:30:00-05:00) */
  issueTime: string;
  /** Invoice subtotal before taxes with 2 decimals (e.g., 100000.00) */
  subtotal: number | string;
  /** Code for Tax 01 (IVA) or '01' */
  tax1Code?: string;
  /** Value of Tax 01 with 2 decimals */
  tax1Value?: number | string;
  /** Code for Tax 04 (Impoconsumo) or '04' */
  tax2Code?: string;
  /** Value of Tax 04 with 2 decimals */
  tax2Value?: number | string;
  /** Code for Tax 03 (ICA) or '03' */
  tax3Code?: string;
  /** Value of Tax 03 with 2 decimals */
  tax3Value?: number | string;
  /** Total invoice payable amount with 2 decimals */
  totalAmount: number | string;
  /** NIT of the issuer without check digit */
  issuerNit: string;
  /** Document number / NIT of the acquirer */
  acquirerDocNumber: string;
  /** Technical Key provided by DIAN (Clave técnica) */
  technicalKey: string;
  /** Environment type: '1' for Producción, '2' for Habilitación / Pruebas */
  environmentType: '1' | '2';
}

export interface CudeCalculationParams {
  /** Document number with prefix (e.g., NC100, DS50) */
  documentNumber: string;
  /** Issue date in format yyyy-MM-dd */
  issueDate: string;
  /** Issue time with timezone (e.g., 14:30:00-05:00) */
  issueTime: string;
  /** Document subtotal before taxes with 2 decimals */
  subtotal: number | string;
  tax1Code?: string;
  tax1Value?: number | string;
  tax2Code?: string;
  tax2Value?: number | string;
  tax3Code?: string;
  tax3Value?: number | string;
  /** Total amount */
  totalAmount: number | string;
  /** NIT of the issuer without check digit */
  issuerNit: string;
  /** Document number of the acquirer or provider */
  acquirerDocNumber: string;
  /** Software PIN registered in DIAN */
  softwarePin: string;
  /** Environment type: '1' for Producción, '2' for Habilitación / Pruebas */
  environmentType: '1' | '2';
}

function formatDecimal(val: number | string | undefined): string {
  if (val === undefined || val === null || val === '') {
    return '0.00';
  }
  const num = typeof val === 'number' ? val : Number.parseFloat(val);
  return Number.isNaN(num) ? '0.00' : num.toFixed(2);
}

/**
 * Calculates CUFE (Código Único de Factura Electrónica) using SHA-384
 * Formula: SHA-384(NumFac + FecFac + HorFac + ValFac + CodImp1 + ValImp1 + CodImp2 + ValImp2 + CodImp3 + ValImp3 + ValTot + NitOfe + NumAdq + ClTec + TipoAmb)
 */
export function calculateCufe(params: CufeCalculationParams): string {
  const numFac = params.invoiceNumber;
  const fecFac = params.issueDate;
  const horFac = params.issueTime;
  const valFac = formatDecimal(params.subtotal);
  const codImp1 = params.tax1Code ?? '01';
  const valImp1 = formatDecimal(params.tax1Value);
  const codImp2 = params.tax2Code ?? '04';
  const valImp2 = formatDecimal(params.tax2Value);
  const codImp3 = params.tax3Code ?? '03';
  const valImp3 = formatDecimal(params.tax3Value);
  const valTot = formatDecimal(params.totalAmount);
  const nitOfe = params.issuerNit;
  const numAdq = params.acquirerDocNumber;
  const clTec = params.technicalKey;
  const tipoAmb = params.environmentType;

  const chain = `${numFac}${fecFac}${horFac}${valFac}${codImp1}${valImp1}${codImp2}${valImp2}${codImp3}${valImp3}${valTot}${nitOfe}${numAdq}${clTec}${tipoAmb}`;
  return crypto.createHash('sha384').update(chain, 'utf8').digest('hex');
}

/**
 * Calculates CUDE (Código Único de Documento Electrónico) using SHA-384
 * Formula: SHA-384(NumDoc + FecDoc + HorDoc + ValDoc + CodImp1 + ValImp1 + CodImp2 + ValImp2 + CodImp3 + ValImp3 + ValTot + NitOfe + NumAdq + PinSoftware + TipoAmb)
 */
export function calculateCude(params: CudeCalculationParams): string {
  const numDoc = params.documentNumber;
  const fecDoc = params.issueDate;
  const horDoc = params.issueTime;
  const valDoc = formatDecimal(params.subtotal);
  const codImp1 = params.tax1Code ?? '01';
  const valImp1 = formatDecimal(params.tax1Value);
  const codImp2 = params.tax2Code ?? '04';
  const valImp2 = formatDecimal(params.tax2Value);
  const codImp3 = params.tax3Code ?? '03';
  const valImp3 = formatDecimal(params.tax3Value);
  const valTot = formatDecimal(params.totalAmount);
  const nitOfe = params.issuerNit;
  const numAdq = params.acquirerDocNumber;
  const pinSoftware = params.softwarePin;
  const tipoAmb = params.environmentType;

  const chain = `${numDoc}${fecDoc}${horDoc}${valDoc}${codImp1}${valImp1}${codImp2}${valImp2}${codImp3}${valImp3}${valTot}${nitOfe}${numAdq}${pinSoftware}${tipoAmb}`;
  return crypto.createHash('sha384').update(chain, 'utf8').digest('hex');
}

/**
 * Calculates SoftwareSecurityCode using SHA-384(SoftwareId + Pin + InvoiceNumber)
 */
export function calculateSoftwareSecurityCode(softwareId: string, pin: string, invoiceNumber: string): string {
  return crypto.createHash('sha384').update(`${softwareId}${pin}${invoiceNumber}`, 'utf8').digest('hex');
}
