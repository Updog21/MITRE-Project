import { ResourceAdapter, NormalizedMapping, AnalyticMapping, DataComponentMapping } from '../types';

const SIGMA_API_URL = 'https://api.github.com/repos/SigmaHQ/sigma/git/trees/master?recursive=1';

interface SigmaRule {
  title: string;
  id: string;
  status?: string;
  description?: string;
  logsource: {
    category?: string;
    product?: string;
    service?: string;
  };
  detection: Record<string, unknown>;
  tags?: string[];
}

export class SigmaAdapter implements ResourceAdapter {
  name: 'sigma' = 'sigma';

  isApplicable(_productType: string, _platforms: string[]): boolean {
    return true;
  }

  async fetchMappings(productName: string, vendor: string): Promise<NormalizedMapping | null> {
    const productKeywords = this.getProductKeywords(productName, vendor);
    const rules = await this.searchRules(productKeywords);

    if (rules.length === 0) {
      return null;
    }

    return this.normalizeMappings(productName, rules);
  }

  private getProductKeywords(productName: string, vendor: string): string[] {
    const keywords: string[] = [];
    
    const productMappings: Record<string, string[]> = {
      'okta': ['okta'],
      'azure': ['azure', 'entra', 'aad'],
      'aws': ['aws', 'cloudtrail'],
      'google': ['gcp', 'google', 'gworkspace'],
      'office 365': ['o365', 'office365', 'microsoft365'],
      'unifi': ['ubiquiti', 'unifi'],
      'meraki': ['cisco', 'meraki'],
      'palo alto': ['paloalto', 'pan-os'],
      'fortinet': ['fortigate', 'fortinet'],
      'zeek': ['zeek', 'bro'],
    };

    const lowerProduct = productName.toLowerCase();
    const lowerVendor = vendor.toLowerCase();

    for (const [key, terms] of Object.entries(productMappings)) {
      if (lowerProduct.includes(key) || lowerVendor.includes(key)) {
        keywords.push(...terms);
      }
    }

    if (keywords.length === 0) {
      keywords.push(lowerProduct.replace(/\s+/g, ''));
      keywords.push(lowerVendor.replace(/\s+/g, ''));
    }

    return keywords;
  }

  private async searchRules(keywords: string[]): Promise<SigmaRule[]> {
    try {
      const response = await fetch(SIGMA_API_URL, {
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
          item.path.startsWith('rules/')
        )
        .filter((item: { path: string }) => 
          keywords.some(k => item.path.toLowerCase().includes(k))
        )
        .slice(0, 20);

      const rules: SigmaRule[] = [];
      for (const file of yamlFiles) {
        const rule = await this.fetchRule(file.path);
        if (rule) {
          rules.push(rule);
        }
      }

      return rules;
    } catch {
      return [];
    }
  }

  private async fetchRule(path: string): Promise<SigmaRule | null> {
    try {
      const response = await fetch(`https://raw.githubusercontent.com/SigmaHQ/sigma/master/${path}`);
      if (!response.ok) return null;

      const yaml = await response.text();
      return this.parseYaml(yaml);
    } catch {
      return null;
    }
  }

  private parseYaml(yaml: string): SigmaRule | null {
    try {
      const lines = yaml.split('\n');
      const rule: Partial<SigmaRule> = { logsource: {}, detection: {} };

      for (const line of lines) {
        if (line.startsWith('title:')) rule.title = line.replace('title:', '').trim();
        if (line.startsWith('id:')) rule.id = line.replace('id:', '').trim();
        if (line.startsWith('description:')) rule.description = line.replace('description:', '').trim();
        if (line.startsWith('status:')) rule.status = line.replace('status:', '').trim();
        if (line.includes('product:')) rule.logsource!.product = line.replace(/.*product:\s*/, '').trim();
        if (line.includes('service:')) rule.logsource!.service = line.replace(/.*service:\s*/, '').trim();
        if (line.includes('category:')) rule.logsource!.category = line.replace(/.*category:\s*/, '').trim();
      }

      const tagMatch = yaml.match(/tags:\s*\n((?:\s+-\s+.*\n?)+)/);
      if (tagMatch) {
        rule.tags = tagMatch[1].split('\n')
          .filter(l => l.trim().startsWith('-'))
          .map(l => l.replace(/^\s*-\s*/, '').trim());
      }

      return rule as SigmaRule;
    } catch {
      return null;
    }
  }

  private normalizeMappings(productId: string, rules: SigmaRule[]): NormalizedMapping {
    const techniqueIds = new Set<string>();
    const analytics: AnalyticMapping[] = [];
    const dataComponents: DataComponentMapping[] = [];

    for (const rule of rules) {
      const attackTags = rule.tags?.filter(t => t.startsWith('attack.t')) || [];
      
      for (const tag of attackTags) {
        const tid = tag.replace('attack.', '').toUpperCase();
        techniqueIds.add(tid);
      }

      analytics.push({
        id: `SIGMA-${rule.id}`,
        name: rule.title,
        description: rule.description,
        source: 'sigma',
        logSources: [
          rule.logsource.product,
          rule.logsource.service,
          rule.logsource.category,
        ].filter(Boolean) as string[],
      });

      if (rule.logsource.product) {
        dataComponents.push({
          id: `SIGMA-DC-${rule.logsource.product}`,
          name: rule.logsource.product,
          dataSource: rule.logsource.category || 'Application Log',
        });
      }
    }

    return {
      productId,
      source: 'sigma',
      confidence: Math.min(100, rules.length * 10),
      detectionStrategies: Array.from(techniqueIds).map(t => `DS-${t}`),
      analytics,
      dataComponents: Array.from(new Map(dataComponents.map(dc => [dc.id, dc])).values()),
      rawData: rules,
    };
  }
}
