import { NextRequest } from "next/server";
import { getQualityMetricsService } from "@/lib/llm/qualityMetrics";
import { getNutritionService } from "@/lib/llm/nutritionService";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "status";
    const timeRange = parseInt(url.searchParams.get("hours") || "24");

    const qualityService = getQualityMetricsService();
    const nutritionService = getNutritionService();

    switch (action) {
      case "status":
        const status = qualityService.getQualityStatus();
        return Response.json({
          success: true,
          data: status,
          timestamp: Date.now(),
        });

      case "report":
        const report = qualityService.generateQualityReport(timeRange);
        return Response.json({
          success: true,
          data: report,
          timestamp: Date.now(),
        });

      case "stats":
        const stats = qualityService.getStatistics(timeRange);
        return Response.json({
          success: true,
          data: stats,
          timestamp: Date.now(),
        });

      case "health":
        const nutritionConnectivity = await nutritionService.testConnectivity();
        const qualityStatus = qualityService.getQualityStatus();
        
        return Response.json({
          success: true,
          data: {
            nutrition: nutritionConnectivity.data,
            quality: qualityStatus,
            overall: nutritionConnectivity.success && qualityStatus.status !== 'critical' ? 'healthy' : 'degraded',
          },
          timestamp: Date.now(),
        });

      default:
        return Response.json({
          success: false,
          error: "Invalid action. Use: status, report, stats, or health",
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Metrics endpoint error:", error);
    return Response.json({
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { interactionId, feedback } = await req.json();
    
    if (!interactionId || !feedback) {
      return Response.json({
        success: false,
        error: "Missing interactionId or feedback",
      }, { status: 400 });
    }

    const qualityService = getQualityMetricsService();
    const success = qualityService.recordUserFeedback(interactionId, feedback);

    if (success) {
      return Response.json({
        success: true,
        message: "Feedback recorded successfully",
      });
    } else {
      return Response.json({
        success: false,
        error: "Interaction not found",
      }, { status: 404 });
    }
  } catch (error) {
    console.error("Feedback recording error:", error);
    return Response.json({
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}