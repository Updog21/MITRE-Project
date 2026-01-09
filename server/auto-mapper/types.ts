export interface NormalizedMapping {
  productId: string;
  source: ResourceType;
  confidence: number;
  detectionStrategies: string[];
  analytics: AnalyticMapping[];
  dataComponents: DataComponentMapping[];
  rawData: unknown;
  techniqueSources?: Record<string, ResourceType[]>;
}

export interface AnalyticMapping {
  id: string;
  name: string;
  description?: string;
  logSources?: string[];
  query?: string;
  source?: ResourceType;
}

export interface DataComponentMapping {
  id: string;
  name: string;
  dataSource?: string;
  eventIds?: string[];
}

export type ResourceType = 'ctid' | 'sigma' | 'elastic' | 'splunk' | 'mitre_stix';

export interface ResourceAdapter {
  name: ResourceType;
  fetchMappings(productName: string, vendor: string): Promise<NormalizedMapping | null>;
  isApplicable(productType: string, platforms: string[]): boolean;
}

export const RESOURCE_PRIORITY: Record<string, ResourceType[]> = {
  cloud: ['ctid', 'splunk', 'sigma', 'mitre_stix'],
  network: ['sigma', 'splunk', 'ctid', 'mitre_stix'],
  endpoint: ['elastic', 'sigma', 'splunk', 'ctid', 'mitre_stix'],
  siem: ['splunk', 'sigma', 'elastic', 'ctid', 'mitre_stix'],
  identity: ['ctid', 'sigma', 'splunk', 'mitre_stix'],
  database: ['splunk', 'sigma', 'elastic', 'mitre_stix'],
  web: ['sigma', 'splunk', 'elastic', 'mitre_stix'],
  abstract: ['mitre_stix', 'ctid', 'splunk', 'sigma'],
  default: ['ctid', 'sigma', 'elastic', 'splunk', 'mitre_stix'],
};
