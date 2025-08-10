export interface FdcSearchResult {
  fdcId: number;
  description: string;
  brandOwner?: string;
}

export interface FdcNutrient {
  nutrientId: number;
  nutrientName: string;
  unitName: string;
  value: number;
}

export interface FdcFoodDetail {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients: FdcNutrient[];
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
}

export class UsdaFdcClient {
  private apiKey: string;
  private baseUrl: string = "https://api.nal.usda.gov/fdc";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, pageSize: number = 10): Promise<FdcSearchResult[]> {
    const url = new URL(`${this.baseUrl}/v1/foods/search`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("query", query);
    url.searchParams.set("pageSize", String(pageSize));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`FDC search failed: ${res.status}`);
    const json = await res.json();
    return (json.foods ?? []).map((f: any) => ({
      fdcId: f.fdcId,
      description: f.description,
      brandOwner: f.brandOwner,
    }));
  }

  async getFood(fdcId: number): Promise<FdcFoodDetail> {
    const url = new URL(`${this.baseUrl}/v1/food/${fdcId}`);
    url.searchParams.set("api_key", this.apiKey);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`FDC getFood failed: ${res.status}`);
    const json = await res.json();
    return json as FdcFoodDetail;
  }
}

