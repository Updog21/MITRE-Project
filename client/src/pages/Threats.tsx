import { Sidebar } from '@/components/Sidebar';
import { threatGroups, techniques } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, AlertTriangle, Skull } from 'lucide-react';

export default function Threats() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <div className="grid-pattern min-h-full">
          <div className="p-6 space-y-6">
            <header>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Threat Groups</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Track adversary techniques and map defenses against known threat actors
              </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {threatGroups.map((group) => {
                const groupTechniques = techniques.filter(t => 
                  t.usedByThreatGroups.includes(group.name)
                );
                
                return (
                  <Card 
                    key={group.id} 
                    className="bg-card/50 backdrop-blur border-border hover:border-red-500/50 transition-colors"
                    data-testid={`card-threat-${group.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                            <Skull className="w-5 h-5 text-red-400" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{group.name}</CardTitle>
                            <p className="text-xs font-mono text-muted-foreground">{group.id}</p>
                          </div>
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          APT
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-1">
                          {group.aliases.map(alias => (
                            <Badge key={alias} variant="secondary" className="text-xs">
                              {alias}
                            </Badge>
                          ))}
                        </div>
                        
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {group.description}
                        </p>
                        
                        <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-red-400" />
                            <span className="text-muted-foreground">Techniques</span>
                          </div>
                          <span className="font-mono text-red-400 font-bold">{groupTechniques.length}</span>
                        </div>
                        
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {groupTechniques.slice(0, 4).map((technique) => (
                            <div 
                              key={technique.id}
                              className="flex items-center gap-2 text-xs p-1.5 rounded bg-red-500/10 border border-red-500/20"
                            >
                              <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                              <span className="font-mono text-red-400">{technique.id}</span>
                              <span className="text-foreground truncate">{technique.name}</span>
                            </div>
                          ))}
                          {groupTechniques.length > 4 && (
                            <div className="text-xs text-muted-foreground text-center py-1">
                              +{groupTechniques.length - 4} more techniques
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
