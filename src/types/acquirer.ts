export type IdentificationType =
  | '11' // Registro civil
  | '12' // Tarjeta de identidad
  | '13' // Cédula de ciudadanía
  | '21' // Tarjeta de extranjería
  | '22' // Cédula de extranjería
  | '31' // NIT
  | '41' // Pasaporte
  | '42' // Documento de identificación extranjero
  | '47' // PEP (Permiso Especial de Permanencia)
  | '48' // PPT (Permiso por Protección Temporal)
  | '50' // NIT de otro país
  | '91' // NUIP
  | (string & {});

export interface GetAcquirerRequest {
  /** Document type code (e.g., '13' for CC, '31' for NIT) */
  identificationType: IdentificationType;
  /** Document number without dots, dashes, or check digit */
  identificationNumber: string;
}

export interface GetAcquirerResponse {
  identificationType?: string;
  identificationNumber?: string;
  name?: string;
  businessName?: string;
  email?: string;
  statusCode?: string;
  statusMessage?: string;
  rawXml?: string;
}
