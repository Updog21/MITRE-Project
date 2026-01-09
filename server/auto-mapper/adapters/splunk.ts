import { ResourceAdapter, NormalizedMapping, AnalyticMapping, DataComponentMapping } from '../types';

const SPLUNK_API_URL = 'https://api.github.com/repos/splunk/security_content/git/trees/develop?recursive=1';

interface SplunkDetection {
  name: string;
  id: string;
  description?: string;
  search?: string;
  data_source?: string[];
  tags?: {
    mitre_attack_id?: string[];
    product?: string[];
    asset_type?: string[];
  };
}

export class SplunkAdapter implements ResourceAdapter {
  name: 'splunk' = 'splunk';

  isApplicable(_productType: string, _platforms: string[]): boolean {
    return true;
  }

  async fetchMappings(productName: string, vendor: string): Promise<NormalizedMapping | null> {
    const productKeywords = this.getProductKeywords(productName, vendor);
    const detections = await this.searchDetections(productKeywords);

    if (detections.length === 0) {
      return null;
    }

    return this.normalizeMappings(productName, detections);
  }

  private getProductKeywords(productName: string, vendor: string): string[] {
    const keywords: string[] = [];
    
    const productMappings: Record<string, string[]> = {
      'windows': ['windows', 'endpoint'],
      'linux': ['linux', 'endpoint'],
      'aws': ['aws', 'cloud'],
      'azure': ['azure', 'cloud'],
      'gcp': ['gcp', 'cloud'],
      'okta': ['okta'],
      'crowdstrike': ['crowdstrike'],
      'carbon black': ['carbon_black'],
      'splunk': ['splunk'],
      'palo alto': ['pan', 'palo_alto'],
      'cisco': ['cisco'],
      'o365': ['o365', 'office365'],
      'kubernetes': ['kubernetes', 'k8s'],
      'docker': ['container', 'docker'],
      'iis': ['iis', 'web'],
      'sql': ['sql', 'database'],
      'exchange': ['exchange', 'email'],
      'active directory': ['ad', 'active_directory', 'ldap'],
    };

    const lowerProduct = productName.toLowerCase();
    const lowerVendor = vendor.toLowerCase();

    for (const [key, terms] of Object.entries(productMappings)) {
      if (lowerProduct.includes(key) || lowerVendor.includes(key)) {
        keywords.push(...terms);
      }
    }

    if (keywords.length === 0) {
      keywords.push(lowerProduct.replace(/\s+/g, '_'));
      keywords.push(lowerVendor.replace(/\s+/g, '_'));
    }

    return keywords;
  }

  private async searchDetections(keywords: string[]): Promise<SplunkDetection[]> {
    try {
      const response = await fetch(SPLUNK_API_URL, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const yamlFiles = data.tree
        .filter((item: { path: string; type: string }) => 
          item.type === 'blob' && 
          item.path.endsWith('.yml') &&
          item.path.startsWith('detections/')
        )
        .filter((item: { path: string }) => 
          keywords.some(k => item.path.toLowerCase().includes(k))
        )
        .slice(0, 25);

      const detections: SplunkDetection[] = [];
      for (const file of yamlFiles) {
        const detection = await this.fetchDetection(file.path);
        if (detection) {
          detections.push(detection);
        }
      }

      return detections;
    } catch {
      return [];
    }
  }

  private async fetchDetection(path: string): Promise<SplunkDetection | null> {
    try {
      const response = await fetch(`https://raw.githubusercontent.com/splunk/security_content/develop/${path}`);
      if (!response.ok) return null;

      const yaml = await response.text();
      return this.parseYaml(yaml);
    } catch {
      return null;
    }
  }

  private parseYaml(yaml: string): SplunkDetection | null {
    try {
      const detection: Partial<SplunkDetection> = { tags: {} };

      const nameMatch = yaml.match(/^name:\s*(.+)$/m);
      if (nameMatch) detection.name = nameMatch[1].trim();

      const idMatch = yaml.match(/^id:\s*(.+)$/m);
      if (idMatch) detection.id = idMatch[1].trim();

      const descMatch = yaml.match(/^description:\s*[|>]?\s*([\s\S]*?)(?=^[a-z_]+:|$)/m);
      if (descMatch) detection.description = descMatch[1].trim().split('\n')[0];

      const searchMatch = yaml.match(/^search:\s*[|>]?\s*([\s\S]*?)(?=^[a-z_]+:|$)/m);
      if (searchMatch) detection.search = searchMatch[1].trim();

      const mitreMatch = yaml.match(/mitre_attack_id:\s*\n((?:\s*-\s*.+\n?)+)/);
      if (mitreMatch) {
        detection.tags!.mitre_attack_id = mitreMatch[1]
          .split('\n')
          .filter(l => l.trim().startsWith('-'))
          .map(l => l.replace(/^\s*-\s*/, '').trim());
      }

      const dataSourceMatch = yaml.match(/data_source:\s*\n((?:\s*-\s*.+\n?)+)/);
      if (dataSourceMatch) {
        detection.data_source = dataSourceMatch[1]
          .split('\n')
          .filter(l => l.trim().startsWith('-'))
          .map(l => l.replace(/^\s*-\s*/, '').trim());
      }

      if (!detection.name || !detection.id) return null;
      return detection as SplunkDetection;
    } catch {
      return null;
    }
  }

  private normalizeMappings(productId: string, detections: SplunkDetection[]): NormalizedMapping {
    const techniqueIds = new Set<string>();
    const analytics: AnalyticMapping[] = [];
    const dataComponents: DataComponentMapping[] = [];
    const seenDataSources = new Set<string>();

    for (const detection of detections) {
      for (const tid of detection.tags?.mitre_attack_id || []) {
        techniqueIds.add(tid);
      }

      analytics.push({
        id: `SPLUNK-${detection.id}`,
        name: detection.name,
        description: detection.description,
        source: 'splunk',
        query: detection.search,
        logSources: detection.data_source,
      });

      for (const ds of detection.data_source || []) {
        if (!seenDataSources.has(ds)) {
          seenDataSources.add(ds);
          dataComponents.push({
            id: `SPLUNK-DC-${ds.replace(/[^a-zA-Z0-9]/g, '-')}`,
            name: ds,
            dataSource: 'Splunk Data Source',
          });
        }
      }
    }

    return {
      productId,
      source: 'splunk',
      confidence: Math.min(100, detections.length * 6),
      detectionStrategies: Array.from(techniqueIds).map(t => `DS-${t}`),
      analytics,
      dataComponents,
      rawData: detections,
    };
  }
}
