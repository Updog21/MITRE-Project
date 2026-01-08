import { useState, useMemo } from 'react';
import { Asset, getDetectionStrategiesForProduct, dataComponents, techniques } from '@/lib/mitreData';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronRight,
  ExternalLink,
  ChevronDown,
  Database,
  Layers,
  Code,
  Terminal,
  Monitor,
  Cloud,
  CheckCircle2,
  ArrowLeft
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
    case 'Azure AD': return <Cloud className="w-4 h-4" />;
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
  logSourceName: string;
  eventId?: string;
  logChannel?: string;
  notes?: string;
  mutableElements: { name: string; description: string; fieldPath?: string }[];
}

export function ProductView({ product, onBack }: ProductViewProps) {
  const [expandedAnalytics, setExpandedAnalytics] = useState<Set<string>>(new Set());
  const [expandedDataComponents, setExpandedDataComponents] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState('overview');
  
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
          logSourceName: platformMapping.logSourceName,
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

  const tocItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'data-components', label: 'Data Components' },
    { id: 'analytics', label: 'Detection Analytics' },
    { id: 'coverage', label: 'Coverage Summary' },
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
                CTID Verified
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold text-foreground mb-2">{product.productName}</h1>
            <p className="text-lg text-muted-foreground">{product.description}</p>
            
            <div className="mt-6 grid grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border border-border bg-muted/30">
                <div className="text-2xl font-semibold text-foreground">{filteredDataComponents.length}</div>
                <div className="text-sm text-muted-foreground">Data Components</div>
              </div>
              <div className="p-4 rounded-lg border border-border bg-muted/30">
                <div className="text-2xl font-semibold text-foreground">{filteredAnalytics.length}</div>
                <div className="text-sm text-muted-foreground">Analytics</div>
              </div>
              <div className="p-4 rounded-lg border border-border bg-muted/30">
                <div className="text-2xl font-semibold text-foreground">{coveredTechniques.length}</div>
                <div className="text-sm text-muted-foreground">Techniques</div>
              </div>
              <div className="p-4 rounded-lg border border-border bg-muted/30">
                <div className="text-2xl font-semibold text-primary">{coverageScore}%</div>
                <div className="text-sm text-muted-foreground">Coverage</div>
              </div>
            </div>
          </header>

          <section className="mb-10" id="data-components">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Data Components
            </h2>
            <p className="text-muted-foreground mb-6">
              Log sources and telemetry provided by this product for {platform}.
            </p>

            <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
              {filteredDataComponents.map((dc) => {
                const isExpanded = expandedDataComponents.has(dc.id);
                
                return (
                  <div key={dc.id} className="bg-card">
                    <button
                      onClick={() => toggleDataComponent(dc.id)}
                      className="w-full px-4 py-3 text-left flex items-center gap-4 hover:bg-muted/50 transition-colors"
                      data-testid={`button-expand-dc-${dc.id}`}
                    >
                      <ChevronRight className={cn(
                        "w-4 h-4 text-muted-foreground transition-transform flex-shrink-0",
                        isExpanded && "rotate-90"
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-primary font-mono">{dc.id}</code>
                          <span className="font-medium text-foreground">{dc.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm text-muted-foreground font-mono">{dc.eventSource}</span>
                        {dc.eventId && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-mono text-xs">
                            {dc.eventId}
                          </Badge>
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 pl-12 bg-muted/20">
                        <p className="text-sm text-muted-foreground mb-4">{dc.description}</p>
                        
                        <table className="w-full text-sm mb-4">
                          <tbody className="divide-y divide-border">
                            <tr>
                              <td className="py-2 pr-4 text-muted-foreground font-medium w-32">Event Source</td>
                              <td className="py-2 font-mono text-foreground">{dc.eventSource}</td>
                            </tr>
                            {dc.eventId && (
                              <tr>
                                <td className="py-2 pr-4 text-muted-foreground font-medium">Event ID</td>
                                <td className="py-2 font-mono text-foreground">{dc.eventId}</td>
                              </tr>
                            )}
                            {dc.logChannel && (
                              <tr>
                                <td className="py-2 pr-4 text-muted-foreground font-medium">Log Channel</td>
                                <td className="py-2 font-mono text-foreground text-xs break-all">{dc.logChannel}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>

                        <div>
                          <h4 className="text-sm font-medium text-foreground mb-2">Required Fields</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {dc.mutableElements.map(me => (
                              <code 
                                key={me.name} 
                                className="text-xs font-mono px-2 py-1 rounded bg-background border border-border text-primary"
                                title={me.description}
                              >
                                {me.name}
                              </code>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mb-10" id="analytics">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Detection Analytics
            </h2>
            <p className="text-muted-foreground mb-6">
              Detection rules enabled by the data components above.
            </p>

            {filteredAnalytics.length > 0 ? (
              <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                {filteredAnalytics.map((analytic) => {
                  const isExpanded = expandedAnalytics.has(analytic.id);
                  const dcRefs = analytic.dataComponents
                    .map(id => filteredDataComponents.find(dc => dc.id === id))
                    .filter(Boolean);

                  return (
                    <div key={analytic.id} className="bg-card">
                      <button
                        onClick={() => toggleAnalytic(analytic.id)}
                        className="w-full px-4 py-3 text-left flex items-center gap-4 hover:bg-muted/50 transition-colors"
                        data-testid={`button-expand-analytic-${analytic.id}`}
                      >
                        <ChevronRight className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform flex-shrink-0",
                          isExpanded && "rotate-90"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-primary font-mono">{analytic.id}</code>
                            <span className="font-medium text-foreground">{analytic.name}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {analytic.techniques.slice(0, 2).map(t => (
                            <Badge key={t} className="bg-red-100 text-red-700 border-red-200 font-mono text-xs">
                              {t}
                            </Badge>
                          ))}
                          {analytic.techniques.length > 2 && (
                            <span className="text-xs text-muted-foreground">+{analytic.techniques.length - 2}</span>
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 pl-12 bg-muted/20 space-y-6">
                          <p className="text-sm text-muted-foreground">{analytic.description}</p>

                          <div>
                            <h4 className="text-sm font-medium text-foreground mb-3">Log Sources</h4>
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
                                  {dcRefs.map(dc => dc && (
                                    <tr key={dc.id}>
                                      <td className="px-3 py-2">
                                        <a href="#data-components" className="text-primary hover:underline">
                                          {dc.name} ({dc.id})
                                        </a>
                                      </td>
                                      <td className="px-3 py-2 font-mono text-foreground">{dc.logSourceName}</td>
                                      <td className="px-3 py-2 font-mono text-foreground">{dc.eventId ? `EventCode=${dc.eventId}` : '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {dcRefs.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-foreground mb-3">Mutable Elements</h4>
                              <div className="border border-border rounded-md overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-muted/50">
                                    <tr>
                                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-48">Field</th>
                                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {Array.from(new Map(
                                      dcRefs.flatMap(dc => dc?.mutableElements || []).map(me => [me.name, me])
                                    ).values()).map(me => (
                                      <tr key={me.name}>
                                        <td className="px-3 py-2 font-mono text-primary">{me.name}</td>
                                        <td className="px-3 py-2 text-foreground">{me.description}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {analytic.pseudocode && (
                            <div>
                              <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
                                <Code className="w-4 h-4" />
                                Detection Logic
                              </h4>
                              <pre className="p-3 rounded-md bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
                                {analytic.pseudocode}
                              </pre>
                            </div>
                          )}

                          <div>
                            <h4 className="text-sm font-medium text-foreground mb-2">Techniques Detected</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {analytic.techniques.map(t => (
                                <a
                                  key={t}
                                  href={`https://attack.mitre.org/techniques/${t.replace('.', '/')}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-mono text-red-600 hover:text-red-700 hover:underline"
                                >
                                  {t}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
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
              <div className="py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg">
                No analytics mapped for {platform} with these data components.
              </div>
            )}
          </section>

          <section id="coverage">
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
                This product provides <strong className="text-foreground">{filteredDataComponents.length} data components</strong> for {platform}, 
                enabling <strong className="text-foreground">{filteredAnalytics.length} detection analytics</strong> that 
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
    </div>
  );
}
