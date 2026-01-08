import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Cpu, 
  Sparkles, 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare, 
  Plus, 
  Trash2, 
  CheckCircle2,
  Loader2,
  Save,
  RotateCcw
} from 'lucide-react';
import { generateAIMapping, ProductMapping, MappingReview, saveCustomMapping, techniques as allTechniques } from '@/lib/v18Data';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AIMapperFlowProps {
  initialQuery?: string;
  onComplete: () => void;
  onCancel: () => void;
}

type Step = 'input' | 'analyzing' | 'review' | 'complete';

export function AIMapperFlow({ initialQuery, onComplete, onCancel }: AIMapperFlowProps) {
  const [step, setStep] = useState<Step>('input');
  const [vendor, setVendor] = useState('');
  const [product, setProduct] = useState(initialQuery || '');
  const [details, setDetails] = useState('');
  const [mapping, setMapping] = useState<ProductMapping | null>(null);
  const [reviews, setReviews] = useState<MappingReview[]>([]);
  const [feedbackText, setFeedbackText] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { toast } = useToast();

  const handleAnalyze = () => {
    if (!vendor || !product) {
      toast({
        title: 'Missing information',
        description: 'Please provide both vendor and product name.',
        variant: 'destructive',
      });
      return;
    }

    setStep('analyzing');
    
    setTimeout(() => {
      const result = generateAIMapping(vendor, product, details);
      setMapping(result);
      setReviews(result.techniques.map(t => ({
        techniqueId: t.id,
        status: 'pending',
        confidence: Math.floor(Math.random() * 30) + 70,
      })));
      setStep('review');
    }, 2500);
  };

  const handleReviewTechnique = (techniqueId: string, status: 'approved' | 'rejected') => {
    setReviews(prev => prev.map(r => 
      r.techniqueId === techniqueId ? { ...r, status } : r
    ));
  };

  const handleAddFeedback = (techniqueId: string, feedback: string) => {
    setReviews(prev => prev.map(r => 
      r.techniqueId === techniqueId ? { ...r, feedback } : r
    ));
  };

  const handleRegenerate = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      if (mapping) {
        const newTechnique = allTechniques.find(t => !mapping.techniques.find(mt => mt.id === t.id));
        if (newTechnique) {
          setMapping({
            ...mapping,
            techniques: [...mapping.techniques, newTechnique],
          });
          setReviews(prev => [...prev, {
            techniqueId: newTechnique.id,
            status: 'pending',
            confidence: 78,
          }]);
        }
      }
      setIsRegenerating(false);
      toast({
        title: 'AI Re-analyzed',
        description: 'Mapping updated based on your feedback.',
      });
    }, 1500);
  };

  const handleSave = () => {
    if (!mapping) return;
    
    const approvedReviews = reviews.filter(r => r.status === 'approved' || r.status === 'pending');
    saveCustomMapping(mapping, approvedReviews);
    
    setStep('complete');
    toast({
      title: 'Mapping Saved',
      description: `${product} has been added to your custom mappings.`,
    });
    
    setTimeout(onComplete, 1500);
  };

  const handleRemoveTechnique = (techniqueId: string) => {
    if (!mapping) return;
    setMapping({
      ...mapping,
      techniques: mapping.techniques.filter(t => t.id !== techniqueId),
    });
    setReviews(prev => prev.filter(r => r.techniqueId !== techniqueId));
  };

  if (step === 'input') {
    return (
      <Card className="bg-card/50 backdrop-blur border-border max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            AI Mapping Request
          </CardTitle>
          <CardDescription>
            Provide details about the product you want to map to MITRE ATT&CK techniques
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor Name</Label>
              <Input
                id="vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g., Microsoft, Cisco, Palo Alto"
                className="bg-background"
                data-testid="input-ai-vendor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product">Product Name</Label>
              <Input
                id="product"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="e.g., Defender for Endpoint"
                className="bg-background"
                data-testid="input-ai-product"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="details">Deployment Details / Version</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g., Cloud deployment, Enterprise license, v2.5..."
              className="bg-background min-h-[80px]"
              data-testid="input-ai-details"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={onCancel} className="flex-1" data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleAnalyze} className="flex-1" data-testid="button-analyze">
              <Sparkles className="w-4 h-4 mr-2" />
              Analyze with AI
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'analyzing') {
    return (
      <Card className="bg-card/50 backdrop-blur border-border max-w-2xl mx-auto">
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Cpu className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Analyzing {product}...</h3>
          <p className="text-muted-foreground text-sm mb-4">
            AI is mapping logging capabilities to MITRE ATT&CK techniques
          </p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Identifying data components...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'review' && mapping) {
    const pendingCount = reviews.filter(r => r.status === 'pending').length;
    const approvedCount = reviews.filter(r => r.status === 'approved').length;
    const rejectedCount = reviews.filter(r => r.status === 'rejected').length;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Review AI Mapping</h2>
            <p className="text-sm text-muted-foreground">
              {vendor} {product} - Review and refine the proposed technique mappings
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{pendingCount} pending</Badge>
            <Badge className="bg-green-500/20 text-green-400">{approvedCount} approved</Badge>
            <Badge className="bg-red-500/20 text-red-400">{rejectedCount} rejected</Badge>
          </div>
        </div>

        <Card className="bg-card/50 backdrop-blur border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Proposed Technique Mappings</CardTitle>
            <CardDescription>
              Approve, reject, or provide feedback on each mapping. The AI will re-iterate based on your input.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mapping.techniques.map((technique) => {
              const review = reviews.find(r => r.techniqueId === technique.id);
              return (
                <div 
                  key={technique.id}
                  className={cn(
                    "p-4 rounded-lg border transition-all",
                    review?.status === 'approved' && "bg-green-500/10 border-green-500/30",
                    review?.status === 'rejected' && "bg-red-500/10 border-red-500/30",
                    review?.status === 'pending' && "bg-muted/30 border-border"
                  )}
                  data-testid={`review-technique-${technique.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-primary">{technique.id}</span>
                        <Badge variant="secondary" className="text-xs">
                          {review?.confidence}% confidence
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-foreground">{technique.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{technique.description}</p>
                      <div className="text-xs text-muted-foreground mt-2">
                        Tactic: {technique.tactic}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={review?.status === 'approved' ? 'default' : 'secondary'}
                        onClick={() => handleReviewTechnique(technique.id, 'approved')}
                        data-testid={`button-approve-${technique.id}`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={review?.status === 'rejected' ? 'destructive' : 'secondary'}
                        onClick={() => handleReviewTechnique(technique.id, 'rejected')}
                        data-testid={`button-reject-${technique.id}`}
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveTechnique(technique.id)}
                        data-testid={`button-remove-${technique.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  
                  {review?.feedback && (
                    <div className="mt-3 p-2 rounded bg-muted/50 text-sm">
                      <MessageSquare className="w-3 h-3 inline mr-1" />
                      {review.feedback}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Feedback for AI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Provide additional context or corrections for the AI to improve mappings..."
                className="bg-background min-h-[60px]"
                data-testid="input-feedback"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <Button 
                variant="secondary" 
                onClick={handleRegenerate}
                disabled={isRegenerating}
                data-testid="button-regenerate"
              >
                {isRegenerating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-2" />
                )}
                Re-iterate with AI
              </Button>
              <Button 
                variant="secondary"
                data-testid="button-add-technique"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Technique Manually
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-1" data-testid="button-cancel-review">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1" data-testid="button-save-mapping">
            <Save className="w-4 h-4 mr-2" />
            Save to Custom Repository
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <Card className="bg-card/50 backdrop-blur border-green-500/30 max-w-2xl mx-auto">
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Mapping Saved!</h3>
          <p className="text-muted-foreground text-sm">
            {product} has been added to your custom repository and will appear in future searches.
          </p>
        </CardContent>
      </Card>
    );
  }

  return null;
}
