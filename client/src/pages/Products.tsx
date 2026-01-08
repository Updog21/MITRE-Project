import { Sidebar } from '@/components/Sidebar';
import { getAllProducts, getProductMapping, ctidMappedProducts, Asset } from '@/lib/v18Data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle2, Database, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { ValueChainDisplay } from '@/components/ValueChainDisplay';
import { ProductMapping } from '@/lib/v18Data';

export default function Products() {
  const [selectedMapping, setSelectedMapping] = useState<ProductMapping | null>(null);
  const products = getAllProducts();

  const handleSelectProduct = (asset: Asset) => {
    const mapping = getProductMapping(asset.id);
    if (mapping) {
      setSelectedMapping(mapping);
    }
  };

  const getSourceBadge = (source: Asset['source']) => {
    switch (source) {
      case 'ctid':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">CTID</Badge>;
      case 'custom':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Custom</Badge>;
      case 'ai-pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
    }
  };

  if (selectedMapping) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="grid-pattern min-h-full">
            <div className="p-6">
              <ValueChainDisplay 
                mapping={selectedMapping}
                onBack={() => setSelectedMapping(null)}
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <div className="grid-pattern min-h-full">
          <div className="p-6 space-y-6">
            <header>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Security Stack</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Browse all mapped security products and their MITRE ATT&CK coverage
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-primary">{products.length}</div>
                  <div className="text-sm text-muted-foreground">Total Products</div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-green-400">
                    {products.filter(p => p.source === 'ctid').length}
                  </div>
                  <div className="text-sm text-muted-foreground">CTID Verified</div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-blue-400">
                    {products.filter(p => p.source === 'custom').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Custom Mappings</div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/50 backdrop-blur border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  All Mapped Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {products.map((product) => {
                    const mapping = getProductMapping(product.id);
                    
                    return (
                      <Card 
                        key={product.id} 
                        className="bg-background border-border hover:border-primary/50 transition-all cursor-pointer group"
                        onClick={() => handleSelectProduct(product)}
                        data-testid={`card-product-${product.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm text-muted-foreground">{product.vendor}</span>
                                {getSourceBadge(product.source)}
                              </div>
                              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                {product.productName}
                              </h3>
                              {product.deployment && (
                                <span className="text-xs text-muted-foreground">{product.deployment}</span>
                              )}
                              
                              <div className="flex items-center gap-4 mt-3 text-xs">
                                <div className="flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-blue-400" />
                                  <span className="text-muted-foreground">
                                    {product.dataComponents.length} Data Components
                                  </span>
                                </div>
                                {mapping && (
                                  <div className="flex items-center gap-1">
                                    <Shield className="w-3 h-3 text-green-400" />
                                    <span className="text-muted-foreground">
                                      {mapping.techniques.length} Techniques
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
