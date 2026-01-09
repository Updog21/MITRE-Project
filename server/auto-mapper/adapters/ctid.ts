import { ResourceAdapter, NormalizedMapping, AnalyticMapping, DataComponentMapping } from '../types';

const CTID_BASE_URL = 'https://raw.githubusercontent.com/center-for-threat-informed-defense/mappings-explorer/main/src/data';

interface CTIDMapping {
  capability_id: string;
  capability_description: string;
  mapping_type: string;
  attack_object_id: string;
  attack_object_name: string;
  score_category?: string;
}

export class CTIDAdapter implements ResourceAdapter {
  name: 'ctid' = 'ctid';

  isApplicable(_productType: string, _platforms: string[]): boolean {
    return true;
  }

  async fetchMappings(productName: string, vendor: string): Promise<NormalizedMapping | null> {
    const mappingFiles = await this.findMappingFiles(productName, vendor);
    
    if (mappingFiles.length === 0) {
      return null;
    }

    const allMappings: CTIDMapping[] = [];
    for (const file of mappingFiles) {
      const mappings = await this.fetchMappingFile(file);
      allMappings.push(...mappings);
    }

    if (allMappings.length === 0) {
      return null;
    }

    return this.normalizeMappings(productName, allMappings);
  }

  private async findMappingFiles(productName: string, vendor: string): Promise<string[]> {
    const searchTerms = [
      productName.toLowerCase().replace(/\s+/g, '-'),
      productName.toLowerCase().replace(/\s+/g, '_'),
      vendor.toLowerCase(),
    ];

    const knownMappings: Record<string, string[]> = {
      'azure': ['security-stack/Azure/azure-security-center.json', 'security-stack/Azure/azure-sentinel.json'],
      'aws': ['security-stack/AWS/aws-cloudtrail.json', 'security-stack/AWS/aws-guardduty.json'],
      'defender': ['security-stack/M365/microsoft-defender.json'],
      'crowdstrike': ['security-stack/CrowdStrike/crowdstrike-falcon.json'],
      'google': ['security-stack/GCP/google-cloud-security.json'],
    };

    for (const term of searchTerms) {
      for (const [key, files] of Object.entries(knownMappings)) {
        if (term.includes(key)) {
          return files;
        }
      }
    }

    return [];
  }

  private async fetchMappingFile(filePath: string): Promise<CTIDMapping[]> {
    try {
      const response = await fetch(`${CTID_BASE_URL}/${filePath}`);
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return Array.isArray(data) ? data : (data.mappings || []);
    } catch {
      return [];
    }
  }

  private normalizeMappings(productId: string, mappings: CTIDMapping[]): NormalizedMapping {
    const techniqueIds = new Set<string>();
    const dataComponents: DataComponentMapping[] = [];
    const analytics: AnalyticMapping[] = [];

    for (const mapping of mappings) {
      if (mapping.attack_object_id?.startsWith('T')) {
        techniqueIds.add(mapping.attack_object_id);
        
        analytics.push({
          id: `CTID-${mapping.capability_id}-${mapping.attack_object_id}`,
          name: `${mapping.capability_description} → ${mapping.attack_object_name}`,
          description: `Maps ${mapping.mapping_type} to ATT&CK technique ${mapping.attack_object_id}`,
          source: 'ctid',
        });
      }
    }

    const confidence = Math.min(100, mappings.length * 5);

    return {
      productId,
      source: 'ctid',
      confidence,
      detectionStrategies: Array.from(techniqueIds).map(t => `DS-${t}`),
      analytics,
      dataComponents,
      rawData: mappings,
    };
  }
}
