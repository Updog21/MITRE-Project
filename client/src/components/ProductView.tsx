import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Asset, getDetectionStrategiesForProduct, dataComponents, techniques, DetectionStrategy, AnalyticItem, DataComponentRef, mitreAssets, MitreAsset, getCTIDAnalyticsForTechniques, CTIDAnalyticMatch } from '@/lib/mitreData';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronRight,
  ExternalLink,
  Database,
  Layers,
  Terminal,
  Monitor,
  Cloud,
  ArrowLeft,
  Shield,
  X,
  Info,
  FileText,
  Zap,
  Loader2,
  AlertCircle,
  Globe,
  Network,
  Box,
  Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAutoMappingWithAutoRun, RESOURCE_LABELS, ResourceType } from '@/hooks/useAutoMapper';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';
import { HybridSelector } from './HybridSelector';

interface ProductViewProps {
  product: Asset;
  onBack: () => void;
}

const PLATFORM_ICON_MAP: Record<string, React.ReactNode> = {
  'Windows': <Monitor className="w-4 h-4" />,
  'macOS': <Monitor className="w-4 h-4" />,
  'Linux': <Terminal className="w-4 h-4" />,
  'PRE': <Shield className="w-4 h-4" />,
  'Office Suite': <Database className="w-4 h-4" />,
  'Office 365': <Database className="w-4 h-4" />,
  'Identity Provider': <Shield className="w-4 h-4" />,
  'SaaS': <Globe className="w-4 h-4" />,
  'IaaS': <Cloud className="w-4 h-4" />,
  'Network': <Network className="w-4 h-4" />,
  'Network Devices': <Network className="w-4 h-4" />,
  'Containers': <Box className="w-4 h-4" />,
  'ESXi': <Server className="w-4 h-4" />,
  'Azure AD': <Cloud className="w-4 h-4" />,
};

const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  'Windows': 'Windows',
  'Linux': 'Linux',
  'macOS': 'macOS',
  'Identity Provider': 'Identity Provider',
  'IaaS': 'Cloud Infrastructure',
  'SaaS': 'SaaS Application',
  'Containers': 'Container / Kubernetes',
  'Network': 'Network Devices',
  'Office 365': 'Office Suite',
  'ESXi': 'ESXi / VMware',
};

function getPlatformIcon(platform: string) {
  return PLATFORM_ICON_MAP[platform] || <Monitor className="w-4 h-4" />;
}

function getPlatformDisplayName(platform: string) {
  return PLATFORM_DISPLAY_NAMES[platform] || platform;
}

const PLATFORM_ALIASES: Record<string, string[]> = {
  'Windows': ['Windows'],
  'Linux': ['Linux'],
  'macOS': ['macOS'],
  'Network': ['Network', 'Network Devices'],
  'IaaS': ['IaaS', 'Azure AD', 'AWS', 'GCP', 'Google Workspace'],
  'SaaS': ['SaaS', 'Office 365', 'Google Workspace'],
  'Containers': ['Containers', 'Kubernetes'],
  'Identity Provider': ['Identity Provider', 'Azure AD', 'Okta', 'Office 365'],
  'Office 365': ['Office 365', 'SaaS'],
  'ESXi': ['ESXi', 'VMware'],
};

function platformMatchesAny(analyticPlatforms: string[], selectedPlatforms: string[]): boolean {
  for (const selected of selectedPlatforms) {
    const aliases = PLATFORM_ALIASES[selected] || [selected];
    for (const alias of aliases) {
      if (analyticPlatforms.some(ap => 
        ap.toLowerCase().includes(alias.toLowerCase()) || 
        alias.toLowerCase().includes(ap.toLowerCase())
      )) {
        return true;
      }
    }
  }
  return false;
}

interface LogSourceRow {
  dataComponentId: string;
  dataComponentName: string;
  logSourceName: string;
  channel: string;
}

interface MutableElementRow {
  field: string;
  description: string;
}

function getPlatformPrefixes(platform: string): string[] {
  switch (platform) {
    case 'Windows': return ['WinEventLog:', 'windows:'];
    case 'Linux': return ['auditd:', 'linux:', 'ebpf:'];
    case 'macOS': return ['macos:'];
    case 'ESXi': return ['esxi:'];
    case 'Azure AD': return ['azuread:', 'AWS:', 'azure:'];
    default: return [];
  }
}

function DataComponentDetail({ 
  dc, 
  platform, 
  onClose 
}: { 
  dc: DataComponentRef; 
  platform: string; 
  onClose: () => void;
}) {
  const prefixes = getPlatformPrefixes(platform);
  
  const filteredLogSources = dc.logSources?.filter(ls => 
    prefixes.some(prefix => ls.name.toLowerCase().startsWith(prefix.toLowerCase()))
  ) || [];
  
  const platformMeasure = dc.dataCollectionMeasures?.find(m => m.platform === platform);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-background border border-border rounded-lg max-w-3xl w-full max-h-[85vh] overflow-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <code className="text-sm text-primary font-mono">{dc.id}</code>
              <Badge variant="secondary" className="text-xs">{platform}</Badge>
            </div>
            <h2 className="text-xl font-semibold text-foreground">{dc.name}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-md transition-colors"
            data-testid="button-close-dc-detail"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <p className="text-foreground leading-relaxed">{dc.description}</p>
          </div>

          {platformMeasure && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                Data Collection Measures ({platform})
              </h3>
              <div className="bg-muted/30 border border-border rounded-md p-4">
                <p className="text-sm text-foreground">{platformMeasure.description}</p>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              Log Sources ({platform})
            </h3>
            {filteredLogSources.length > 0 ? (
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Channel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredLogSources.map((ls, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 font-mono text-foreground">{ls.name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{ls.channel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-4 text-center">
                No log sources defined for {platform} in this data component.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border">
            <a
              href={`https://attack.mitre.org/datasources/${dc.dataSource.replace(/\s+/g, '%20')}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View on MITRE ATT&CK
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProductData {
  id: string;
  hybridSelectorType: 'platform' | null;
  hybridSelectorValues: string[] | null;
}

export function ProductView({ product, onBack }: ProductViewProps) {
  const [expandedStrategies, setExpandedStrategies] = useState<Set<string>>(new Set());
  const [expandedAnalytics, setExpandedAnalytics] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState('overview');
  const [selectedDataComponent, setSelectedDataComponent] = useState<DataComponentRef | null>(null);
  const [selectedMitreAsset, setSelectedMitreAsset] = useState<MitreAsset | null>(null);
  const [sourceFilters, setSourceFilters] = useState<Set<ResourceType>>(() => new Set<ResourceType>(['ctid', 'sigma', 'elastic', 'splunk']));
  const [showSourceFilter, setShowSourceFilter] = useState(false);
  
  const platform = product.platforms[0];
  
  const { data: productData, refetch: refetchProduct } = useQuery<ProductData>({
    queryKey: ['product', product.id],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product.id}`);
      if (!res.ok) throw new Error('Failed to fetch product');
      return res.json();
    },
    staleTime: 30 * 1000,
  });
  
  const allPlatforms = useMemo(() => {
    const platforms = new Set<string>(product.platforms || []);
    (productData?.hybridSelectorValues || []).forEach(p => platforms.add(p));
    return Array.from(platforms);
  }, [product.platforms, productData?.hybridSelectorValues]);

  const autoMapping = useAutoMappingWithAutoRun(
    product.id, 
    platform,
    allPlatforms.length > 0 ? allPlatforms : null
  );
  
  useEffect(() => {
    if (autoMapping.shouldAutoRun) {
      autoMapping.triggerAutoRun();
    }
  }, [autoMapping.shouldAutoRun]);
  
  const strategies = getDetectionStrategiesForProduct(product.id);

  const getLogSourcesForAnalytic = (analytic: AnalyticItem, targetPlatforms?: string[]): LogSourceRow[] => {
    const rows: LogSourceRow[] = [];
    const platformsToUse = targetPlatforms && targetPlatforms.length > 0 ? targetPlatforms : [platform];
    const allPrefixes = platformsToUse.flatMap(p => getPlatformPrefixes(p));
    
    analytic.dataComponents.forEach((dcId: string) => {
      const dc = dataComponents[dcId];
      if (!dc) return;
      
      if (dc.logSources && dc.logSources.length > 0) {
        const filteredSources = dc.logSources.filter(ls => 
          allPrefixes.some(prefix => ls.name.toLowerCase().startsWith(prefix.toLowerCase()))
        );
        filteredSources.forEach(ls => {
          rows.push({
            dataComponentId: dc.id,
            dataComponentName: dc.name,
            logSourceName: ls.name,
            channel: ls.channel,
          });
        });
      } else {
        const platformMappings = dc.platforms.filter(p => platformsToUse.includes(p.platform));
        platformMappings.forEach(mapping => {
          rows.push({
            dataComponentId: dc.id,
            dataComponentName: dc.name,
            logSourceName: mapping.logSourceName,
            channel: mapping.logChannel || '-',
          });
        });
      }
    });
    
    return rows;
  };

  const getMutableElementsForAnalytic = (analytic: AnalyticItem): MutableElementRow[] => {
    const seen = new Set<string>();
    const rows: MutableElementRow[] = [];
    
    analytic.dataComponents.forEach((dcId: string) => {
      const dc = dataComponents[dcId];
      if (!dc) return;
      
      dc.mutableElements.forEach(me => {
        if (!seen.has(me.name)) {
          seen.add(me.name);
          rows.push({
            field: me.name,
            description: me.description,
          });
        }
      });
    });
    
    return rows;
  };

  const filteredStrategies = useMemo(() => {
    return strategies.map(strategy => ({
      ...strategy,
      analytics: strategy.analytics.filter(a => 
        platformMatchesAny(a.platforms, allPlatforms)
      )
    })).filter(s => s.analytics.length > 0);
  }, [strategies, allPlatforms]);

  const totalAnalytics = filteredStrategies.reduce((sum, s) => sum + s.analytics.length, 0);
  
  const techniqueSources = useMemo(() => {
    return autoMapping.enrichedMapping?.techniqueSources || {};
  }, [autoMapping.enrichedMapping?.techniqueSources]);

  const availableSources = useMemo(() => {
    const sources = new Set<ResourceType>();
    Object.values(techniqueSources).forEach(srcList => {
      srcList.forEach(src => sources.add(src));
    });
    return Array.from(sources).filter(s => s !== 'mitre_stix') as ResourceType[];
  }, [techniqueSources]);

  const getSourcesForStrategy = (strategy: { techniques: string[] }): ResourceType[] => {
    const sources = new Set<ResourceType>();
    strategy.techniques.forEach(techId => {
      const techSources = techniqueSources[techId] || [];
      techSources.forEach(src => {
        if (src !== 'mitre_stix') sources.add(src);
      });
    });
    return Array.from(sources);
  };

  const filteredCommunityStrategies = useMemo(() => {
    if (!autoMapping.enrichedMapping?.detectionStrategies) return [];
    const hasTechniqueSources = Object.keys(techniqueSources).length > 0;
    return autoMapping.enrichedMapping.detectionStrategies.map(strategy => ({
      ...strategy,
      analytics: strategy.analytics.filter(a => 
        platformMatchesAny(a.platforms, allPlatforms)
      )
    })).filter(s => s.analytics.length > 0).filter(s => {
      if (!hasTechniqueSources) return true;
      const strategySources = getSourcesForStrategy(s);
      if (strategySources.length === 0) return true;
      return strategySources.some(src => sourceFilters.has(src));
    });
  }, [autoMapping.enrichedMapping?.detectionStrategies, allPlatforms, sourceFilters, techniqueSources]);

  const communityStrategiesCount = filteredCommunityStrategies.length;
  const communityAnalyticsCount = filteredCommunityStrategies.reduce(
    (sum, s) => sum + s.analytics.length, 0
  );
  
  const coveredTechniques = useMemo(() => {
    const techIds = new Set<string>();
    filteredStrategies.forEach(s => s.techniques.forEach(t => techIds.add(t)));
    filteredCommunityStrategies.forEach(s => s.techniques.forEach(t => techIds.add(t)));
    return techniques.filter(t => techIds.has(t.id));
  }, [filteredStrategies, filteredCommunityStrategies]);

  const coverageScore = Math.min(100, (totalAnalytics + communityAnalyticsCount) * 15 + (filteredStrategies.length + communityStrategiesCount) * 10);

  const toggleStrategy = (id: string) => {
    setExpandedStrategies(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAnalytic = (id: string) => {
    setExpandedAnalytics(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tocItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'coverage', label: 'Coverage Summary' },
    { id: 'detection-strategies', label: 'Detection Strategies' },
    { id: 'community-coverage', label: 'Community Coverage' },
  ];

  return (
    <div className="flex">
      <div className="flex-1 max-w-4xl">
        <div className="p-8">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <button 
              onClick={onBack} 
              className="hover:text-foreground transition-colors flex items-center gap-1"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
              Products
            </button>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground">{product.productName}</span>
          </nav>

          <header className="mb-8" id="overview">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="text-xs">
                {getPlatformIcon(platform)}
                <span className="ml-1">{platform}</span>
              </Badge>
              <Badge variant="outline" className="text-xs">
                CTID Native
              </Badge>
              {autoMapping.isAutoRunning && (
                <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Auto-mapping...
                </Badge>
              )}
              {product.deployment && (
                <Badge variant="outline" className="text-xs">
                  {product.deployment}
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-semibold text-foreground mb-2">{product.productName}</h1>
            <p className="text-lg text-muted-foreground">{product.description}</p>
            
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-border bg-muted/30">
                <div className="text-2xl font-semibold text-foreground">
                  {filteredStrategies.length + communityStrategiesCount}
                </div>
                <div className="text-sm text-muted-foreground">Detection Strategies</div>
              </div>
              <div className="p-4 rounded-lg border border-border bg-muted/30">
                <div className="text-2xl font-semibold text-foreground">
                  {totalAnalytics + communityAnalyticsCount}
                </div>
                <div className="text-sm text-muted-foreground">Analytics</div>
              </div>
              <div className="p-4 rounded-lg border border-border bg-muted/30">
                <div className="text-2xl font-semibold text-foreground">{coveredTechniques.length}</div>
                <div className="text-sm text-muted-foreground">Techniques Covered</div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-border bg-card">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Mapped MITRE Platforms
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  This product applies to the following platforms:
                </p>
                <div className="flex flex-wrap gap-2">
                  {(product.platforms || []).map(platformName => (
                    <div
                      key={platformName}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-muted/50 text-sm"
                      data-testid={`chip-platform-${platformName.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {getPlatformIcon(platformName)}
                      <span className="text-foreground">{platformName}</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">Enterprise</Badge>
                    </div>
                  ))}
                  {(productData?.hybridSelectorValues || [])
                    .filter(p => !(product.platforms || []).includes(p))
                    .map(platformName => (
                    <div
                      key={`overlay-${platformName}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-sm"
                      data-testid={`chip-platform-overlay-${platformName.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {getPlatformIcon(platformName)}
                      <span className="text-amber-400">{getPlatformDisplayName(platformName)}</span>
                      <Badge className="text-[10px] px-1 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30">Overlay</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border bg-card">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  Mapped Data Components
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  This asset provides the following telemetry sources:
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.dataComponentIds.map(dcId => {
                    const dc = dataComponents[dcId];
                    return dc ? (
                      <button
                        key={dcId}
                        onClick={() => setSelectedDataComponent(dc)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-muted/50 hover:bg-muted hover:border-primary/30 transition-colors text-sm"
                        data-testid={`button-dc-chip-${dcId}`}
                      >
                        <code className="text-xs text-primary font-mono">{dcId}</code>
                        <span className="text-foreground">{dc.name}</span>
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
            </div>

          </header>

          <section className="mb-10" id="hybrid-selector">
            <HybridSelector
              productId={product.id}
              currentType={productData?.hybridSelectorType || null}
              currentValues={productData?.hybridSelectorValues || null}
              onRerun={() => {
                refetchProduct();
                autoMapping.triggerAutoRun();
              }}
              isLoading={autoMapping.isAutoRunning}
            />
          </section>

          <section className="mb-10" id="coverage">
            <h2 className="text-xl font-semibold text-foreground mb-4">Coverage Summary</h2>
            
            <div className="p-6 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Detection Coverage</div>
                  <div className="text-4xl font-bold text-foreground">{coverageScore}%</div>
                </div>
              </div>
              
              <Progress value={coverageScore} className="h-2 mb-6" />
              
              <p className="text-sm text-muted-foreground mb-6">
                This product maps to <strong className="text-foreground">{filteredStrategies.length + communityStrategiesCount} detection strategies</strong> for {platform}, 
                containing <strong className="text-foreground">{totalAnalytics + communityAnalyticsCount} analytics</strong> that 
                cover <strong className="text-foreground">{coveredTechniques.length} ATT&CK techniques</strong>.
              </p>

              {coveredTechniques.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <h4 className="text-sm font-medium text-foreground mb-3">Covered Techniques</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {coveredTechniques.map(t => (
                      <a
                        key={t.id}
                        href={`https://attack.mitre.org/techniques/${t.id.replace('.', '/')}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors group"
                      >
                        <code className="text-xs font-mono text-red-600">{t.id}</code>
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors truncate">{t.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section id="detection-strategies">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Detection Strategies
            </h2>
            <p className="text-muted-foreground mb-6">
              CTID detection strategies mapped to {product.productName} for {platform}. Each strategy contains analytics with their required log sources and mutable elements.
            </p>

            {filteredStrategies.length > 0 ? (
              <div className="space-y-4">
                {filteredStrategies.map((strategy) => {
                  const isStrategyExpanded = expandedStrategies.has(strategy.id);
                  
                  return (
                    <div key={strategy.id} className="border border-border rounded-lg overflow-hidden bg-card">
                      <button
                        onClick={() => toggleStrategy(strategy.id)}
                        className="w-full px-4 py-4 text-left flex items-center gap-4 hover:bg-muted/50 transition-colors"
                        data-testid={`button-expand-strategy-${strategy.id}`}
                      >
                        <ChevronRight className={cn(
                          "w-5 h-5 text-muted-foreground transition-transform flex-shrink-0",
                          isStrategyExpanded && "rotate-90"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-xs text-primary font-mono">{strategy.id}</code>
                            <span className="font-semibold text-foreground">{strategy.name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">{strategy.description}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            {strategy.analytics.length} Analytics
                          </Badge>
                        </div>
                      </button>

                      {isStrategyExpanded && (
                        <div className="border-t border-border">
                          <div className="px-6 py-4 bg-muted/20">
                            <p className="text-sm text-muted-foreground mb-4">{strategy.description}</p>

                            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                              <Layers className="w-4 h-4 text-primary" />
                              Analytics ({strategy.analytics.length})
                            </h4>
                            
                            <div className="space-y-3">
                              {strategy.analytics.map((analytic) => {
                                const isAnalyticExpanded = expandedAnalytics.has(analytic.id);
                                const logSources = getLogSourcesForAnalytic(analytic);
                                const mutableElements = getMutableElementsForAnalytic(analytic);

                                return (
                                  <div key={analytic.id} className="border border-border rounded-md overflow-hidden bg-background">
                                    <button
                                      onClick={() => toggleAnalytic(analytic.id)}
                                      className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-muted/30 transition-colors"
                                      data-testid={`button-expand-analytic-${analytic.id}`}
                                    >
                                      <ChevronRight className={cn(
                                        "w-4 h-4 text-muted-foreground transition-transform flex-shrink-0",
                                        isAnalyticExpanded && "rotate-90"
                                      )} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <code className="text-xs text-primary font-mono">{analytic.id}</code>
                                          <span className="font-medium text-foreground">{analytic.name}</span>
                                        </div>
                                      </div>
                                      <Badge variant="outline" className="text-xs">
                                        {logSources.length} Log Sources
                                      </Badge>
                                    </button>

                                    {isAnalyticExpanded && (
                                      <div className="px-4 pb-4 pt-2 border-t border-border space-y-5">
                                        <div>
                                          <h5 className="text-sm font-medium text-muted-foreground mb-2">Description</h5>
                                          <p className="text-sm text-foreground">{analytic.description}</p>
                                        </div>

                                        {strategy.techniques.length > 0 && (
                                          <div>
                                            <h5 className="text-sm font-medium text-muted-foreground mb-2">Techniques</h5>
                                            <div className="flex flex-wrap gap-1">
                                              {strategy.techniques.map(techId => (
                                                <a
                                                  key={techId}
                                                  href={`https://attack.mitre.org/techniques/${techId.replace('.', '/')}/`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                >
                                                  <Badge variant="outline" className="text-xs hover:bg-muted/50 transition-colors">
                                                    <code className="text-red-600 mr-1">{techId}</code>
                                                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                                  </Badge>
                                                </a>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        <div>
                                          <h5 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                            <Database className="w-4 h-4" />
                                            Log Sources
                                          </h5>
                                          <div className="border border-border rounded-md overflow-hidden">
                                            <table className="w-full text-sm">
                                              <thead className="bg-muted/50">
                                                <tr>
                                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Data Component</th>
                                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Channel</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-border">
                                                {logSources.map((row, idx) => (
                                                  <tr key={`${row.dataComponentId}-${idx}`}>
                                                    <td className="px-3 py-2">
                                                      <button
                                                        onClick={() => {
                                                          const dc = dataComponents[row.dataComponentId];
                                                          if (dc) setSelectedDataComponent(dc);
                                                        }}
                                                        className="text-primary hover:underline text-left"
                                                        data-testid={`button-view-dc-${row.dataComponentId}`}
                                                      >
                                                        {row.dataComponentName}
                                                        <span className="text-muted-foreground ml-1">({row.dataComponentId})</span>
                                                      </button>
                                                    </td>
                                                    <td className="px-3 py-2 font-mono text-foreground">{row.logSourceName}</td>
                                                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.channel}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>

                                        {mutableElements.length > 0 && (
                                          <div>
                                            <h5 className="text-sm font-medium text-muted-foreground mb-2">Mutable Elements</h5>
                                            <div className="border border-border rounded-md overflow-hidden">
                                              <table className="w-full text-sm">
                                                <thead className="bg-muted/50">
                                                  <tr>
                                                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-48">Field</th>
                                                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                  {mutableElements.map(me => (
                                                    <tr key={me.field}>
                                                      <td className="px-3 py-2 font-mono text-primary">{me.field}</td>
                                                      <td className="px-3 py-2 text-foreground">{me.description}</td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        )}

                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg">
                No detection strategies found for {product.productName} on {platform}.
              </div>
            )}
          </section>

          {/* Additional Coverage from Community Resources */}
          <section id="community-coverage" className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Additional Coverage from Community Resources
                {availableSources.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {communityStrategiesCount} Strategies / {communityAnalyticsCount} Analytics
                  </Badge>
                )}
              </h2>
              {availableSources.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowSourceFilter(!showSourceFilter)}
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Filter className="w-4 h-4" />
                  Filter Sources
                </Button>
              )}
            </div>
            
            {showSourceFilter && availableSources.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2 items-center">
                <span className="text-sm text-muted-foreground mr-1">Show from:</span>
                {(['sigma', 'elastic', 'splunk', 'ctid'] as ResourceType[]).filter(s => availableSources.includes(s)).map(source => {
                  const isActive = sourceFilters.has(source);
                  const sourceConfig = RESOURCE_LABELS[source];
                  return (
                    <Button
                      key={source}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const newFilters = new Set(sourceFilters);
                        if (isActive) {
                          newFilters.delete(source);
                        } else {
                          newFilters.add(source);
                        }
                        setSourceFilters(newFilters);
                      }}
                      className={cn(
                        "text-xs h-7",
                        isActive && source === 'sigma' && "bg-purple-600 hover:bg-purple-700",
                        isActive && source === 'elastic' && "bg-orange-600 hover:bg-orange-700",
                        isActive && source === 'splunk' && "bg-green-600 hover:bg-green-700",
                        isActive && source === 'ctid' && "bg-blue-600 hover:bg-blue-700"
                      )}
                    >
                      {sourceConfig?.label || source}
                    </Button>
                  );
                })}
              </div>
            )}
            
            <p className="text-muted-foreground mb-6">
              Detection strategies derived from techniques discovered in community detection rules (Sigma, Elastic, Splunk).
            </p>

            {autoMapping.isLoading && (
              <div className="py-8 text-center border border-dashed border-border rounded-lg">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-muted-foreground">Querying community resources...</p>
              </div>
            )}

            {filteredCommunityStrategies.length > 0 && (
              <div className="space-y-4">
                {filteredCommunityStrategies.map((strategy) => {
                  const isStrategyExpanded = expandedStrategies.has(`community-${strategy.id}`);
                  const stixDataComponents = autoMapping.enrichedMapping?.dataComponents || [];
                  const strategySources = getSourcesForStrategy(strategy);
                  
                  return (
                    <div key={`community-${strategy.id}`} className="border border-border rounded-lg overflow-hidden bg-card">
                      <button
                        onClick={() => toggleStrategy(`community-${strategy.id}`)}
                        className="w-full px-4 py-4 text-left flex items-center gap-4 hover:bg-muted/50 transition-colors"
                        data-testid={`button-expand-community-strategy-${strategy.id}`}
                      >
                        <ChevronRight className={cn(
                          "w-5 h-5 text-muted-foreground transition-transform flex-shrink-0",
                          isStrategyExpanded && "rotate-90"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-xs text-primary font-mono">{strategy.id}</code>
                            <span className="font-semibold text-foreground">{strategy.name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">{strategy.description}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            {strategy.analytics.length} Analytics
                          </Badge>
                          {strategySources.map(source => (
                            <Badge 
                              key={source} 
                              className={cn(
                                "text-xs text-white",
                                source === 'sigma' && "bg-purple-600",
                                source === 'elastic' && "bg-orange-600",
                                source === 'splunk' && "bg-green-600",
                                source === 'ctid' && "bg-blue-600"
                              )}
                            >
                              {source === 'sigma' ? 'Sigma' : source === 'elastic' ? 'Elastic' : source === 'splunk' ? 'Splunk' : 'CTID'}
                            </Badge>
                          ))}
                        </div>
                      </button>

                      {isStrategyExpanded && (
                        <div className="border-t border-border">
                          <div className="px-6 py-4 bg-muted/20">
                            <p className="text-sm text-muted-foreground mb-4">{strategy.description}</p>

                            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                              <Layers className="w-4 h-4 text-primary" />
                              Analytics ({strategy.analytics.length})
                            </h4>
                            
                            <div className="space-y-3">
                              {strategy.analytics.map((analytic) => {
                                const isAnalyticExpanded = expandedAnalytics.has(`community-${analytic.id}`);
                                const analyticDataComponents = analytic.dataComponents
                                  .map(dcId => stixDataComponents.find(dc => dc.id === dcId))
                                  .filter(Boolean);
                                
                                const analyticPlatforms = analytic.platforms.length > 0 ? analytic.platforms : allPlatforms;
                                const ctidMatches = getCTIDAnalyticsForTechniques(strategy.techniques, analyticPlatforms);
                                
                                const enrichedLogSources = ctidMatches.flatMap(match => getLogSourcesForAnalytic(match.analytic, analyticPlatforms));
                                const enrichedMutableElements = ctidMatches.flatMap(match => getMutableElementsForAnalytic(match.analytic));
                                const uniqueLogSources = enrichedLogSources.filter((ls, idx, arr) => 
                                  arr.findIndex(x => x.dataComponentId === ls.dataComponentId && x.logSourceName === ls.logSourceName) === idx
                                );
                                const uniqueMutableElements = enrichedMutableElements.filter((me, idx, arr) =>
                                  arr.findIndex(x => x.field === me.field) === idx
                                );
                                const hasCTIDEnrichment = uniqueLogSources.length > 0 || uniqueMutableElements.length > 0;

                                return (
                                  <div key={`community-${analytic.id}`} className="border border-border rounded-md overflow-hidden bg-background">
                                    <button
                                      onClick={() => toggleAnalytic(`community-${analytic.id}`)}
                                      className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-muted/30 transition-colors"
                                      data-testid={`button-expand-community-analytic-${analytic.id}`}
                                    >
                                      <ChevronRight className={cn(
                                        "w-4 h-4 text-muted-foreground transition-transform flex-shrink-0",
                                        isAnalyticExpanded && "rotate-90"
                                      )} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <code className="text-xs text-primary font-mono">{analytic.id}</code>
                                          <span className="font-medium text-foreground">{analytic.name}</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {hasCTIDEnrichment && (
                                          <Badge className="text-xs bg-blue-600 text-white">+CTID</Badge>
                                        )}
                                        <Badge variant="outline" className="text-xs">
                                          {analyticDataComponents.length} Data Components
                                        </Badge>
                                      </div>
                                    </button>

                                    {isAnalyticExpanded && (
                                      <div className="px-4 pb-4 pt-2 border-t border-border space-y-5">
                                        <div>
                                          <h5 className="text-sm font-medium text-muted-foreground mb-2">Description</h5>
                                          <p className="text-sm text-foreground">{analytic.description}</p>
                                        </div>

                                        {analytic.platforms.length > 0 && (
                                          <div>
                                            <h5 className="text-sm font-medium text-muted-foreground mb-2">Platforms</h5>
                                            <div className="flex flex-wrap gap-1">
                                              {analytic.platforms.map(p => (
                                                <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {strategy.techniques.length > 0 && (
                                          <div>
                                            <h5 className="text-sm font-medium text-muted-foreground mb-2">Techniques</h5>
                                            <div className="flex flex-wrap gap-1">
                                              {strategy.techniques.map(techId => (
                                                <a
                                                  key={techId}
                                                  href={`https://attack.mitre.org/techniques/${techId.replace('.', '/')}/`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                >
                                                  <Badge variant="outline" className="text-xs hover:bg-muted/50 transition-colors">
                                                    <code className="text-red-600 mr-1">{techId}</code>
                                                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                                  </Badge>
                                                </a>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        <div>
                                          <h5 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                            <Database className="w-4 h-4" />
                                            Data Components
                                          </h5>
                                          <div className="border border-border rounded-md overflow-hidden">
                                            <table className="w-full text-sm">
                                              <thead className="bg-muted/50">
                                                <tr>
                                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Data Component</th>
                                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Data Source</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-border">
                                                {analyticDataComponents.map((dc, idx) => (
                                                  <tr key={idx}>
                                                    <td className="px-3 py-2 text-foreground">{dc?.name || 'Unknown'}</td>
                                                    <td className="px-3 py-2 text-muted-foreground">{dc?.dataSource || '-'}</td>
                                                  </tr>
                                                ))}
                                                {analyticDataComponents.length === 0 && (
                                                  <tr>
                                                    <td colSpan={2} className="px-3 py-2 text-muted-foreground italic">No data components defined</td>
                                                  </tr>
                                                )}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>

                                        {uniqueLogSources.length > 0 && (
                                          <div>
                                            <h5 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                              <Database className="w-4 h-4" />
                                              Log Sources <Badge className="text-xs bg-blue-600 text-white ml-1">CTID</Badge>
                                            </h5>
                                            <div className="border border-border rounded-md overflow-hidden">
                                              <table className="w-full text-sm">
                                                <thead className="bg-muted/50">
                                                  <tr>
                                                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Data Component</th>
                                                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                                                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Channel</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                  {uniqueLogSources.map((row, idx) => (
                                                    <tr key={`${row.dataComponentId}-${idx}`}>
                                                      <td className="px-3 py-2">
                                                        <button
                                                          onClick={() => {
                                                            const dc = dataComponents[row.dataComponentId];
                                                            if (dc) setSelectedDataComponent(dc);
                                                          }}
                                                          className="text-primary hover:underline text-left"
                                                          data-testid={`button-view-dc-community-${row.dataComponentId}`}
                                                        >
                                                          {row.dataComponentName}
                                                          <span className="text-muted-foreground ml-1">({row.dataComponentId})</span>
                                                        </button>
                                                      </td>
                                                      <td className="px-3 py-2 font-mono text-foreground">{row.logSourceName}</td>
                                                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.channel}</td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        )}

                                        {uniqueMutableElements.length > 0 && (
                                          <div>
                                            <h5 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                              Mutable Elements <Badge className="text-xs bg-blue-600 text-white ml-1">CTID</Badge>
                                            </h5>
                                            <div className="border border-border rounded-md overflow-hidden">
                                              <table className="w-full text-sm">
                                                <thead className="bg-muted/50">
                                                  <tr>
                                                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-48">Field</th>
                                                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                  {uniqueMutableElements.map(me => (
                                                    <tr key={me.field}>
                                                      <td className="px-3 py-2 font-mono text-primary">{me.field}</td>
                                                      <td className="px-3 py-2 text-foreground">{me.description}</td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {autoMapping.data?.status === 'matched' && !autoMapping.isLoading && autoMapping.enrichedMapping && filteredCommunityStrategies.length === 0 && autoMapping.enrichedMapping.techniqueIds.length === 0 && (
              <div className="py-8 text-center border border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">Found community references, but no MITRE ATT&CK technique IDs could be extracted from the detection rules.</p>
              </div>
            )}

            {autoMapping.data?.status === 'matched' && !autoMapping.isLoading && autoMapping.enrichedMapping && filteredCommunityStrategies.length === 0 && autoMapping.enrichedMapping.techniqueIds.length > 0 && (
              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Found <strong className="text-foreground">{autoMapping.enrichedMapping.techniqueIds.length}</strong> technique references from {RESOURCE_LABELS[autoMapping.enrichedMapping.source]?.label}, but these techniques don't have detection strategies defined in the MITRE ATT&CK STIX v18 knowledge base. Not all ATT&CK techniques have corresponding detection strategies.
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      The community detection rules still provide value - they show this product is referenced in active threat detection content.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {autoMapping.enrichedMapping.techniqueIds.slice(0, 10).map(techId => (
                        <a
                          key={techId}
                          href={`https://attack.mitre.org/techniques/${techId.replace('.', '/')}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-muted/50 hover:border-primary/30 text-xs font-mono text-red-600 hover:underline"
                        >
                          {techId}
                        </a>
                      ))}
                      {autoMapping.enrichedMapping.techniqueIds.length > 10 && (
                        <span className="text-xs text-muted-foreground">+{autoMapping.enrichedMapping.techniqueIds.length - 10} more</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {autoMapping.data?.status === 'ai_pending' && (
              <div className="py-8 text-center border border-dashed border-amber-500/50 rounded-lg bg-amber-500/5">
                <AlertCircle className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                <p className="text-amber-600 font-medium">No Automated Mappings Found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This product requires AI-assisted mapping to determine detection coverage.
                </p>
              </div>
            )}

            {autoMapping.data?.status === 'not_found' && (
              <div className="py-8 text-center border border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">No references to this product found in community detection rule repositories (Sigma, Elastic, Splunk).</p>
              </div>
            )}

            {!autoMapping.data && !autoMapping.isLoading && (
              <div className="py-8 text-center border border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">Community coverage will load automatically.</p>
              </div>
            )}
          </section>
        </div>
      </div>

      <aside className="w-52 flex-shrink-0 border-l border-border p-6 sticky top-0 h-screen overflow-auto hidden xl:block">
        <h3 className="text-sm font-medium text-foreground mb-3">On this page</h3>
        <nav className="space-y-1">
          {tocItems.map(item => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={cn(
                "block text-sm py-1.5 transition-colors",
                activeSection === item.id
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveSection(item.id)}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      {selectedDataComponent && (
        <DataComponentDetail
          dc={selectedDataComponent}
          platform={platform}
          onClose={() => setSelectedDataComponent(null)}
        />
      )}

      {selectedMitreAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedMitreAsset(null)}>
          <div 
            className="bg-card border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{selectedMitreAsset.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs text-primary font-mono bg-muted px-1.5 py-0.5 rounded">{selectedMitreAsset.id}</code>
                      <Badge variant="outline" className="text-xs">{selectedMitreAsset.domain}</Badge>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMitreAsset(null)}
                  className="p-2 hover:bg-muted rounded-md transition-colors"
                  data-testid="button-close-asset-modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  Description
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedMitreAsset.description}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  Asset Classification
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border border-border bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Domain</div>
                    <div className="text-sm font-medium text-foreground">{selectedMitreAsset.domain}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Asset ID</div>
                    <div className="text-sm font-medium text-foreground font-mono">{selectedMitreAsset.id}</div>
                  </div>
                </div>
              </div>

              {selectedMitreAsset.id.startsWith('A0') && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    MITRE ATT&CK Reference
                  </h3>
                  <a
                    href={`https://attack.mitre.org/assets/${selectedMitreAsset.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    data-testid="link-mitre-asset-ref"
                  >
                    View on MITRE ATT&CK
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-muted-foreground" />
                  Detection Relevance
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedMitreAsset.domain === 'ICS' 
                    ? `This is an Industrial Control System (ICS) asset. Detection strategies targeting this asset type focus on operational technology (OT) environments, SCADA systems, and industrial protocols.`
                    : `This is an Enterprise asset. Detection strategies targeting this asset type focus on corporate IT environments, standard network protocols, and enterprise applications.`
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
