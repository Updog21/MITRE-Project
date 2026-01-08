import { useState } from 'react';
import { 
  Search, 
  Shield, 
  Database, 
  Layers, 
  ChevronRight,
  Home,
  FileText,
  Settings,
  HelpCircle,
  ExternalLink,
  BookOpen,
  Boxes
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { searchProducts, Asset, ctidProducts, detectionStrategies, dataComponents } from '@/lib/mitreData';
import { ProductView } from '@/components/ProductView';

type ViewState = 'search' | 'product';

const categories = [
  { id: 'all', label: 'All Products' },
  { id: 'windows', label: 'Windows' },
  { id: 'linux', label: 'Linux' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'network', label: 'Network' },
];

const sidebarNav = [
  { icon: Home, label: 'Products', active: true },
  { icon: Layers, label: 'Data Components' },
  { icon: FileText, label: 'Detection Strategies' },
  { icon: BookOpen, label: 'Documentation' },
];

export default function Dashboard() {
  const [view, setView] = useState<ViewState>('search');
  const [selectedProduct, setSelectedProduct] = useState<Asset | null>(null);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredProducts = query.trim() 
    ? searchProducts(query)
    : ctidProducts.filter(p => {
        if (activeCategory === 'all') return true;
        if (activeCategory === 'windows') return p.platforms.includes('Windows');
        if (activeCategory === 'linux') return p.platforms.includes('Linux');
        if (activeCategory === 'cloud') return p.platforms.includes('Azure AD');
        return true;
      });

  const handleSelectProduct = (product: Asset) => {
    setSelectedProduct(product);
    setView('product');
  };

  const handleBack = () => {
    setView('search');
    setSelectedProduct(null);
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 border-r border-border bg-sidebar flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">OpenTidal</span>
          </div>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8 h-9 text-sm bg-background"
              data-testid="input-sidebar-search"
            />
          </div>
        </div>

        <nav className="flex-1 px-3">
          <div className="space-y-1">
            {sidebarNav.map((item) => (
              <button
                key={item.label}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors ${
                  item.active 
                    ? 'bg-primary/10 text-primary font-medium' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Resources
            </p>
            <div className="space-y-1">
              <a
                href="https://attack.mitre.org"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground rounded-md"
              >
                <ExternalLink className="w-4 h-4" />
                MITRE ATT&CK
              </a>
              <a
                href="https://github.com/center-for-threat-informed-defense"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground rounded-md"
              >
                <Boxes className="w-4 h-4" />
                CTID GitHub
              </a>
            </div>
          </div>
        </nav>

        <div className="p-3 border-t border-border">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground rounded-md">
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground rounded-md">
            <HelpCircle className="w-4 h-4" />
            Help
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {view === 'product' && selectedProduct ? (
          <ProductView product={selectedProduct} onBack={handleBack} />
        ) : (
          <div className="p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-foreground">Security Products</h1>
              <p className="text-muted-foreground mt-1">
                Browse CTID-verified product mappings to MITRE ATT&CK detection strategies
              </p>
            </div>

            <div className="mb-6">
              <div className="relative max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for a product..."
                  className="pl-10 h-11 text-base"
                  data-testid="input-product-search"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    activeCategory === cat.id
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background text-foreground border-border hover:border-foreground/30'
                  }`}
                  data-testid={`filter-${cat.id}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleSelectProduct(product)}
                  className="group p-5 bg-card rounded-lg border border-border hover:border-primary/50 hover:shadow-md transition-all text-left"
                  data-testid={`card-product-${product.id}`}
                >
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                    <Database className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <h3 className="font-medium text-foreground group-hover:text-primary transition-colors mb-1">
                    {product.productName}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {product.vendor}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {product.platforms.map(p => (
                      <Badge key={p} variant="secondary" className="text-xs font-normal">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-16">
                <Database className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No products found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search or filters
                </p>
              </div>
            )}

            <div className="mt-12 pt-8 border-t border-border">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold text-foreground">{ctidProducts.length}</div>
                  <div className="text-sm text-muted-foreground mt-1">CTID Products</div>
                </div>
                <div className="p-5 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold text-foreground">{detectionStrategies.length}</div>
                  <div className="text-sm text-muted-foreground mt-1">Detection Strategies</div>
                </div>
                <div className="p-5 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold text-foreground">{Object.keys(dataComponents).length}</div>
                  <div className="text-sm text-muted-foreground mt-1">Data Components</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
