/**
 * Sigma Adapter - Phase 2: Intelligence & Persistence
 *
 * Architecture:
 * 1. Sigma Adapter's Job: Find the KEYS (Technique IDs and Data Component Names). That's it.
 * 2. Workbench's Job: Use those Keys to "hydrate" the result with rich context.
 *
 * Two-Tier Logic:
 * - Tier 1 (90%): Rule has attack.tXXXX tags → Extract ID, STOP
 * - Tier 2 (10%): No ID, only category + tactic → Use map, query Workbench
 *
 * Phase 2 Enhancement:
 * - Now accepts injected search terms from ProductService for alias resolution
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { glob } from 'glob';
import { mitreKnowledgeGraph } from '../../mitre-stix/knowledge-graph';
import { ResourceAdapter, NormalizedMapping, AnalyticMapping, DataComponentMapping } from '../types';
import mapConfig from '../../../mappings/sigma-v18-map.json';
import { productService } from '../../services';

// Confidence Modifiers by rule source type
const MODIFIERS: Record<string, number> = {
  'generic': 1.0,
  'emerging': 1.0,
  'hunting': 0.8,
  'compliance': 0.5
};

interface ScoredId {
  id: string;                          // T-Code or DC-Name
  type: 'technique' | 'data-component';
  confidence: number;
  source: string;                      // 'tag' or 'inference'
}

interface ExtractedRule {
  ruleId: string;
  title: string;
  description?: string;
  logsource: {
    category?: string;
    product?: string;
    service?: string;
  };
  tags?: string[];
  foundIds: ScoredId[];
}

export class SigmaAdapter implements ResourceAdapter {
  name: 'sigma' = 'sigma';

  // Relative path - works in both Docker (WORKDIR /app) and local dev
  private BASE_SIGMA_PATH = './data/sigma';

  // Rule directories to scan
  private rulePaths = [
    'rules',
    'rules-emerging-threats',
    'rules-threat-hunting',
    'rules-compliance'
  ];

  isApplicable(_productType: string, _platforms: string[]): boolean {
    return true;
  }

  /**
   * Main Entry Point
   * Phase 2: Now uses ProductService for intelligent alias resolution
   */
  async fetchMappings(productName: string, vendor: string): Promise<NormalizedMapping | null> {
    console.log(`[Sigma] Starting ID Extraction for: "${productName}"`);
    await mitreKnowledgeGraph.ensureInitialized();

    // Phase 2: Try to resolve search terms via ProductService (alias-aware)
    let searchTerms: string[];
    try {
      const resolved = await productService.resolveSearchTerms(productName);
      if (resolved) {
        searchTerms = resolved.allTerms;
        console.log(`[Sigma] ProductService resolved "${productName}" → ${searchTerms.length} search terms`);
      } else {
        // Fall back to basic term building
        searchTerms = this.buildSearchTerms(productName, vendor);
        console.log(`[Sigma] No alias found, using basic terms: ${searchTerms.length} terms`);
      }
    } catch (e) {
      // ProductService not available (e.g., database not connected), use fallback
      searchTerms = this.buildSearchTerms(productName, vendor);
      console.log(`[Sigma] ProductService unavailable, using basic terms`);
    }

    // 1. Find Files (Locally - Fast)
    let allFiles: string[] = [];
    try {
      for (const subDir of this.rulePaths) {
        const searchPath = path.join(this.BASE_SIGMA_PATH, subDir, '**/*.yml');
        const files = await glob(searchPath);
        allFiles = allFiles.concat(files);
      }
    } catch (e) {
      console.error(`[Sigma] Error finding files at ${this.BASE_SIGMA_PATH}. Did you clone the repo?`, e);
      return null;
    }

    if (allFiles.length === 0) {
      console.warn(`[Sigma] 0 files found. Check your ${this.BASE_SIGMA_PATH} folder.`);
      return null;
    }

    console.log(`[Sigma] Found ${allFiles.length} rules. Processing in batches...`);

    // 2. Process in Batches (Fixes the Hang)
    const BATCH_SIZE = 50;
    const extractedData: ExtractedRule[] = [];

    for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
      const chunk = allFiles.slice(i, i + BATCH_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(file => this.extractIdsFromFile(file, searchTerms))
      );
      extractedData.push(...chunkResults.filter((r): r is ExtractedRule => r !== null));

      // Heartbeat every 500 files
      if ((i + BATCH_SIZE) % 500 === 0) process.stdout.write('.');
    }
    console.log(`\n[Sigma] Extraction Complete. Matched ${extractedData.length} rules.`);

    if (extractedData.length === 0) {
      return null;
    }

    // 3. Hydrate with Workbench Data (The "End Goal")
    return this.hydrateFromWorkbench(productName, extractedData);
  }

  /**
   * CORE LOGIC: Find IDs and Stop
   */
  private async extractIdsFromFile(filePath: string, searchTerms: string[]): Promise<ExtractedRule | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const doc = yaml.load(content) as any;

      if (!doc || !doc.title) return null;

      // A. Match Product
      if (!this.ruleMatches(doc, searchTerms)) return null;

      const ruleType = this.getRuleType(filePath);
      const modifier = MODIFIERS[ruleType] || 1.0;
      const ids: ScoredId[] = [];

      // B. Tier 1: Direct Technique IDs (The Preferred Path)
      const tagIds = this.extractTagIds(doc.tags);
      if (tagIds.length > 0) {
        tagIds.forEach(tId => ids.push({
          id: tId,
          type: 'technique',
          confidence: 100 * modifier,
          source: 'tag'
        }));
      }
      // C. Tier 2: Inference (Map Category -> DC Name)
      else if (doc.logsource?.category) {
        const cat = doc.logsource.category.toLowerCase();
        const mitreDcName = (mapConfig.category_map as Record<string, string>)[cat];

        if (mitreDcName) {
          // We found a Data Component Name.
          // Add it to the list. Hydration step will find Techniques.
          ids.push({
            id: mitreDcName,
            type: 'data-component',
            confidence: 75 * modifier,
            source: 'inference'
          });
        }
      }

      if (ids.length === 0) return null;

      return {
        ruleId: doc.id || doc.title,
        title: doc.title,
        description: doc.description,
        logsource: doc.logsource || {},
        tags: doc.tags,  // Preserve tags for tactic extraction in hydration
        foundIds: ids
      };

    } catch {
      return null;
    }
  }

  /**
   * FINAL STEP: Use Workbench to determine everything else
   */
  private hydrateFromWorkbench(productName: string, extractedRules: ExtractedRule[]): NormalizedMapping {
    const techniquesMap = new Map<string, { techniqueId: string; confidence: number }>();
    const analytics: AnalyticMapping[] = [];
    const dcMap = new Set<string>();

    for (const item of extractedRules) {
      // 1. Add Analytic (From Rule)
      analytics.push({
        id: `SIGMA-${item.ruleId}`,
        name: item.title,
        description: item.description,
        source: 'sigma'
      });

      // 2. Resolve IDs using Workbench
      for (const idObj of item.foundIds) {

        if (idObj.type === 'technique') {
          // We have the T-ID directly. Just verify it exists in graph.
          const tech = mitreKnowledgeGraph.getTechnique(idObj.id);
          if (tech) {
            this.addTechnique(techniquesMap, tech.id, idObj.confidence);
          }
        }
        else if (idObj.type === 'data-component') {
          // We have the DC Name. Ask Workbench for the T-IDs.
          const tactic = this.extractTactic(item.tags); // Use tags from rule root
          const inferredTechs = mitreKnowledgeGraph.getTechniquesByTacticAndDataComponent(
            tactic || 'execution', // Default tactic if none found
            idObj.id               // The Data Component Name
          );

          inferredTechs.forEach(t => {
            this.addTechnique(techniquesMap, t.id, idObj.confidence);
          });

          // Also track the Data Component itself for the UI
          dcMap.add(idObj.id);
        }
      }
    }

    // Convert Maps to Arrays for Final Output
    const allTechniques = Array.from(techniquesMap.values());
    const confidence = allTechniques.length ?
      Math.round(allTechniques.reduce((a, b) => a + b.confidence, 0) / allTechniques.length) : 0;

    const dataComponents: DataComponentMapping[] = Array.from(dcMap).map(name => ({
      id: `DC-${name.replace(/\s+/g, '-')}`,
      name,
      dataSource: 'Unknown' // UI will look up Source via Graph
    }));

    return {
      productId: productName,
      source: 'sigma',
      confidence,
      detectionStrategies: allTechniques.map(t => `DS-${t.techniqueId}`),
      analytics,
      dataComponents,
      rawData: { rules: extractedRules }
    };
  }

  // --- Helpers ---

  private addTechnique(map: Map<string, { techniqueId: string; confidence: number }>, id: string, conf: number) {
    if (!map.has(id) || map.get(id)!.confidence < conf) {
      map.set(id, { techniqueId: id, confidence: conf });
    }
  }

  private buildSearchTerms(productName: string, vendor: string): string[] {
    const terms = new Set<string>();
    terms.add(productName.toLowerCase());
    terms.add(vendor.toLowerCase());

    // Add common variations
    terms.add(productName.toLowerCase().replace(/\s+/g, ''));
    terms.add(productName.toLowerCase().replace(/\s+/g, '-'));
    terms.add(productName.toLowerCase().replace(/\s+/g, '_'));

    return Array.from(terms).filter(t => t.length > 0);
  }

  private ruleMatches(doc: any, terms: string[]): boolean {
    // Check product/service/category/description
    const corpus = [
      JSON.stringify(doc.logsource || {}),
      doc.description || '',
      doc.title || ''
    ].join(' ').toLowerCase();

    return terms.some(t => corpus.includes(t));
  }

  private extractTagIds(tags?: string[]): string[] {
    if (!tags) return [];
    return tags
      .filter(t => t.match(/^attack\.t\d{4}/i))
      .map(t => t.replace('attack.', '').toUpperCase());
  }

  private extractTactic(tags?: string[]): string | null {
    if (!tags) return null;
    // Find tags like 'attack.execution', 'attack.persistence' (not technique IDs)
    const tacticTag = tags.find(x =>
      x.startsWith('attack.') && !x.match(/^attack\.t\d{4}/i)
    );
    return tacticTag ? tacticTag.replace('attack.', '') : null;
  }

  private getRuleType(filePath: string): string {
    if (filePath.includes('emerging')) return 'emerging';
    if (filePath.includes('hunting')) return 'hunting';
    if (filePath.includes('compliance')) return 'compliance';
    return 'generic';
  }
}
