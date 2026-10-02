import { loadCertificate } from './crypto/certificate.js';
import { SoapTransport } from './http/transport.js';
import {
  AcquirerService,
  BillingService,
  EventsService,
  NominaService,
  NumberingService,
  StatusService,
} from './services/index.js';
import type { DianClientConfig, LoadedCertificate } from './types/config.js';

export class DianClient {
  readonly transport: SoapTransport;
  readonly certificate: LoadedCertificate;
  readonly acquirer: AcquirerService;
  readonly billing: BillingService;
  readonly numbering: NumberingService;
  readonly status: StatusService;
  readonly nomina: NominaService;
  readonly events: EventsService;

  constructor(config: DianClientConfig) {
    this.certificate = loadCertificate(config.certificate);
    this.transport = new SoapTransport(config, this.certificate);
    this.acquirer = new AcquirerService(this.transport);
    this.billing = new BillingService(this.transport);
    this.numbering = new NumberingService(this.transport);
    this.status = new StatusService(this.transport);
    this.nomina = new NominaService(this.transport);
    this.events = new EventsService(this.transport);
  }
}

// Alias for SDK convenience
export const DianSDK = DianClient;
