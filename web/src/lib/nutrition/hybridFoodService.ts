import type { FoodItem } from "./types";
import { FOOD_DATABASE, getFoodById as getLocalFoodById, searchFoods as searchLocalFoods } from "./foodDatabase";
import { OpenFoodFactsClient, type OpenFoodFactsProduct } from "./openFoodFactsClient";
import { UsdaFdcClient } from "./usdaFdcClient";

export interface FoodSearchResult {
  foods: FoodItem[];
  totalCount: number;
  source: 'local' | 'open_food_facts' | 'usda_fdc' | 'hybrid';
  query: string;
  hasMore: boolean;
}

export interface FoodServiceOptions {
  enableOpenFoodFacts?: boolean;
  enableLocalDatabase?: boolean;
  enableUsdaFdc?: boolean;
  enableUserContributions?: boolean;
  usdaApiKey?: string;
  maxResults?: number;
  cacheResults?: boolean;
}

export class HybridFoodService {
  private openFoodFactsClient: OpenFoodFactsClient;
  private usdaFdcClient: UsdaFdcClient | null = null;
  private options: Required<FoodServiceOptions>;
  private cache: Map<string, { data: FoodItem[]; timestamp: number }> = new Map();
  private cacheExpiryMs: number = 5 * 60 * 1000; // 5 minutes

  constructor(options: FoodServiceOptions = {}) {
    this.openFoodFactsClient = new OpenFoodFactsClient();
    
    // Initialize USDA FDC client if enabled and API key is provided
    if (options.enableUsdaFdc && options.usdaApiKey) {
      this.usdaFdcClient = new UsdaFdcClient(options.usdaApiKey);
    }
    
    this.options = {
      enableOpenFoodFacts: true,
      enableLocalDatabase: true,
      enableUsdaFdc: !!(options.enableUsdaFdc && options.usdaApiKey),
      enableUserContributions: true,
      usdaApiKey: options.usdaApiKey || '',
      maxResults: 50,
      cacheResults: true,
      ...options,
    };
  }

  /**
   * Search for foods across all available sources
   */
  async searchFoods(query: string, page: number = 1): Promise<FoodSearchResult> {
    const cacheKey = `search:${query}:${page}`;
    
    // Check cache first
    if (this.options.cacheResults) {
      const cached = this.getFromCache(cacheKey);
      if (cached && cached.data) {
        return {
          foods: cached.data,
          totalCount: cached.data.length,
          source: 'hybrid',
          query,
          hasMore: false, // Cache doesn't know about pagination
        };
      }
    }

    const results: FoodItem[] = [];
    let source: 'local' | 'open_food_facts' | 'usda_fdc' | 'hybrid' = 'local';

    try {
      // 1. Try Open Food Facts first (primary source)
      if (this.options.enableOpenFoodFacts) {
        try {
          const offResults = await this.openFoodFactsClient.searchFoods(query, page, this.options.maxResults);
          const convertedResults = offResults.map(product => this.openFoodFactsClient.convertToFoodItem(product));
          
          if (convertedResults.length > 0) {
            results.push(...convertedResults);
            source = 'open_food_facts';
          }
        } catch (error) {
          console.warn('Open Food Facts search failed, falling back to other sources:', error);
        }
      }

      // 2. Try USDA FDC if enabled and we need more results
      if (this.options.enableUsdaFdc && this.usdaFdcClient && results.length < this.options.maxResults) {
        try {
          const remainingSlots = Math.max(5, this.options.maxResults - results.length);
          const usdaResults = await this.usdaFdcClient.search(query, Math.min(remainingSlots, 10));
          
          // Convert search results to full food details (limit to 5 for performance)
          const detailedResults = await Promise.all(
            usdaResults.slice(0, 5).map(async (searchResult) => {
              try {
                const foodDetail = await this.usdaFdcClient!.getFood(searchResult.fdcId);
                return this.usdaFdcClient!.convertToFoodItem(foodDetail);
              } catch (error) {
                console.warn(`Failed to get USDA food details for ${searchResult.fdcId}:`, error);
                return null;
              }
            })
          );
          
          const validResults = detailedResults.filter(result => result !== null) as FoodItem[];
          results.push(...validResults);
          
          if (validResults.length > 0) {
            source = source === 'open_food_facts' ? 'hybrid' : 'usda_fdc';
          }
        } catch (error) {
          console.warn('USDA FDC search failed, falling back to local database:', error);
        }
      }

      // 3. Fall back to local database if needed
      if (this.options.enableLocalDatabase && results.length < this.options.maxResults) {
        const localResults = searchLocalFoods(query);
        const remainingSlots = this.options.maxResults - results.length;
        const localSlice = localResults.slice(0, remainingSlots);
        
        // Add metadata to local foods
        const localWithMetadata = localSlice.map(food => ({
          ...food,
          metadata: {
            source: 'local' as const,
            confidence: 1.0, // Local data is trusted
          },
        }));
        
        results.push(...localWithMetadata);
        
        if (results.length > 0) {
          source = source === 'open_food_facts' ? 'hybrid' : 'local';
        }
      }

      // 4. Add user contributions if enabled
      if (this.options.enableUserContributions) {
        // TODO: Implement user contributions system
        // This would query a user-contributed foods database
      }

      // Remove duplicates (prioritize Open Food Facts over local)
      const uniqueResults = this.removeDuplicates(results);

      // Cache the results
      if (this.options.cacheResults) {
        this.setCache(cacheKey, uniqueResults);
      }

      return {
        foods: uniqueResults.slice(0, this.options.maxResults),
        totalCount: uniqueResults.length,
        source,
        query,
        hasMore: uniqueResults.length > this.options.maxResults,
      };

    } catch (error) {
      console.error('Food search failed:', error);
      
      // Fallback to local database only
      if (this.options.enableLocalDatabase) {
        const localResults = searchLocalFoods(query);
        return {
          foods: localResults.slice(0, this.options.maxResults),
          totalCount: localResults.length,
          source: 'local',
          query,
          hasMore: localResults.length > this.options.maxResults,
        };
      }
      
      throw new Error(`Food search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get food by ID from any source
   */
  async getFoodById(id: string): Promise<FoodItem | null> {
    // Check local database first
    let food = getLocalFoodById(id);
    if (food) {
      return {
        ...food,
        metadata: {
          source: 'local' as const,
          confidence: 1.0,
        },
      };
    }

    // Check if it's an Open Food Facts ID
    if (id.startsWith('off_')) {
      try {
        const barcode = id.replace('off_', '');
        const product = await this.openFoodFactsClient.getFoodByBarcode(barcode);
        if (product) {
          return this.openFoodFactsClient.convertToFoodItem(product);
        }
      } catch (error) {
        console.warn('Failed to fetch Open Food Facts product:', error);
      }
    }

    // Check if it's a USDA FDC ID
    if (id.startsWith('usda_') && this.options.enableUsdaFdc && this.usdaFdcClient) {
      try {
        const fdcId = parseInt(id.replace('usda_', ''));
        if (!isNaN(fdcId)) {
          const foodDetail = await this.usdaFdcClient.getFood(fdcId);
          return this.usdaFdcClient.convertToFoodItem(foodDetail);
        }
      } catch (error) {
        console.warn('Failed to fetch USDA FDC food:', error);
      }
    }

    // TODO: Check user contributions
    return null;
  }

  /**
   * Get food by barcode
   */
  async getFoodByBarcode(barcode: string): Promise<FoodItem | null> {
    try {
      const product = await this.openFoodFactsClient.getFoodByBarcode(barcode);
      if (product) {
        return this.openFoodFactsClient.convertToFoodItem(product);
      }
    } catch (error) {
      console.warn('Barcode lookup failed:', error);
    }
    return null;
  }

  /**
   * Test the service connectivity
   */
  async testConnectivity(): Promise<{
    localDatabase: boolean;
    openFoodFacts: boolean;
    usdaFdc: boolean;
    overall: boolean;
  }> {
    const results = {
      localDatabase: this.options.enableLocalDatabase && FOOD_DATABASE.length > 0,
      openFoodFacts: false,
      usdaFdc: false,
      overall: false,
    };

    if (this.options.enableOpenFoodFacts) {
      try {
        results.openFoodFacts = await this.openFoodFactsClient.testConnection();
      } catch (error) {
        console.warn('Open Food Facts connectivity test failed:', error);
      }
    }

    if (this.options.enableUsdaFdc && this.usdaFdcClient) {
      try {
        results.usdaFdc = await this.usdaFdcClient.testConnection();
      } catch (error) {
        console.warn('USDA FDC connectivity test failed:', error);
      }
    }

    results.overall = results.localDatabase || results.openFoodFacts || results.usdaFdc;
    return results;
  }

  /**
   * Get statistics about available data sources
   */
  getStats(): {
    localFoods: number;
    openFoodFactsAvailable: boolean;
    usdaFdcAvailable: boolean;
    cacheSize: number;
    cacheHitRate: number;
  } {
    return {
      localFoods: FOOD_DATABASE.length,
      openFoodFactsAvailable: this.options.enableOpenFoodFacts,
      usdaFdcAvailable: this.options.enableUsdaFdc,
      cacheSize: this.cache.size,
      cacheHitRate: 0, // TODO: Implement cache hit tracking
    };
  }

  /**
   * Remove duplicate foods (prioritize Open Food Facts)
   */
  private removeDuplicates(foods: FoodItem[]): FoodItem[] {
    const seen = new Set<string>();
    const result: FoodItem[] = [];
    
    // Sort by source priority: Open Food Facts > USDA FDC > Local > User
    const priorityOrder = ['open_food_facts', 'usda_fdc', 'local', 'user_contributed'];
    
    foods.sort((a, b) => {
      const aPriority = priorityOrder.indexOf(a.metadata?.source || 'local');
      const bPriority = priorityOrder.indexOf(b.metadata?.source || 'local');
      return aPriority - bPriority;
    });

    for (const food of foods) {
      // Create a key based on name similarity
      const key = food.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (!seen.has(key)) {
        seen.add(key);
        result.push(food);
      }
    }

    return result;
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): { data: FoodItem[]; timestamp: number } | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      return cached;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: FoodItem[]): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    
    // Clean up old cache entries
    if (this.cache.size > 100) {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.cacheExpiryMs) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
