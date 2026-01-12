import { db } from '../db';
import { mitreAssets, detectionStrategies, analytics, dataComponents as dataComponentsTable } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface CarAnalytic {
  name: string;
  shortName: string;
  fields: string[];
  attack: Array<{
    tactics: string[];
    technique: string;
    coverage: string;
  }>;
}

interface CarData {
  analytics: CarAnalytic[];
}

interface StixObject {
  id: string;
  type: string;
  name?: string;
  description?: string;
  external_references?: Array<{
    source_name: string;
    external_id?: string;
    url?: string;
  }>;
  x_mitre_platforms?: string[];
  x_mitre_data_sources?: string[];
  x_mitre_detection?: string;
  x_mitre_data_component_refs?: string[];
  x_mitre_detection_strategy_refs?: string[];
  x_mitre_data_source_ref?: string;
  x_mitre_analytic_refs?: string[];
  x_mitre_log_source_references?: Array<{
    x_mitre_data_component_ref: string;
    name: string;
    channel?: string;
  }>;
  kill_chain_phases?: Array<{ phase_name: string }>;
}

interface StixRelationship {
  id: string;
  type: 'relationship';
  relationship_type: string;
  source_ref: string;
  target_ref: string;
  description?: string;
}

interface StixBundle {
  type: 'bundle';
  objects: (StixObject | StixRelationship)[];
}

interface TechniqueInfo {
  id: string;
  stixId: string;
  name: string;
  description: string;
  platforms: string[];
  tactics: string[];
  dataSources: string[];
  detection: string;
}

interface StrategyInfo {
  id: string;
  stixId: string;
  name: string;
  description: string;
  techniques: string[];
}

interface AnalyticInfo {
  id: string;
  stixId: string;
  name: string;
  description: string;
  strategyRefs: string[];
  dataComponentRefs: string[];
  platforms: string[];
}

interface DataComponentInfo {
  id: string;
  stixId: string;
  name: string;
  description: string;
  dataSourceId: string;
  dataSourceName: string;
}

interface LogRequirement {
  strategyId: string;
  strategyName: string;
  analyticId: string;
  analyticName: string;
  dataComponentId: string;
  dataComponentName: string;
  dataSourceName: string;
}

export class MitreKnowledgeGraph {
  private stixUrl = 'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json';
  private carUrl = 'https://raw.githubusercontent.com/mitre-attack/car/master/docs/data/analytics.json';
  
  private techniqueMap: Map<string, TechniqueInfo> = new Map();
  private strategyMap: Map<string, StrategyInfo> = new Map();
  private analyticMap: Map<string, AnalyticInfo> = new Map();
  private dataComponentMap: Map<string, DataComponentInfo> = new Map();
  private dataSourceMap: Map<string, { id: string; name: string }> = new Map();
  
  private techniqueToStrategies: Map<string, string[]> = new Map();
  private strategyToAnalytics: Map<string, string[]> = new Map();
  private analyticToStrategies: Map<string, string[]> = new Map(); // Reverse lookup for Tier 2 inference
  private analyticToDataComponents: Map<string, string[]> = new Map();
  private dataComponentToAnalytics: Map<string, string[]> = new Map(); // Reverse lookup for Tier 2 inference

  private techniqueToCarAnalytics: Map<string, CarAnalytic[]> = new Map();
  
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this.ingestData();
    await this.initPromise;
  }

  async ingestData(): Promise<void> {
    console.log('[-] Downloading MITRE v18 STIX Data...');
    
    try {
      const [stixResponse, carResponse] = await Promise.all([
        fetch(this.stixUrl),
        fetch(this.carUrl),
      ]);
      
      if (!stixResponse.ok) {
        throw new Error(`Failed to fetch STIX data: ${stixResponse.status}`);
      }
      
      const stixBundle: StixBundle = await stixResponse.json();
      console.log(`[-] Loaded ${stixBundle.objects.length} STIX objects`);
      
      this.buildIndexes(stixBundle);
      
      if (carResponse.ok) {
        const carData: CarData = await carResponse.json();
        this.buildCarIndex(carData);
        console.log(`[-] Loaded ${carData.analytics.length} CAR analytics`);
      } else {
        console.warn('[!] Failed to fetch CAR data, continuing without it');
      }
      
      this.initialized = true;
      
      console.log('[+] MITRE Knowledge Graph Ingestion Complete');
      console.log(`    Techniques: ${this.techniqueMap.size}`);
      console.log(`    Detection Strategies: ${this.strategyMap.size}`);
      console.log(`    Analytics: ${this.analyticMap.size}`);
      console.log(`    Data Components: ${this.dataComponentMap.size}`);
      console.log(`    Data Sources: ${this.dataSourceMap.size}`);
      console.log(`    CAR Technique Mappings: ${this.techniqueToCarAnalytics.size}`);
    } catch (error) {
      console.error('[!] Failed to ingest MITRE STIX data:', error);
      throw error;
    }
  }
  
  private buildCarIndex(carData: CarData): void {
    for (const analytic of carData.analytics) {
      for (const attack of analytic.attack) {
        const techId = attack.technique.replace('Technique/', '').toUpperCase();
        if (!this.techniqueToCarAnalytics.has(techId)) {
          this.techniqueToCarAnalytics.set(techId, []);
        }
        this.techniqueToCarAnalytics.get(techId)!.push(analytic);
      }
    }
  }

  private buildIndexes(bundle: StixBundle): void {
    const objects = bundle.objects;
    
    for (const obj of objects) {
      if (obj.type === 'relationship') continue;
      
      const stixObj = obj as StixObject;
      const externalId = this.getExternalId(stixObj);
      
      switch (stixObj.type) {
        case 'attack-pattern':
          if (externalId) {
            this.techniqueMap.set(externalId, {
              id: externalId,
              stixId: stixObj.id,
              name: stixObj.name || '',
              description: stixObj.description || '',
              platforms: stixObj.x_mitre_platforms || [],
              tactics: (stixObj.kill_chain_phases || []).map(kc => kc.phase_name),
              dataSources: stixObj.x_mitre_data_sources || [],
              detection: stixObj.x_mitre_detection || '',
            });
          }
          break;
          
        case 'x-mitre-detection-strategy':
          if (externalId) {
            const analyticRefs = stixObj.x_mitre_analytic_refs || [];
            this.strategyMap.set(stixObj.id, {
              id: externalId,
              stixId: stixObj.id,
              name: stixObj.name || '',
              description: stixObj.description || '',
              techniques: [],
            });
            
            for (const analyticRef of analyticRefs) {
              if (!this.strategyToAnalytics.has(stixObj.id)) {
                this.strategyToAnalytics.set(stixObj.id, []);
              }
              this.strategyToAnalytics.get(stixObj.id)!.push(analyticRef);
            }
          }
          break;
          
        case 'x-mitre-analytic':
          if (externalId) {
            const dataComponentRefs: string[] = [];
            if (stixObj.x_mitre_log_source_references) {
              for (const lsr of stixObj.x_mitre_log_source_references) {
                if (lsr.x_mitre_data_component_ref) {
                  dataComponentRefs.push(lsr.x_mitre_data_component_ref);
                }
              }
            }
            
            this.analyticMap.set(stixObj.id, {
              id: externalId,
              stixId: stixObj.id,
              name: stixObj.name || '',
              description: stixObj.description || '',
              strategyRefs: [],
              dataComponentRefs,
              platforms: stixObj.x_mitre_platforms || [],
            });
          }
          break;
          
        case 'x-mitre-data-component':
          const dcExternalId = this.getExternalId(stixObj);
          this.dataComponentMap.set(stixObj.id, {
            id: dcExternalId || stixObj.id,
            stixId: stixObj.id,
            name: stixObj.name || '',
            description: stixObj.description || '',
            dataSourceId: stixObj.x_mitre_data_source_ref || '',
            dataSourceName: '',
          });
          break;
          
        case 'x-mitre-data-source':
          // Always index data sources, even without external ID, because we need the name for linkage
          this.dataSourceMap.set(stixObj.id, {
            id: externalId || stixObj.id,
            name: stixObj.name || '',
          });
          break;
      }
    }
    
    let linkedCount = 0;
    this.dataComponentMap.forEach((dc, dcId) => {
      const ds = this.dataSourceMap.get(dc.dataSourceId);
      if (ds) {
        dc.dataSourceName = ds.name;
        linkedCount++;
      }
    });
    console.log(`[-] Linked ${linkedCount}/${this.dataComponentMap.size} Data Components to Data Sources`);

    // Populate analyticToDataComponents and reverse lookup dataComponentToAnalytics
    // This enables O(1) lookups for Tier 2 inference
    this.analyticMap.forEach((analytic, analyticStixId) => {
      const dcRefs = analytic.dataComponentRefs;
      if (dcRefs.length > 0) {
        // Forward map: analytic -> data components
        this.analyticToDataComponents.set(analyticStixId, dcRefs);

        // Reverse map: data component -> analytics (for Tier 2 inference)
        for (const dcRef of dcRefs) {
          if (!this.dataComponentToAnalytics.has(dcRef)) {
            this.dataComponentToAnalytics.set(dcRef, []);
          }
          this.dataComponentToAnalytics.get(dcRef)!.push(analyticStixId);
        }
      }
    });

    // Populate analyticToStrategies (reverse of strategyToAnalytics)
    // Traversal: strategy -> analytics becomes analytics -> strategies
    this.strategyToAnalytics.forEach((analyticStixIds, strategyStixId) => {
      for (const analyticStixId of analyticStixIds) {
        if (!this.analyticToStrategies.has(analyticStixId)) {
          this.analyticToStrategies.set(analyticStixId, []);
        }
        this.analyticToStrategies.get(analyticStixId)!.push(strategyStixId);
      }
    });

    for (const obj of objects) {
      if (obj.type !== 'relationship') continue;
      
      const rel = obj as StixRelationship;
      
      if (rel.relationship_type === 'detects' && rel.source_ref.includes('x-mitre-detection-strategy')) {
        const techInfo = this.findTechniqueByStixId(rel.target_ref);
        if (techInfo) {
          if (!this.techniqueToStrategies.has(techInfo.id)) {
            this.techniqueToStrategies.set(techInfo.id, []);
          }
          this.techniqueToStrategies.get(techInfo.id)!.push(rel.source_ref);
          
          const strategy = this.strategyMap.get(rel.source_ref);
          if (strategy) {
            strategy.techniques.push(techInfo.id);
          }
        }
      }
    }
  }

  private getExternalId(obj: StixObject): string | null {
    if (!obj.external_references) return null;
    
    for (const ref of obj.external_references) {
      if (ref.source_name === 'mitre-attack' && ref.external_id) {
        return ref.external_id;
      }
    }
    return null;
  }

  private findTechniqueByStixId(stixId: string): TechniqueInfo | null {
    let found: TechniqueInfo | null = null;
    this.techniqueMap.forEach((tech) => {
      if (tech.stixId === stixId) {
        found = tech;
      }
    });
    return found;
  }

  getTechnique(techniqueId: string): TechniqueInfo | null {
    const normalized = techniqueId.toUpperCase();
    return this.techniqueMap.get(normalized) || null;
  }

  getLogRequirements(techniqueId: string): LogRequirement[] {
    const normalized = techniqueId.toUpperCase();
    const requirements: LogRequirement[] = [];
    
    const strategyStixIds = this.techniqueToStrategies.get(normalized) || [];
    
    if (strategyStixIds.length === 0) {
      const tech = this.techniqueMap.get(normalized);
      if (tech && tech.dataSources.length > 0) {
        for (const ds of tech.dataSources) {
          requirements.push({
            strategyId: 'INFERRED',
            strategyName: `Inferred from ${normalized}`,
            analyticId: 'INFERRED',
            analyticName: 'Data source based detection',
            dataComponentId: ds,
            dataComponentName: ds,
            dataSourceName: ds.split(':')[0] || ds,
          });
        }
      }
      return requirements;
    }
    
    for (const stratStixId of strategyStixIds) {
      const strategy = this.strategyMap.get(stratStixId);
      if (!strategy) continue;
      
      const analyticStixIds = this.strategyToAnalytics.get(stratStixId) || [];
      
      for (const analyticStixId of analyticStixIds) {
        const analytic = this.analyticMap.get(analyticStixId);
        if (!analytic) continue;
        
        for (const dcRef of analytic.dataComponentRefs) {
          const dc = this.dataComponentMap.get(dcRef);
          if (!dc) continue;
          
          requirements.push({
            strategyId: strategy.id,
            strategyName: strategy.name,
            analyticId: analytic.id,
            analyticName: analytic.name,
            dataComponentId: dc.id,
            dataComponentName: dc.name,
            dataSourceName: dc.dataSourceName,
          });
        }
      }
    }
    
    return requirements;
  }

  getStrategiesForTechnique(techniqueId: string): StrategyInfo[] {
    const normalized = techniqueId.toUpperCase();
    const strategyStixIds = this.techniqueToStrategies.get(normalized) || [];
    
    return strategyStixIds
      .map(id => this.strategyMap.get(id))
      .filter((s): s is StrategyInfo => s !== undefined);
  }

  getAnalyticsForStrategy(strategyStixId: string): AnalyticInfo[] {
    const analyticStixIds = this.strategyToAnalytics.get(strategyStixId) || [];
    
    return analyticStixIds
      .map(id => this.analyticMap.get(id))
      .filter((a): a is AnalyticInfo => a !== undefined);
  }

  getDataComponentsForAnalytic(analyticStixId: string): DataComponentInfo[] {
    const analytic = this.analyticMap.get(analyticStixId);
    if (!analytic) return [];
    
    return analytic.dataComponentRefs
      .map(id => this.dataComponentMap.get(id))
      .filter((dc): dc is DataComponentInfo => dc !== undefined);
  }

  private getParentTechniqueId(techniqueId: string): string | null {
    if (techniqueId.includes('.')) {
      return techniqueId.split('.')[0];
    }
    return null;
  }

  private getStrategiesForTechniqueWithFallback(techniqueId: string): string[] {
    const normalized = techniqueId.toUpperCase();
    let strategyStixIds = this.techniqueToStrategies.get(normalized) || [];
    
    if (strategyStixIds.length === 0) {
      const parentId = this.getParentTechniqueId(normalized);
      if (parentId) {
        strategyStixIds = this.techniqueToStrategies.get(parentId) || [];
      }
    }
    
    return strategyStixIds;
  }

  getFullMappingForTechniques(techniqueIds: string[]): {
    detectionStrategies: Array<{
      id: string;
      name: string;
      description: string;
      techniques: string[];
      analytics: Array<{
        id: string;
        name: string;
        description: string;
        platforms: string[];
        dataComponents: string[];
      }>;
      source: 'stix' | 'stix_parent';
    }>;
    dataComponents: Array<{
      id: string;
      name: string;
      dataSource: string;
    }>;
    carAnalytics: Array<{
      id: string;
      name: string;
      shortName: string;
      techniques: string[];
      fields: string[];
      coverage: string;
    }>;
    techniqueNames: Record<string, string>;
  } {
    const seenDataComponents = new Set<string>();
    const seenCarAnalytics = new Set<string>();
    
    const dataComponents: Array<{
      id: string;
      name: string;
      dataSource: string;
    }> = [];
    
    const carAnalytics: Array<{
      id: string;
      name: string;
      shortName: string;
      techniques: string[];
      fields: string[];
      coverage: string;
    }> = [];
    
    const strategyOutputMap = new Map<string, {
      id: string;
      name: string;
      description: string;
      techniques: Set<string>;
      analytics: Array<{
        id: string;
        name: string;
        description: string;
        platforms: string[];
        dataComponents: string[];
      }>;
      source: 'stix' | 'stix_parent';
    }>();
    
    for (const techId of techniqueIds) {
      const normalized = techId.toUpperCase();
      
      const directStrategyStixIds = this.techniqueToStrategies.get(normalized) || [];
      const usedParentFallback = directStrategyStixIds.length === 0;
      const strategyStixIds = this.getStrategiesForTechniqueWithFallback(normalized);
      
      for (const stratStixId of strategyStixIds) {
        if (strategyOutputMap.has(stratStixId)) {
          const existing = strategyOutputMap.get(stratStixId)!;
          existing.techniques.add(normalized);
          if (usedParentFallback && existing.source === 'stix') {
            existing.source = 'stix_parent';
          }
          continue;
        }
        
        const strategy = this.strategyMap.get(stratStixId);
        if (!strategy) continue;
        
        const analyticStixIds = this.strategyToAnalytics.get(stratStixId) || [];
        const analyticsForStrategy: Array<{
          id: string;
          name: string;
          description: string;
          platforms: string[];
          dataComponents: string[];
        }> = [];
        
        for (const analyticStixId of analyticStixIds) {
          const analytic = this.analyticMap.get(analyticStixId);
          if (!analytic) continue;
          
          const dcIds: string[] = [];
          for (const dcRef of analytic.dataComponentRefs) {
            const dc = this.dataComponentMap.get(dcRef);
            if (dc) {
              dcIds.push(dc.id);
              if (!seenDataComponents.has(dc.id)) {
                seenDataComponents.add(dc.id);
                dataComponents.push({
                  id: dc.id,
                  name: dc.name,
                  dataSource: dc.dataSourceName,
                });
              }
            }
          }
          
          analyticsForStrategy.push({
            id: analytic.id,
            name: analytic.name,
            description: analytic.description,
            platforms: analytic.platforms,
            dataComponents: dcIds,
          });
        }
        
        if (analyticsForStrategy.length > 0) {
          const techniquesSet = new Set(strategy.techniques);
          techniquesSet.add(normalized);
          
          strategyOutputMap.set(stratStixId, {
            id: strategy.id,
            name: strategy.name,
            description: strategy.description,
            techniques: techniquesSet,
            analytics: analyticsForStrategy,
            source: usedParentFallback ? 'stix_parent' : 'stix',
          });
        }
      }
      
      const techCarAnalytics = this.techniqueToCarAnalytics.get(normalized) || [];
      for (const carAnalytic of techCarAnalytics) {
        if (seenCarAnalytics.has(carAnalytic.name)) continue;
        seenCarAnalytics.add(carAnalytic.name);
        
        const techniques = carAnalytic.attack.map(a => a.technique.replace('Technique/', ''));
        const coverage = carAnalytic.attack.find(a => 
          a.technique.replace('Technique/', '').toUpperCase() === normalized
        )?.coverage || 'Unknown';
        
        carAnalytics.push({
          id: carAnalytic.name,
          name: carAnalytic.name,
          shortName: carAnalytic.shortName,
          techniques,
          fields: carAnalytic.fields,
          coverage,
        });
      }
    }
    
    const strategies = Array.from(strategyOutputMap.values()).map(s => ({
      ...s,
      techniques: Array.from(s.techniques),
    }));

    const techniqueNames: Record<string, string> = {};
    for (const techId of techniqueIds) {
      const tech = this.getTechnique(techId);
      if (tech) {
        techniqueNames[techId.toUpperCase()] = tech.name;
      }
    }
    
    return { detectionStrategies: strategies, dataComponents, carAnalytics, techniqueNames };
  }

  getStats(): { techniques: number; strategies: number; analytics: number; dataComponents: number; dataSources: number } {
    return {
      techniques: this.techniqueMap.size,
      strategies: this.strategyMap.size,
      analytics: this.analyticMap.size,
      dataComponents: this.dataComponentMap.size,
      dataSources: this.dataSourceMap.size,
    };
  }

  getTechniquesByPlatform(platformName: string): TechniqueInfo[] {
    const techniques: TechniqueInfo[] = [];
    const platformLower = platformName.toLowerCase();
    
    this.techniqueMap.forEach((tech) => {
      for (const platform of tech.platforms) {
        if (platform.toLowerCase().includes(platformLower) || platformLower.includes(platform.toLowerCase())) {
          techniques.push(tech);
          break;
        }
      }
    });
    
    return techniques;
  }

  getTechniquesByHybridSelector(selectorType: 'platform', selectorValue: string): string[] {
    return this.getTechniquesByPlatform(selectorValue).map(t => t.id);
  }

  /**
   * Tier 2 Inference: Get techniques by tactic and data component
   *
   * This is the core method for inferring techniques when a Sigma rule
   * only has a tactic tag (e.g., attack.execution) but no specific technique ID.
   *
   * Traversal Path:
   * 1. DataComponent (by name) → DataComponent STIX ID
   * 2. DataComponent STIX ID → Analytics (via dataComponentToAnalytics)
   * 3. Analytics → Strategies (via analyticToStrategies)
   * 4. Strategies → Techniques (via techniqueToStrategies reverse lookup)
   * 5. Filter by tactic
   *
   * @param tacticName - The tactic name (e.g., "execution", "persistence")
   * @param dataComponentName - The MITRE data component name (e.g., "Process Creation")
   * @returns Array of techniques that match both the tactic and require the data component
   */
  getTechniquesByTacticAndDataComponent(
    tacticName: string,
    dataComponentName: string
  ): TechniqueInfo[] {
    const results: TechniqueInfo[] = [];
    const seenTechniques = new Set<string>();
    const tacticLower = tacticName.toLowerCase().replace(/-/g, '-');

    // Step 1: Find data component STIX ID by name (case-insensitive)
    const dcNameLower = dataComponentName.toLowerCase();
    let targetDcStixId: string | null = null;

    this.dataComponentMap.forEach((dc, stixId) => {
      if (dc.name.toLowerCase() === dcNameLower) {
        targetDcStixId = stixId;
      }
    });

    if (!targetDcStixId) {
      // Data component not found - try partial match
      this.dataComponentMap.forEach((dc, stixId) => {
        if (dc.name.toLowerCase().includes(dcNameLower) || dcNameLower.includes(dc.name.toLowerCase())) {
          targetDcStixId = stixId;
        }
      });
    }

    if (!targetDcStixId) {
      console.warn(`[Tier 2] Data component not found: ${dataComponentName}`);
      return results;
    }

    // Step 2: Get all analytics that use this data component
    const analyticStixIds = this.dataComponentToAnalytics.get(targetDcStixId) || [];

    if (analyticStixIds.length === 0) {
      console.warn(`[Tier 2] No analytics found for data component: ${dataComponentName}`);
      return results;
    }

    // Step 3: Get all strategies that contain these analytics
    const strategyStixIds = new Set<string>();
    for (const analyticStixId of analyticStixIds) {
      const strategies = this.analyticToStrategies.get(analyticStixId) || [];
      for (const stratId of strategies) {
        strategyStixIds.add(stratId);
      }
    }

    // Step 4: Get all techniques detected by these strategies
    // We need to reverse-lookup techniqueToStrategies
    this.techniqueToStrategies.forEach((stratIds, techId) => {
      for (const stratId of stratIds) {
        if (strategyStixIds.has(stratId)) {
          const tech = this.techniqueMap.get(techId);
          if (tech && !seenTechniques.has(techId)) {
            // Step 5: Filter by tactic
            const tacticMatch = tech.tactics.some(t =>
              t.toLowerCase().replace(/_/g, '-') === tacticLower ||
              t.toLowerCase().replace(/-/g, '-') === tacticLower
            );

            if (tacticMatch) {
              seenTechniques.add(techId);
              results.push(tech);
            }
          }
          break;
        }
      }
    });

    // Fallback: If no results from strategy traversal, try direct data source matching
    if (results.length === 0) {
      const dcInfo = this.dataComponentMap.get(targetDcStixId);
      if (dcInfo) {
        const dsName = dcInfo.dataSourceName || dcInfo.name;

        this.techniqueMap.forEach((tech, techId) => {
          if (seenTechniques.has(techId)) return;

          // Check if technique's data sources contain this component
          const hasDataSource = tech.dataSources.some(ds =>
            ds.toLowerCase().includes(dcNameLower) ||
            ds.toLowerCase().includes(dsName.toLowerCase())
          );

          if (hasDataSource) {
            // Filter by tactic
            const tacticMatch = tech.tactics.some(t =>
              t.toLowerCase().replace(/_/g, '-') === tacticLower ||
              t.toLowerCase().replace(/-/g, '-') === tacticLower
            );

            if (tacticMatch) {
              seenTechniques.add(techId);
              results.push(tech);
            }
          }
        });
      }
    }

    console.log(`[Tier 2] Found ${results.length} techniques for tactic="${tacticName}" + dataComponent="${dataComponentName}"`);
    return results;
  }

  /**
   * Get data component info by name
   */
  getDataComponentByName(name: string): DataComponentInfo | null {
    const nameLower = name.toLowerCase();
    let result: DataComponentInfo | null = null;

    this.dataComponentMap.forEach((dc) => {
      if (dc.name.toLowerCase() === nameLower) {
        result = dc;
      }
    });

    return result;
  }

  /**
   * Get all data components (useful for debugging and map generation)
   */
  getAllDataComponents(): DataComponentInfo[] {
    return Array.from(this.dataComponentMap.values());
  }

  /**
   * Get all techniques by tactic (useful for debugging)
   */
  getTechniquesByTactic(tacticName: string): TechniqueInfo[] {
    const tacticLower = tacticName.toLowerCase().replace(/-/g, '-');
    const results: TechniqueInfo[] = [];

    this.techniqueMap.forEach((tech) => {
      const tacticMatch = tech.tactics.some(t =>
        t.toLowerCase().replace(/_/g, '-') === tacticLower ||
        t.toLowerCase().replace(/-/g, '-') === tacticLower
      );

      if (tacticMatch) {
        results.push(tech);
      }
    });

    return results;
  }
}

export const mitreKnowledgeGraph = new MitreKnowledgeGraph();
