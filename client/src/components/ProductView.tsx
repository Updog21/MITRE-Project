import { useState, useMemo } from 'react';
import { Asset, getDetectionStrategiesForProduct, dataComponents, techniques, DetectionStrategy, AnalyticItem } from '@/lib/mitreData';
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
  ArrowLeft,
  Shield
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

export function ProductView({ product, onBack }: ProductViewProps) {
  const [expandedStrategies, setExpandedStrategies] = useState<Set<string>>(new Set());
  const [expandedAnalytics, setExpandedAnalytics] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState('overview');
  
  const platform = product.platforms[0];
  
  const strategies = getDetectionStrategiesForProduct(product.id);

  const getLogSourcesForAnalytic = (analytic: AnalyticItem): LogSourceRow[] => {
    const rows: LogSourceRow[] = [];
    
    analytic.dataComponents.forEach((dcId: string) => {
      const dc = dataComponents[dcId];
      if (!dc) return;
      
      const platformMappings = dc.platforms.filter(p => p.platform === platform);
      platformMappings.forEach(mapping => {
        rows.push({
          dataComponentId: dc.id,
          dataComponentName: dc.name,
          logSourceName: mapping.logSourceName,
          channel: mapping.logChannel || '-',
        });
      });
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
  
  const coveredTechniques = useMemo(() => {
    const techIds = new Set<string>();
    filteredStrategies.forEach(s => s.techniques.forEach(t => techIds.add(t)));
    return techniques.filter(t => techIds.has(t.id));
  }, [filteredStrategies]);

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
    { id: 'detection-strategies', label: 'Detection Strategies' },
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
            
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-border bg-muted/30">
                <div className="text-2xl font-semibold text-foreground">{filteredStrategies.length}</div>
                <div className="text-sm text-muted-foreground">Detection Strategies</div>
              </div>
              <div className="p-4 rounded-lg border border-border bg-muted/30">
                <div className="text-2xl font-semibold text-foreground">{totalAnalytics}</div>
                <div className="text-sm text-muted-foreground">Analytics</div>
              </div>
              <div className="p-4 rounded-lg border border-border bg-muted/30">
                <div className="text-2xl font-semibold text-foreground">{coveredTechniques.length}</div>
                <div className="text-sm text-muted-foreground">Techniques Covered</div>
              </div>
            </div>
          </header>

          <section className="mb-10" id="detection-strategies">
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
                                                    <td className="px-3 py-2 text-foreground">
                                                      {row.dataComponentName}
                                                      <span className="text-muted-foreground ml-1">({row.dataComponentId})</span>
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

                                        {analytic.pseudocode && (
                                          <div>
                                            <h5 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                                              <Code className="w-4 h-4" />
                                              Detection Logic
                                            </h5>
                                            <pre className="p-3 rounded-md bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
                                              {analytic.pseudocode}
                                            </pre>
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
