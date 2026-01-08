import { useState, useMemo, useEffect } from 'react';
import { Asset, getDetectionStrategiesForProduct, dataComponents, techniques, DetectionStrategy, AnalyticItem, DataComponentRef, mitreAssets, MitreAsset } from '@/lib/mitreData';
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
  CheckCircle2,
  ArrowLeft,
  Shield,
  X,
  Info,
  FileText,
  Zap,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAutoMappingWithAutoRun, RESOURCE_LABELS } from '@/hooks/useAutoMapper';

interface ProductViewProps {
  product: Asset;
  onBack: () => void;
}

function getPlatformIcon(platform: string) {
  switch (platform) {
    case 'Windows': return <Monitor className="w-4 h-4" />;
    case 'Linux': return <Terminal className="w-4 h-4" />;
    case 'Azure AD': return <Cloud className="w-4 h-4" />;
    default: return <Monitor className="w-4 h-4" />;
  }
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

export function ProductView({ product, onBack }: ProductViewProps) {
  const [expandedStrategies, setExpandedStrategies] = useState<Set<string>>(new Set());
  const [expandedAnalytics, setExpandedAnalytics] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState('overview');
  const [selectedDataComponent, setSelectedDataComponent] = useState<DataComponentRef | null>(null);
  const [selectedMitreAsset, setSelectedMitreAsset] = useState<MitreAsset | null>(null);
  
  const platform = product.platforms[0];
  
  const autoMapping = useAutoMappingWithAutoRun(product.id, platform);
  
  useEffect(() => {
    if (autoMapping.shouldAutoRun) {
      autoMapping.triggerAutoRun();
    }
  }, [autoMapping.shouldAutoRun]);
  
  const strategies = getDetectionStrategiesForProduct(product.id);

  const getLogSourcesForAnalytic = (analytic: AnalyticItem): LogSourceRow[] => {
    const rows: LogSourceRow[] = [];
    const prefixes = getPlatformPrefixes(platform);
    
    analytic.dataComponents.forEach((dcId: string) => {
      const dc = dataComponents[dcId];
      if (!dc) return;
      
      if (dc.logSources && dc.logSources.length > 0) {
        const filteredSources = dc.logSources.filter(ls => 
          prefixes.some(prefix => ls.name.toLowerCase().startsWith(prefix.toLowerCase()))
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
        const platformMappings = dc.platforms.filter(p => p.platform === platform);
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
      analytics: strategy.analytics.filter(a => a.platforms.includes(platform))
    })).filter(s => s.analytics.length > 0);
  }, [strategies, platform]);

  const totalAnalytics = filteredStrategies.reduce((sum, s) => sum + s.analytics.length, 0);
  
  const communityStrategiesCount = autoMapping.enrichedMapping?.detectionStrategies?.length || 0;
  const communityAnalyticsCount = autoMapping.enrichedMapping?.detectionStrategies?.reduce(
    (sum, s) => sum + s.analytics.length, 0
  ) || 0;
  
  const coveredTechniques = useMemo(() => {
    const techIds = new Set<string>();
    filteredStrategies.forEach(s => s.techniques.forEach(t => techIds.add(t)));
    if (autoMapping.enrichedMapping?.detectionStrategies) {
      autoMapping.enrichedMapping.detectionStrategies.forEach(s => s.techniques.forEach(t => techIds.add(t)));
    }
    return techniques.filter(t => techIds.has(t.id));
  }, [filteredStrategies, autoMapping.enrichedMapping]);

  const coverageScore = Math.min(100, totalAnalytics * 15 + filteredStrategies.length * 10);

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
                  {communityStrategiesCount > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      ({filteredStrategies.length} + {communityStrategiesCount})
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Detection Strategies</div>
              </div>
              <div className="p-4 rounded-lg border border-border bg-muted/30">
                <div className="text-2xl font-semibold text-foreground">
                  {totalAnalytics + communityAnalyticsCount}
                  {communityAnalyticsCount > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      ({totalAnalytics} + {communityAnalyticsCount})
                    </span>
                  )}
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
                  Mapped MITRE Assets
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  This product applies to the following asset types:
                </p>
                <div className="flex flex-wrap gap-2">
                  {(product.mitreAssetIds || []).map(assetId => {
                    const asset = mitreAssets[assetId];
                    return asset ? (
                      <button
                        key={assetId}
                        onClick={() => setSelectedMitreAsset(asset)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-muted/50 hover:bg-muted hover:border-primary/30 transition-colors text-sm"
                        data-testid={`button-asset-${assetId}`}
                      >
                        <code className="text-xs text-primary font-mono">{assetId}</code>
                        <span className="text-foreground">{asset.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{asset.domain}</Badge>
                      </button>
                    ) : null;
                  })}
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
                This product maps to <strong className="text-foreground">{filteredStrategies.length} detection strategies</strong> for {platform}, 
                containing <strong className="text-foreground">{totalAnalytics} analytics</strong> that 
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
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
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
                          {strategy.techniques.slice(0, 2).map(t => (
                            <Badge key={t} className="bg-red-100 text-red-700 border-red-200 font-mono text-xs">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </button>

                      {isStrategyExpanded && (
                        <div className="border-t border-border">
                          <div className="px-6 py-4 bg-muted/20">
                            <p className="text-sm text-muted-foreground mb-4">{strategy.description}</p>
                            
                            <div className="mb-4">
                              <span className="text-sm font-medium text-foreground">ATT&CK Techniques: </span>
                              <span className="text-sm text-muted-foreground">
                                {strategy.techniques.map((t, i) => (
                                  <span key={t}>
                                    <a
                                      href={`https://attack.mitre.org/techniques/${t.replace('.', '/')}/`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-red-600 hover:underline font-mono"
                                    >
                                      {t}
                                    </a>
                                    {i < strategy.techniques.length - 1 && ', '}
                                  </span>
                                ))}
                              </span>
                            </div>

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
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Additional Coverage from Community Resources
            </h2>
            <p className="text-muted-foreground mb-6">
              Detection strategies derived from techniques discovered in community detection rules (Sigma, Elastic, Splunk).
            </p>

            {autoMapping.isLoading && (
              <div className="py-8 text-center border border-dashed border-border rounded-lg">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-muted-foreground">Querying community resources...</p>
              </div>
            )}

            {autoMapping.enrichedMapping && autoMapping.enrichedMapping.detectionStrategies.length > 0 && (
              <div className="space-y-4">
                {autoMapping.enrichedMapping.detectionStrategies.map((strategy) => {
                  const isStrategyExpanded = expandedStrategies.has(`community-${strategy.id}`);
                  const stixDataComponents = autoMapping.enrichedMapping?.dataComponents || [];
                  
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
                          {strategy.techniques.slice(0, 2).map(t => (
                            <Badge key={t} className="bg-red-100 text-red-700 border-red-200 font-mono text-xs">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </button>

                      {isStrategyExpanded && (
                        <div className="border-t border-border">
                          <div className="px-6 py-4 bg-muted/20">
                            <p className="text-sm text-muted-foreground mb-4">{strategy.description}</p>
                            
                            <div className="mb-4">
                              <span className="text-sm font-medium text-foreground">ATT&CK Techniques: </span>
                              <span className="text-sm text-muted-foreground">
                                {strategy.techniques.map((t, i) => (
                                  <span key={t}>
                                    <a
                                      href={`https://attack.mitre.org/techniques/${t.replace('.', '/')}/`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-red-600 hover:underline font-mono"
                                    >
                                      {t}
                                    </a>
                                    {i < strategy.techniques.length - 1 && ', '}
                                  </span>
                                ))}
                              </span>
                            </div>

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
                                      <Badge variant="outline" className="text-xs">
                                        {analyticDataComponents.length} Data Components
                                      </Badge>
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

            {autoMapping.data?.status === 'matched' && !autoMapping.isLoading && autoMapping.enrichedMapping && autoMapping.enrichedMapping.detectionStrategies.length === 0 && autoMapping.enrichedMapping.techniqueIds.length === 0 && (
              <div className="py-8 text-center border border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">Found community references, but no MITRE ATT&CK technique IDs could be extracted from the detection rules.</p>
              </div>
            )}

            {autoMapping.data?.status === 'matched' && !autoMapping.isLoading && autoMapping.enrichedMapping && autoMapping.enrichedMapping.detectionStrategies.length === 0 && autoMapping.enrichedMapping.techniqueIds.length > 0 && (
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
