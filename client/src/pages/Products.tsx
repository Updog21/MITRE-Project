import { Sidebar } from '@/components/Sidebar';
import { securityProducts, techniques } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Products() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <div className="grid-pattern min-h-full">
          <div className="p-6 space-y-6">
            <header className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Security Stack</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Manage your defensive security products and their MITRE coverage
                </p>
              </div>
              <Button data-testid="button-add-product">
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {securityProducts.map((product) => {
                const productTechniques = techniques.filter(t => 
                  t.coveredByProducts.includes(product.name.split(' ')[0])
                );
                
                return (
                  <Card 
                    key={product.id} 
                    className="bg-card/50 backdrop-blur border-border hover:border-primary/50 transition-colors"
                    data-testid={`card-product-${product.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{product.name}</CardTitle>
                            <p className="text-xs text-muted-foreground">{product.vendor}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {product.category}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Techniques Covered</span>
                          <span className="font-mono text-primary font-bold">{productTechniques.length}</span>
                        </div>
                        
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {productTechniques.slice(0, 5).map((technique) => (
                            <div 
                              key={technique.id}
                              className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/30"
                            >
                              <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                              <span className="font-mono text-muted-foreground">{technique.id}</span>
                              <span className="text-foreground truncate">{technique.name}</span>
                            </div>
                          ))}
                          {productTechniques.length > 5 && (
                            <div className="text-xs text-muted-foreground text-center py-1">
                              +{productTechniques.length - 5} more techniques
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
