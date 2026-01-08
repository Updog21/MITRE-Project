import { useState, useMemo } from 'react';
import { Asset, getDetectionStrategiesForProduct, getDataComponentsForProduct, DetectionStrategy, DataComponentRef, dataComponents, techniques } from '@/lib/mitreData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Server,
  Target,
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
  CheckCircle2
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
    <div className="max-w-5xl mx-auto space-y-8">
      <button 
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        data-testid="button-back"
      >
        ← Back to search
      </button>

      <Card className="bg-card/50 backdrop-blur border-border">
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Server className="w-8 h-8 text-green-400" />
            </div>
            <div className="flex-1">
              <span className="text-sm text-muted-foreground">{product.vendor}</span>
              <h1 className="text-2xl font-bold text-foreground mt-1">{product.productName}</h1>
              <p className="text-muted-foreground mt-2">{product.description}</p>
              <div className="flex items-center gap-3 mt-4">
                {product.deployment && (
                  <Badge variant="secondary">{product.deployment}</Badge>
                )}
                <Badge variant="outline" className="flex items-center gap-1">
                  {getPlatformIcon(platform)}
                  {platform}
                </Badge>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  CTID Verified
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
            <Server className="w-4 h-4 text-green-400" />
          </div>
          <span>Product</span>
        </div>
        <ChevronRight className="w-4 h-4" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Database className="w-4 h-4 text-blue-400" />
          </div>
          <span>Data Components</span>
        </div>
        <ChevronRight className="w-4 h-4" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <span>Analytics</span>
        </div>
        <ChevronRight className="w-4 h-4" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <span>Coverage</span>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            Data Components
            <Badge variant="secondary" className="ml-2">{filteredDataComponents.length}</Badge>
          </h2>
          <span className="text-sm text-muted-foreground">
            Log sources provided by {product.productName}
          </span>
        </div>

        <div className="space-y-3">
          {filteredDataComponents.map((dc) => {
            const isExpanded = expandedDataComponents.has(dc.id);
            
            return (
              <Card 
                key={dc.id} 
                className={cn(
                  "bg-card/30 border-border overflow-hidden transition-all",
                  isExpanded && "border-blue-500/40"
                )}
              >
                <button
                  onClick={() => toggleDataComponent(dc.id)}
                  className="w-full p-4 text-left hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-blue-400">{dc.id}</span>
                        <a 
                          href={`https://attack.mitre.org/datacomponents/${dc.id}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-blue-400"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <h3 className="font-medium text-foreground">{dc.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{dc.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-mono text-sm text-foreground">{dc.eventSource}</div>
                        {dc.eventId && (
                          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 font-mono text-xs mt-1">
                            Event {dc.eventId}
                          </Badge>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-4 bg-muted/10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Event Source</span>
                        <div className="font-mono text-sm text-foreground mt-1">{dc.eventSource}</div>
                      </div>
                      {dc.eventId && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">Event ID</span>
                          <div className="mt-1">
                            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 font-mono">
                              {dc.eventId}
                            </Badge>
                          </div>
                        </div>
                      )}
                      {dc.logChannel && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">Log Channel</span>
                          <div className="font-mono text-xs text-cyan-400 mt-1 break-all">{dc.logChannel}</div>
                        </div>
                      )}
                    </div>
                    
                    {dc.notes && (
                      <p className="text-sm text-muted-foreground italic">{dc.notes}</p>
                    )}

                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Mutable Elements (Required Fields)</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {dc.mutableElements.map(me => (
                          <div key={me.name} className="p-2 rounded bg-background border border-border">
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono text-primary">{me.name}</code>
                              {me.fieldPath && (
                                <code className="text-[10px] font-mono text-muted-foreground">{me.fieldPath}</code>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{me.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            Analytics
            <Badge variant="secondary" className="ml-2">{filteredAnalytics.length}</Badge>
          </h2>
          <span className="text-sm text-muted-foreground">
            Detection rules enabled by these data components
          </span>
        </div>

        {filteredAnalytics.length > 0 ? (
          <div className="space-y-3">
            {filteredAnalytics.map((analytic, idx) => {
              const isExpanded = expandedAnalytics.has(analytic.id);
              const dcRefs = analytic.dataComponents
                .map(id => filteredDataComponents.find(dc => dc.id === id))
                .filter(Boolean);

              return (
                <Card 
                  key={analytic.id} 
                  className={cn(
                    "bg-card/30 border-border overflow-hidden transition-all",
                    isExpanded && "border-amber-500/40"
                  )}
                >
                  <button
                    onClick={() => toggleAnalytic(analytic.id)}
                    className="w-full p-4 text-left hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-400 font-mono text-sm font-bold">{idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm text-amber-400">{analytic.id}</span>
                        </div>
                        <h3 className="font-medium text-foreground">{analytic.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{analytic.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {analytic.techniques.map(t => (
                            <Badge key={t} variant="destructive" className="text-xs font-mono">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 border-t border-border pt-4 bg-muted/10">
                      {analytic.pseudocode && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Code className="w-4 h-4 text-green-400" />
                            <span className="text-sm font-medium text-foreground">Detection Logic</span>
                          </div>
                          <pre className="p-4 rounded-lg bg-background border border-border text-sm font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                            {analytic.pseudocode}
                          </pre>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Database className="w-4 h-4 text-blue-400" />
                          <span className="text-sm font-medium text-foreground">Required Data Components</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {dcRefs.map(dc => dc && (
                            <Badge key={dc.id} variant="secondary" className="font-mono text-xs">
                              {dc.id}: {dc.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-card/30 border-border border-dashed">
            <CardContent className="py-8 text-center">
              <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground">
                No analytics currently mapped for {platform} with these data components.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Coverage Value
        </h2>

        <Card className="bg-gradient-to-r from-primary/10 via-green-500/10 to-primary/10 border-primary/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Zap className="w-10 h-10 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-foreground">Security Value Summary</h3>
                  <div className="text-3xl font-bold text-primary">{coverageScore}%</div>
                </div>
                
                <Progress value={coverageScore} className="h-3 mb-4" />
                
                <p className="text-muted-foreground">
                  <strong className="text-foreground">{product.productName}</strong> provides{' '}
                  <strong className="text-blue-400">{filteredDataComponents.length} data components</strong> for {platform}, enabling{' '}
                  <strong className="text-amber-400">{filteredAnalytics.length} detection analytics</strong> that cover{' '}
                  <strong className="text-red-400">{coveredTechniques.length} ATT&CK techniques</strong>.
                </p>

                {coveredTechniques.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-primary/20">
                    <span className="text-sm text-muted-foreground">Techniques Covered:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {coveredTechniques.map(t => (
                        <div key={t.id} className="flex items-center gap-2 p-2 rounded bg-background/50 border border-border">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          <span className="font-mono text-sm text-red-400">{t.id}</span>
                          <span className="text-sm text-foreground">{t.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
