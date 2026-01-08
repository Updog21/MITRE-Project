import { useState, useMemo } from 'react';
import { Asset, getDetectionStrategiesForProduct, dataComponents, techniques } from '@/lib/mitreData';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Server,
  Database,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Shield,
  Layers,
  Code,
  Terminal,
  Monitor,
  Zap,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductViewProps {
  product: Asset;
  onBack: () => void;
}

function getPlatformIcon(platform: string) {
  switch (platform) {
    case 'Windows': return <Monitor className="w-4 h-4" />;
    case 'Linux': return <Terminal className="w-4 h-4" />;
    case 'Azure AD': return <Database className="w-4 h-4" />;
    default: return <Monitor className="w-4 h-4" />;
  }
}

interface FilteredAnalytic {
  id: string;
  name: string;
  description: string;
  pseudocode?: string;
  dataComponents: string[];
  techniques: string[];
}

interface FilteredDataComponent {
  id: string;
  name: string;
  description: string;
  dataSource: string;
  eventSource: string;
  eventId?: string;
  logChannel?: string;
  notes?: string;
  mutableElements: { name: string; description: string; fieldPath?: string }[];
}

export function ProductView({ product, onBack }: ProductViewProps) {
  const [expandedAnalytics, setExpandedAnalytics] = useState<Set<string>>(new Set());
  const [expandedDataComponents, setExpandedDataComponents] = useState<Set<string>>(new Set());
  
  const platform = product.platforms[0];
  
  const filteredDataComponents = useMemo((): FilteredDataComponent[] => {
    return product.dataComponentIds
      .map(id => dataComponents[id])
      .filter(Boolean)
      .map(dc => {
        const platformMapping = dc.platforms.find(p => p.platform === platform);
        if (!platformMapping) return null;
        
        return {
          id: dc.id,
          name: dc.name,
          description: dc.description,
          dataSource: dc.dataSource,
          eventSource: platformMapping.eventSource,
          eventId: platformMapping.eventId,
          logChannel: platformMapping.logChannel,
          notes: platformMapping.notes,
          mutableElements: dc.mutableElements,
        };
      })
      .filter(Boolean) as FilteredDataComponent[];
  }, [product, platform]);

  const strategies = getDetectionStrategiesForProduct(product.id);
  
  const filteredAnalytics = useMemo((): FilteredAnalytic[] => {
    const analytics: FilteredAnalytic[] = [];
    
    strategies.forEach(strategy => {
      strategy.analytics
        .filter(a => a.platforms.includes(platform))
        .forEach(a => {
          analytics.push({
            id: a.id,
            name: a.name,
            description: a.description,
            pseudocode: a.pseudocode,
            dataComponents: a.dataComponents,
            techniques: strategy.techniques,
          });
        });
    });
    
    return analytics;
  }, [strategies, platform]);

  const coveredTechniques = useMemo(() => {
    const techIds = new Set<string>();
    filteredAnalytics.forEach(a => a.techniques.forEach(t => techIds.add(t)));
    return techniques.filter(t => techIds.has(t.id));
  }, [filteredAnalytics]);

  const coverageScore = Math.min(100, filteredAnalytics.length * 15 + filteredDataComponents.length * 10);

  const toggleAnalytic = (id: string) => {
    setExpandedAnalytics(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDataComponent = (id: string) => {
    setExpandedDataComponents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <button 
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        data-testid="button-back"
      >
        ← Back to search
      </button>

      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Badge variant="outline" className="text-xs">
            {product.vendor}
          </Badge>
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
            {getPlatformIcon(platform)}
            <span className="ml-1">{platform}</span>
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{product.productName}</h1>
        <p className="text-muted-foreground mt-2 text-lg leading-relaxed">{product.description}</p>
      </header>

      <div className="flex items-center gap-2 mb-10 py-3 px-4 rounded-lg bg-muted/30 border border-border/50">
        <div className="flex items-center gap-1.5 text-sm">
          <Server className="w-4 h-4 text-emerald-400" />
          <span className="text-foreground font-medium">Product</span>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground/50" />
        <div className="flex items-center gap-1.5 text-sm">
          <Database className="w-4 h-4 text-blue-400" />
          <span className="text-muted-foreground">{filteredDataComponents.length} Data Components</span>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground/50" />
        <div className="flex items-center gap-1.5 text-sm">
          <Layers className="w-4 h-4 text-amber-400" />
          <span className="text-muted-foreground">{filteredAnalytics.length} Analytics</span>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground/50" />
        <div className="flex items-center gap-1.5 text-sm">
          <Shield className="w-4 h-4 text-violet-400" />
          <span className="text-muted-foreground">{coveredTechniques.length} Techniques</span>
        </div>
      </div>

      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-semibold text-foreground">Data Components</h2>
        </div>

        <div className="space-y-2">
          {filteredDataComponents.map((dc) => {
            const isExpanded = expandedDataComponents.has(dc.id);
            
            return (
              <div 
                key={dc.id} 
                className={cn(
                  "rounded-lg border transition-all",
                  isExpanded ? "border-blue-500/30 bg-blue-500/5" : "border-border/50 bg-card/30 hover:border-border"
                )}
              >
                <button
                  onClick={() => toggleDataComponent(dc.id)}
                  className="w-full px-4 py-3 text-left flex items-center gap-4"
                  data-testid={`button-expand-dc-${dc.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-blue-400">{dc.id}</span>
                      <span className="text-foreground font-medium">{dc.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <code className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">{dc.eventSource}</code>
                    {dc.eventId && (
                      <Badge variant="secondary" className="font-mono text-xs">{dc.eventId}</Badge>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-border/30">
                    <p className="text-sm text-muted-foreground mb-4">{dc.description}</p>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-1">Source</div>
                        <div className="font-mono text-sm text-foreground">{dc.eventSource}</div>
                      </div>
                      {dc.eventId && (
                        <div>
                          <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-1">Event ID</div>
                          <div className="font-mono text-sm text-orange-400">{dc.eventId}</div>
                        </div>
                      )}
                      {dc.logChannel && (
                        <div className="col-span-2">
                          <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-1">Log Channel</div>
                          <div className="font-mono text-xs text-cyan-400 break-all">{dc.logChannel}</div>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-2">Required Fields</div>
                      <div className="flex flex-wrap gap-1.5">
                        {dc.mutableElements.map(me => (
                          <span 
                            key={me.name} 
                            className="text-xs font-mono px-2 py-1 rounded bg-muted/50 text-foreground border border-border/50"
                            title={me.description}
                          >
                            {me.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <a 
                      href={`https://attack.mitre.org/datasources/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-4"
                    >
                      View in MITRE ATT&CK <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-amber-400" />
          <h2 className="text-xl font-semibold text-foreground">Detection Analytics</h2>
        </div>

        {filteredAnalytics.length > 0 ? (
          <div className="space-y-2">
            {filteredAnalytics.map((analytic) => {
              const isExpanded = expandedAnalytics.has(analytic.id);
              const dcRefs = analytic.dataComponents
                .map(id => filteredDataComponents.find(dc => dc.id === id))
                .filter(Boolean);

              return (
                <div 
                  key={analytic.id} 
                  className={cn(
                    "rounded-lg border transition-all",
                    isExpanded ? "border-amber-500/30 bg-amber-500/5" : "border-border/50 bg-card/30 hover:border-border"
                  )}
                >
                  <button
                    onClick={() => toggleAnalytic(analytic.id)}
                    className="w-full px-4 py-3 text-left flex items-center gap-4"
                    data-testid={`button-expand-analytic-${analytic.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-amber-400">{analytic.id}</span>
                        <span className="text-foreground font-medium">{analytic.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {analytic.techniques.slice(0, 2).map(t => (
                        <Badge key={t} variant="destructive" className="text-xs font-mono px-1.5 py-0">
                          {t}
                        </Badge>
                      ))}
                      {analytic.techniques.length > 2 && (
                        <span className="text-xs text-muted-foreground">+{analytic.techniques.length - 2}</span>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-border/30 space-y-4">
                      <p className="text-sm text-muted-foreground">{analytic.description}</p>

                      {analytic.pseudocode && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Code className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Detection Logic</span>
                          </div>
                          <pre className="p-3 rounded-md bg-background/80 border border-border/50 text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed">
                            {analytic.pseudocode}
                          </pre>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-muted-foreground">Requires:</span>
                          {dcRefs.map(dc => dc && (
                            <Badge key={dc.id} variant="outline" className="font-mono text-xs">
                              {dc.id}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground border border-dashed border-border/50 rounded-lg">
            No analytics mapped for {platform} with these data components.
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-violet-400" />
          <h2 className="text-xl font-semibold text-foreground">Coverage Summary</h2>
        </div>

        <Card className="bg-gradient-to-br from-violet-500/10 via-transparent to-emerald-500/10 border-violet-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Detection Coverage Score</div>
                <div className="text-4xl font-bold text-foreground">{coverageScore}%</div>
              </div>
              <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Zap className="w-8 h-8 text-violet-400" />
              </div>
            </div>
            
            <Progress value={coverageScore} className="h-2 mb-6" />
            
            <div className="grid grid-cols-3 gap-4 text-center py-4 border-t border-border/30">
              <div>
                <div className="text-2xl font-bold text-blue-400">{filteredDataComponents.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Data Components</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-400">{filteredAnalytics.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Analytics</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">{coveredTechniques.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Techniques</div>
              </div>
            </div>

            {coveredTechniques.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/30">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-3">Covered Techniques</div>
                <div className="flex flex-wrap gap-2">
                  {coveredTechniques.map(t => (
                    <a
                      key={t.id}
                      href={`https://attack.mitre.org/techniques/${t.id.replace('.', '/')}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-background/50 border border-border/50 hover:border-emerald-500/30 transition-colors group"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-mono text-xs text-red-400">{t.id}</span>
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{t.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
