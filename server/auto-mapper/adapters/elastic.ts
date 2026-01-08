import { ResourceAdapter, NormalizedMapping, AnalyticMapping, DataComponentMapping } from '../types';

const ELASTIC_API_URL = 'https://api.github.com/repos/elastic/detection-rules/git/trees/main?recursive=1';

interface ElasticRule {
  name: string;
  rule_id: string;
  description?: string;
  index?: string[];
  query?: string;
  threat?: Array<{
    framework: string;
    technique: Array<{
      id: string;
      name: string;
    }>;
  }>;
  tags?: string[];
}

export class ElasticAdapter implements ResourceAdapter {
  name: 'elastic' = 'elastic';

  isApplicable(productType: string, platforms: string[]): boolean {
    const endpointPlatforms = ['Windows', 'Linux', 'macOS'];
    return productType === 'endpoint' || 
           platforms.some(p => endpointPlatforms.includes(p));
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
      'windows': ['windows', 'winlog', 'sysmon'],
      'linux': ['linux', 'auditd', 'syslog'],
      'macos': ['macos', 'apple'],
      'sysmon': ['sysmon'],
      'defender': ['defender', 'microsoft'],
      'crowdstrike': ['crowdstrike', 'falcon'],
      'carbon black': ['carbonblack', 'cb_'],
      'sentinelone': ['sentinelone', 's1'],
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
    }

    return keywords;
  }

  private async searchRules(keywords: string[]): Promise<ElasticRule[]> {
    try {
      const response = await fetch(ELASTIC_API_URL, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const tomlFiles = data.tree
        .filter((item: { path: string; type: string }) => 
          item.type === 'blob' && 
          item.path.endsWith('.toml') &&
          item.path.startsWith('rules/')
        )
        .filter((item: { path: string }) => 
          keywords.some(k => item.path.toLowerCase().includes(k))
        )
        .slice(0, 15);

      const rules: ElasticRule[] = [];
      for (const file of tomlFiles) {
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

  private async fetchRule(path: string): Promise<ElasticRule | null> {
    try {
      const response = await fetch(`https://raw.githubusercontent.com/elastic/detection-rules/main/${path}`);
      if (!response.ok) return null;

      const toml = await response.text();
      return this.parseToml(toml);
    } catch {
      return null;
    }
  }

  private parseToml(toml: string): ElasticRule | null {
    try {
      const rule: Partial<ElasticRule> = {};

      const nameMatch = toml.match(/name\s*=\s*"([^"]+)"/);
      if (nameMatch) rule.name = nameMatch[1];

      const ruleIdMatch = toml.match(/rule_id\s*=\s*"([^"]+)"/);
      if (ruleIdMatch) rule.rule_id = ruleIdMatch[1];

      const descMatch = toml.match(/description\s*=\s*"""([\s\S]*?)"""|description\s*=\s*"([^"]+)"/);
      if (descMatch) rule.description = (descMatch[1] || descMatch[2])?.trim();

      const queryMatch = toml.match(/query\s*=\s*'''([\s\S]*?)'''|query\s*=\s*"([^"]+)"/);
      if (queryMatch) rule.query = (queryMatch[1] || queryMatch[2])?.trim();

      rule.threat = [];
      
      const techniqueBlockRegex = /\[\[rule\.threat\.technique\]\]\s*\n\s*id\s*=\s*"([^"]+)"\s*\n\s*name\s*=\s*"([^"]+)"/g;
      const techniqueMatches = Array.from(toml.matchAll(techniqueBlockRegex));
      for (const match of techniqueMatches) {
        rule.threat.push({
          framework: 'MITRE ATT&CK',
          technique: [{ id: match[1], name: match[2] }],
        });
      }
      
      const subtechniqueRegex = /\[\[rule\.threat\.technique\.subtechnique\]\]\s*\n\s*id\s*=\s*"([^"]+)"\s*\n\s*name\s*=\s*"([^"]+)"/g;
      const subtechniqueMatches = Array.from(toml.matchAll(subtechniqueRegex));
      for (const match of subtechniqueMatches) {
        rule.threat.push({
          framework: 'MITRE ATT&CK',
          technique: [{ id: match[1], name: match[2] }],
        });
      }

      const tagsMatch = toml.match(/tags\s*=\s*\[([\s\S]*?)\]/);
      if (tagsMatch) {
        rule.tags = tagsMatch[1].match(/"([^"]+)"/g)?.map(t => t.replace(/"/g, ''));
      }

      if (!rule.name || !rule.rule_id) return null;
      return rule as ElasticRule;
    } catch {
      return null;
    }
  }

  private normalizeMappings(productId: string, rules: ElasticRule[]): NormalizedMapping {
    const techniqueIds = new Set<string>();
    const analytics: AnalyticMapping[] = [];
    const dataComponents: DataComponentMapping[] = [];

    for (const rule of rules) {
      for (const threat of rule.threat || []) {
        for (const technique of threat.technique) {
          techniqueIds.add(technique.id);
        }
      }

      analytics.push({
        id: `ELASTIC-${rule.rule_id}`,
        name: rule.name,
        description: rule.description,
        query: rule.query,
      });

      if (rule.index) {
        for (const idx of rule.index) {
          dataComponents.push({
            id: `ELASTIC-DC-${idx.replace(/[^a-zA-Z0-9]/g, '-')}`,
            name: idx,
            dataSource: 'Elastic Index',
          });
        }
      }
    }

    return {
      productId,
      source: 'elastic',
      confidence: Math.min(100, rules.length * 8),
      detectionStrategies: Array.from(techniqueIds).map(t => `DS-${t}`),
      analytics,
      dataComponents: Array.from(new Map(dataComponents.map(dc => [dc.id, dc])).values()),
      rawData: rules,
    };
  }
}
