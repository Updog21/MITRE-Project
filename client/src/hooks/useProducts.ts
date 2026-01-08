import { useQuery } from "@tanstack/react-query";

export interface Product {
  id: number;
  productId: string;
  vendor: string;
  productName: string;
  deployment?: string | null;
  description: string;
  platforms: string[];
  dataComponentIds: string[];
  mitreAssetIds: string[] | null;
  source: string;
  createdAt: string;
}

async function searchProducts(query: string): Promise<Product[]> {
  const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error('Failed to search products');
  }
  return response.json();
}

export function useSearchProducts(query: string) {
  return useQuery({
    queryKey: ['products', 'search', query],
    queryFn: () => searchProducts(query),
    enabled: query.trim().length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
