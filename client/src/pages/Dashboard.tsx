import { useState } from 'react';
import { Search, Shield, Database, Target, Layers, ChevronRight, Cpu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { searchProducts, Asset, ctidProducts, detectionStrategies, dataComponents } from '@/lib/mitreData';
import { ProductView } from '@/components/ProductView';

type ViewState = 'search' | 'product';

export default function Dashboard() {
  const [view, setView] = useState<ViewState>('search');
  const [selectedProduct, setSelectedProduct] = useState<Asset | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Asset[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = () => {
    if (!query.trim()) return;
    const found = searchProducts(query);
    setResults(found);
    setHasSearched(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleSelectProduct = (product: Asset) => {
    setSelectedProduct(product);
    setView('product');
  };

  const handleBack = () => {
    setView('search');
    setSelectedProduct(null);
  };

  if (view === 'product' && selectedProduct) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-6">
          <ProductView product={selectedProduct} onBack={handleBack} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-8">
        <header className="text-center max-w-3xl mx-auto pt-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
              <Shield className="w-9 h-9 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight">OpenTidal</h1>
          <p className="text-lg text-muted-foreground mt-3 max-w-xl mx-auto">
            Threat-Informed Defense Platform — Map security products to MITRE ATT&CK Detection Strategies
          </p>
        </header>

        <div className="max-w-2xl mx-auto">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search products (Windows, Sysmon, Azure, Linux...)"
                className="pl-12 h-14 text-lg bg-card border-border"
                data-testid="input-product-search"
              />
            </div>
            <Button onClick={handleSearch} size="lg" className="h-14 px-8" data-testid="button-search">
              Search
            </Button>
          </div>
        </div>

        {hasSearched && (
          <div className="max-w-4xl mx-auto">
            {results.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Database className="w-4 h-4 text-green-400" />
                  <span>Found {results.length} product(s) in CTID Security Stack Mappings</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.map((product) => (
                    <Card 
                      key={product.id}
                      className="bg-card/50 border-border hover:border-primary/50 transition-all cursor-pointer group"
                      onClick={() => handleSelectProduct(product)}
                      data-testid={`card-result-${product.id}`}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                            <Database className="w-6 h-6 text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-muted-foreground">{product.vendor}</span>
                            <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                              {product.productName}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {product.description}
                            </p>
                            <div className="flex items-center gap-2 mt-3">
                              {product.platforms.map(p => (
                                <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                              ))}
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                                CTID
                              </Badge>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <Card className="bg-card/50 border-border border-dashed">
                <CardContent className="py-12 text-center">
                  <Cpu className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    No CTID mapping found for "{query}"
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    This product isn't in the MITRE CTID Security Stack Mappings database yet.
                    Would you like to use AI to create a mapping?
                  </p>
                  <Button data-testid="button-ai-mapping">
                    <Cpu className="w-4 h-4 mr-2" />
                    Create AI Mapping
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!hasSearched && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Quick Access</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {ctidProducts.map((product) => (
                  <Card 
                    key={product.id}
                    className="bg-card/30 border-border hover:border-primary/50 transition-all cursor-pointer group"
                    onClick={() => handleSelectProduct(product)}
                    data-testid={`card-quick-${product.id}`}
                  >
                    <CardContent className="p-4">
                      <span className="text-xs text-muted-foreground">{product.vendor}</span>
                      <h4 className="font-medium text-foreground group-hover:text-primary transition-colors text-sm mt-0.5">
                        {product.productName}
                      </h4>
                      <div className="flex gap-1 mt-2">
                        {product.platforms.map(p => (
                          <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-card/30 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="w-5 h-5 text-green-400" />
                    CTID Mappings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Search verified product mappings from the Center for Threat-Informed Defense.
                  </p>
                  <div className="mt-4 text-2xl font-bold text-green-400">
                    {ctidProducts.length}
                    <span className="text-sm font-normal text-muted-foreground ml-2">products</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/30 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Detection Strategies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    MITRE detection strategies with analytics, log sources, and mutable elements.
                  </p>
                  <div className="mt-4 text-2xl font-bold text-primary">
                    {detectionStrategies.length}
                    <span className="text-sm font-normal text-muted-foreground ml-2">strategies</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/30 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-400" />
                    Data Components
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Log types with event channels, event codes, and required fields.
                  </p>
                  <div className="mt-4 text-2xl font-bold text-blue-400">
                    {Object.keys(dataComponents).length}
                    <span className="text-sm font-normal text-muted-foreground ml-2">components</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
