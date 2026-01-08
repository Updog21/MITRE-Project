import { db } from '../db';
import { mitreAssets, detectionStrategies, analytics, dataComponents as dataComponentsTable } from '@shared/schema';
import { eq } from 'drizzle-orm';

const PLATFORM_MAPPINGS: Record<string, string[]> = {
  'azure ad': ['Identity Provider', 'SaaS'],
  'azure entra id': ['Identity Provider', 'SaaS'],
  'entra id': ['Identity Provider', 'SaaS'],
  'azure active directory': ['Identity Provider', 'SaaS'],
  'office 365': ['SaaS', 'Office Suite'],
  'o365': ['SaaS', 'Office Suite'],
  'microsoft 365': ['SaaS', 'Office Suite'],
  'm365': ['SaaS', 'Office Suite'],
  'aws': ['IaaS', 'SaaS'],
  'amazon web services': ['IaaS', 'SaaS'],
  'gcp': ['IaaS', 'SaaS'],
  'google cloud': ['IaaS', 'SaaS'],
  'azure': ['IaaS', 'SaaS'],
  'okta': ['Identity Provider', 'SaaS'],
  'google workspace': ['SaaS', 'Office Suite'],
  'salesforce': ['SaaS'],
  'kubernetes': ['Containers'],
  'k8s': ['Containers'],
  'docker': ['Containers'],
  'vmware': ['ESXi'],
  'esxi': ['ESXi'],
  'cisco': ['Network Devices'],
  'palo alto': ['Network Devices'],
  'fortinet': ['Network Devices'],
};

function normalizeProductPlatform(productPlatform: string): string[] {
  const lower = productPlatform.toLowerCase().trim();
  if (PLATFORM_MAPPINGS[lower]) {
    return PLATFORM_MAPPINGS[lower];
  }
  for (const [key, values] of Object.entries(PLATFORM_MAPPINGS)) {
    if (lower.includes(key) || key.includes(lower)) {
      return values;
    }
  }
  return [productPlatform];
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
  
  private techniqueMap: Map<string, TechniqueInfo> = new Map();
  private strategyMap: Map<string, StrategyInfo> = new Map();
  private analyticMap: Map<string, AnalyticInfo> = new Map();
  private dataComponentMap: Map<string, DataComponentInfo> = new Map();
  private dataSourceMap: Map<string, { id: string; name: string }> = new Map();
  
  private techniqueToStrategies: Map<string, string[]> = new Map();
  private strategyToAnalytics: Map<string, string[]> = new Map();
  private analyticToDataComponents: Map<string, string[]> = new Map();
  private techniqueToAssets: Map<string, string[]> = new Map();
  
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
      const response = await fetch(this.stixUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch STIX data: ${response.status}`);
      }
      
      const stixBundle: StixBundle = await response.json();
      console.log(`[-] Loaded ${stixBundle.objects.length} STIX objects`);
      
      this.buildIndexes(stixBundle);
      this.initialized = true;
      
      console.log('[+] MITRE Knowledge Graph Ingestion Complete');
      console.log(`    Techniques: ${this.techniqueMap.size}`);
      console.log(`    Detection Strategies: ${this.strategyMap.size}`);
      console.log(`    Analytics: ${this.analyticMap.size}`);
      console.log(`    Data Components: ${this.dataComponentMap.size}`);
      console.log(`    Data Sources: ${this.dataSourceMap.size}`);
    } catch (error) {
      console.error('[!] Failed to ingest MITRE STIX data:', error);
      throw error;
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
          this.dataComponentMap.set(stixObj.id, {
            id: stixObj.id,
            stixId: stixObj.id,
            name: stixObj.name || '',
            description: stixObj.description || '',
            dataSourceId: stixObj.x_mitre_data_source_ref || '',
            dataSourceName: '',
          });
          break;
          
        case 'x-mitre-data-source':
          if (externalId) {
            this.dataSourceMap.set(stixObj.id, {
              id: externalId,
              name: stixObj.name || '',
            });
          }
          break;
      }
    }
    
    this.dataComponentMap.forEach((dc, dcId) => {
      const ds = this.dataSourceMap.get(dc.dataSourceId);
      if (ds) {
        dc.dataSourceName = ds.name;
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
      
      if (rel.relationship_type === 'targets' && rel.source_ref.includes('attack-pattern')) {
        const techInfo = this.findTechniqueByStixId(rel.source_ref);
        if (techInfo) {
          if (!this.techniqueToAssets.has(techInfo.id)) {
            this.techniqueToAssets.set(techInfo.id, []);
          }
          this.techniqueToAssets.get(techInfo.id)!.push(rel.target_ref);
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

  getAssetsTargetedByTechnique(techniqueId: string): string[] {
    const normalized = techniqueId.toUpperCase();
    return this.techniqueToAssets.get(normalized) || [];
  }

  getFullMappingForTechniques(techniqueIds: string[], platform?: string): {
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
    }>;
    dataComponents: Array<{
      id: string;
      name: string;
      dataSource: string;
    }>;
  } {
    const seenStrategies = new Set<string>();
    const seenDataComponents = new Set<string>();
    
    const strategies: Array<{
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
    }> = [];
    
    const dataComponents: Array<{
      id: string;
      name: string;
      dataSource: string;
    }> = [];
    
    for (const techId of techniqueIds) {
      const normalized = techId.toUpperCase();
      const strategyStixIds = this.techniqueToStrategies.get(normalized) || [];
      
      for (const stratStixId of strategyStixIds) {
        if (seenStrategies.has(stratStixId)) continue;
        seenStrategies.add(stratStixId);
        
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
          
          if (platform && analytic.platforms.length > 0) {
            const normalizedPlatforms = normalizeProductPlatform(platform);
            const hasMatchingPlatform = analytic.platforms.some(analyticPlatform => {
              const analyticPlatformLower = analyticPlatform.toLowerCase();
              return normalizedPlatforms.some(np => 
                np.toLowerCase() === analyticPlatformLower ||
                analyticPlatformLower.includes(np.toLowerCase()) ||
                np.toLowerCase().includes(analyticPlatformLower)
              );
            });
            if (!hasMatchingPlatform) continue;
          }
          
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
          strategies.push({
            id: strategy.id,
            name: strategy.name,
            description: strategy.description,
            techniques: strategy.techniques,
            analytics: analyticsForStrategy,
          });
        }
      }
    }
    
    return { detectionStrategies: strategies, dataComponents };
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
}

export const mitreKnowledgeGraph = new MitreKnowledgeGraph();
