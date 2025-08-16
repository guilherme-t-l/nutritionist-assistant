import { getResponseValidator, type ResponseMetrics, type ValidationResult } from "./responseValidator";

export interface InteractionMetrics {
  id: string;
  timestamp: number;
  sessionId: string;
  userQuery: string;
  agentResponse: string;
  responseTime: number; // milliseconds
  validationResult: ValidationResult;
  responseMetrics: ResponseMetrics;
  userFeedback?: UserFeedback;
  context?: {
    preferences?: any;
    planDoc?: string;
    provider?: string;
    model?: string;
  };
}

export interface UserFeedback {
  rating: number; // 1-5 stars
  helpful: boolean;
  accurate: boolean;
  safe: boolean;
  relevant: boolean;
  comments?: string;
  timestamp: number;
}

export interface QualityReport {
  timeRange: {
    start: number;
    end: number;
  };
  totalInteractions: number;
  averageScores: {
    overall: number;
    safety: number;
    accuracy: number;
    relevance: number;
    completeness: number;
    userSatisfaction: number;
  };
  issueBreakdown: {
    [issueType: string]: {
      count: number;
      severity: string;
      trend: 'improving' | 'stable' | 'degrading';
    };
  };
  performanceTrends: {
    responseTime: {
      average: number;
      trend: 'improving' | 'stable' | 'degrading';
    };
    successRate: number;
    validationRate: number;
  };
  recommendations: string[];
}

export interface QualityBenchmarks {
  minimumSafetyScore: number;
  minimumAccuracyScore: number;
  minimumRelevanceScore: number;
  maximumResponseTime: number;
  minimumUserSatisfaction: number;
  maxCriticalIssuesPerDay: number;
}

export class QualityMetricsService {
  private interactions: Map<string, InteractionMetrics> = new Map();
  private responseValidator = getResponseValidator();
  
  // Quality benchmarks
  private benchmarks: QualityBenchmarks = {
    minimumSafetyScore: 0.9,
    minimumAccuracyScore: 0.8,
    minimumRelevanceScore: 0.7,
    maximumResponseTime: 5000, // 5 seconds
    minimumUserSatisfaction: 4.0, // out of 5
    maxCriticalIssuesPerDay: 0,
  };

  /**
   * Record a new interaction for quality analysis
   */
  async recordInteraction(
    sessionId: string,
    userQuery: string,
    agentResponse: string,
    responseTime: number,
    context?: any
  ): Promise<string> {
    const id = this.generateInteractionId();
    const timestamp = Date.now();

    // Validate response and calculate metrics
    const validationResult = await this.responseValidator.validateResponse(
      agentResponse,
      userQuery,
      context
    );
    
    const responseMetrics = await this.responseValidator.calculateMetrics(
      agentResponse,
      userQuery,
      context
    );

    const interaction: InteractionMetrics = {
      id,
      timestamp,
      sessionId,
      userQuery,
      agentResponse,
      responseTime,
      validationResult,
      responseMetrics,
      context,
    };

    this.interactions.set(id, interaction);

    // Log critical issues immediately
    if (validationResult.safetyLevel === 'unsafe') {
      console.error('CRITICAL SAFETY ISSUE:', {
        interactionId: id,
        issues: validationResult.issues,
        query: userQuery,
        response: agentResponse.substring(0, 200) + '...',
      });
    }

    // Clean up old interactions (keep last 1000)
    this.cleanupOldInteractions();

    return id;
  }

  /**
   * Record user feedback for an interaction
   */
  recordUserFeedback(interactionId: string, feedback: Omit<UserFeedback, 'timestamp'>): boolean {
    const interaction = this.interactions.get(interactionId);
    if (!interaction) {
      return false;
    }

    interaction.userFeedback = {
      ...feedback,
      timestamp: Date.now(),
    };

    this.interactions.set(interactionId, interaction);
    return true;
  }

  /**
   * Generate a comprehensive quality report
   */
  generateQualityReport(timeRangeHours: number = 24): QualityReport {
    const now = Date.now();
    const startTime = now - (timeRangeHours * 60 * 60 * 1000);
    
    const relevantInteractions = Array.from(this.interactions.values())
      .filter(interaction => interaction.timestamp >= startTime);

    const totalInteractions = relevantInteractions.length;

    if (totalInteractions === 0) {
      return this.getEmptyReport(startTime, now);
    }

    // Calculate average scores
    const averageScores = this.calculateAverageScores(relevantInteractions);
    
    // Analyze issue breakdown
    const issueBreakdown = this.analyzeIssueBreakdown(relevantInteractions);
    
    // Calculate performance trends
    const performanceTrends = this.calculatePerformanceTrends(relevantInteractions);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(averageScores, issueBreakdown, performanceTrends);

    return {
      timeRange: { start: startTime, end: now },
      totalInteractions,
      averageScores,
      issueBreakdown,
      performanceTrends,
      recommendations,
    };
  }

  /**
   * Get real-time quality status
   */
  getQualityStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: {
      safetyScore: number;
      accuracyScore: number;
      userSatisfaction: number;
      responseTime: number;
    };
  } {
    const recentInteractions = this.getRecentInteractions(1); // Last hour
    
    if (recentInteractions.length === 0) {
      return {
        status: 'healthy',
        issues: [],
        metrics: {
          safetyScore: 1.0,
          accuracyScore: 1.0,
          userSatisfaction: 5.0,
          responseTime: 0,
        },
      };
    }

    const averageScores = this.calculateAverageScores(recentInteractions);
    const issues: string[] = [];
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check against benchmarks
    if (averageScores.safety < this.benchmarks.minimumSafetyScore) {
      issues.push(`Safety score (${averageScores.safety.toFixed(2)}) below minimum`);
      status = 'critical';
    }
    
    if (averageScores.accuracy < this.benchmarks.minimumAccuracyScore) {
      issues.push(`Accuracy score (${averageScores.accuracy.toFixed(2)}) below minimum`);
      if (status !== 'critical') status = 'warning';
    }
    
    if (averageScores.relevance < this.benchmarks.minimumRelevanceScore) {
      issues.push(`Relevance score (${averageScores.relevance.toFixed(2)}) below minimum`);
      if (status !== 'critical') status = 'warning';
    }

    const avgResponseTime = recentInteractions.reduce((sum, i) => sum + i.responseTime, 0) / recentInteractions.length;
    if (avgResponseTime > this.benchmarks.maximumResponseTime) {
      issues.push(`Response time (${avgResponseTime}ms) above maximum`);
      if (status !== 'critical') status = 'warning';
    }

    if (averageScores.userSatisfaction < this.benchmarks.minimumUserSatisfaction) {
      issues.push(`User satisfaction (${averageScores.userSatisfaction.toFixed(1)}) below minimum`);
      if (status !== 'critical') status = 'warning';
    }

    return {
      status,
      issues,
      metrics: {
        safetyScore: averageScores.safety,
        accuracyScore: averageScores.accuracy,
        userSatisfaction: averageScores.userSatisfaction,
        responseTime: avgResponseTime,
      },
    };
  }

  /**
   * Get statistics for monitoring dashboards
   */
  getStatistics(timeRangeHours: number = 24): any {
    const interactions = this.getRecentInteractions(timeRangeHours);
    
    if (interactions.length === 0) {
      return {
        totalInteractions: 0,
        avgResponseTime: 0,
        safetyIssues: 0,
        userSatisfaction: 0,
        dataSourcesUsed: [],
      };
    }

    const safetyIssues = interactions.filter(i => 
      i.validationResult.safetyLevel !== 'safe'
    ).length;

    const avgResponseTime = interactions.reduce((sum, i) => sum + i.responseTime, 0) / interactions.length;
    
    const feedbackInteractions = interactions.filter(i => i.userFeedback);
    const avgUserSatisfaction = feedbackInteractions.length > 0
      ? feedbackInteractions.reduce((sum, i) => sum + (i.userFeedback?.rating || 0), 0) / feedbackInteractions.length
      : 0;

    const dataSourcesUsed = new Set<string>();
    interactions.forEach(i => {
      i.responseMetrics.dataSourcesUsed.forEach(source => dataSourcesUsed.add(source));
    });

    return {
      totalInteractions: interactions.length,
      avgResponseTime,
      safetyIssues,
      userSatisfaction: avgUserSatisfaction,
      dataSourcesUsed: Array.from(dataSourcesUsed),
      validationRate: interactions.filter(i => i.validationResult.isValid).length / interactions.length,
      withFeedback: feedbackInteractions.length,
    };
  }

  /**
   * Private helper methods
   */
  private generateInteractionId(): string {
    return `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanupOldInteractions(): void {
    const interactions = Array.from(this.interactions.entries())
      .sort((a, b) => b[1].timestamp - a[1].timestamp);
    
    // Keep only the most recent 1000 interactions
    if (interactions.length > 1000) {
      const toKeep = interactions.slice(0, 1000);
      this.interactions.clear();
      toKeep.forEach(([id, interaction]) => {
        this.interactions.set(id, interaction);
      });
    }
  }

  private getRecentInteractions(hours: number): InteractionMetrics[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return Array.from(this.interactions.values())
      .filter(interaction => interaction.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  private calculateAverageScores(interactions: InteractionMetrics[]): QualityReport['averageScores'] {
    if (interactions.length === 0) {
      return {
        overall: 0,
        safety: 0,
        accuracy: 0,
        relevance: 0,
        completeness: 0,
        userSatisfaction: 0,
      };
    }

    const totals = interactions.reduce((acc, interaction) => {
      const metrics = interaction.responseMetrics;
      return {
        overall: acc.overall + metrics.overallScore,
        safety: acc.safety + metrics.safetyScore,
        accuracy: acc.accuracy + metrics.accuracyScore,
        relevance: acc.relevance + metrics.relevanceScore,
        completeness: acc.completeness + metrics.completenessScore,
        userSatisfaction: acc.userSatisfaction + (interaction.userFeedback?.rating || 0),
      };
    }, {
      overall: 0,
      safety: 0,
      accuracy: 0,
      relevance: 0,
      completeness: 0,
      userSatisfaction: 0,
    });

    const feedbackCount = interactions.filter(i => i.userFeedback).length;

    return {
      overall: totals.overall / interactions.length,
      safety: totals.safety / interactions.length,
      accuracy: totals.accuracy / interactions.length,
      relevance: totals.relevance / interactions.length,
      completeness: totals.completeness / interactions.length,
      userSatisfaction: feedbackCount > 0 ? totals.userSatisfaction / feedbackCount : 0,
    };
  }

  private analyzeIssueBreakdown(interactions: InteractionMetrics[]): QualityReport['issueBreakdown'] {
    const issueBreakdown: QualityReport['issueBreakdown'] = {};

    interactions.forEach(interaction => {
      interaction.validationResult.issues.forEach(issue => {
        const key = `${issue.type}_${issue.severity}`;
        if (!issueBreakdown[key]) {
          issueBreakdown[key] = {
            count: 0,
            severity: issue.severity,
            trend: 'stable', // Would calculate based on historical data
          };
        }
        issueBreakdown[key].count++;
      });
    });

    return issueBreakdown;
  }

  private calculatePerformanceTrends(interactions: InteractionMetrics[]): QualityReport['performanceTrends'] {
    const avgResponseTime = interactions.reduce((sum, i) => sum + i.responseTime, 0) / interactions.length;
    const successRate = interactions.filter(i => i.validationResult.isValid).length / interactions.length;
    const validationRate = interactions.filter(i => i.validationResult.score > 0.8).length / interactions.length;

    return {
      responseTime: {
        average: avgResponseTime,
        trend: 'stable', // Would calculate based on historical comparison
      },
      successRate,
      validationRate,
    };
  }

  private generateRecommendations(
    averageScores: QualityReport['averageScores'],
    issueBreakdown: QualityReport['issueBreakdown'],
    performanceTrends: QualityReport['performanceTrends']
  ): string[] {
    const recommendations: string[] = [];

    if (averageScores.safety < this.benchmarks.minimumSafetyScore) {
      recommendations.push('Improve safety validation and add more comprehensive disclaimers');
    }

    if (averageScores.accuracy < this.benchmarks.minimumAccuracyScore) {
      recommendations.push('Enhance fact-checking against nutrition database and improve source attribution');
    }

    if (averageScores.relevance < this.benchmarks.minimumRelevanceScore) {
      recommendations.push('Fine-tune response relevance and improve query understanding');
    }

    if (performanceTrends.responseTime.average > this.benchmarks.maximumResponseTime) {
      recommendations.push('Optimize response generation and consider model performance improvements');
    }

    if (averageScores.userSatisfaction < this.benchmarks.minimumUserSatisfaction) {
      recommendations.push('Collect more user feedback and analyze dissatisfaction patterns');
    }

    // Check for specific issue patterns
    const criticalIssues = Object.values(issueBreakdown).filter(issue => issue.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push('Address critical safety and medical advice issues immediately');
    }

    if (recommendations.length === 0) {
      recommendations.push('Quality metrics are within acceptable ranges - continue monitoring');
    }

    return recommendations;
  }

  private getEmptyReport(startTime: number, endTime: number): QualityReport {
    return {
      timeRange: { start: startTime, end: endTime },
      totalInteractions: 0,
      averageScores: {
        overall: 0,
        safety: 0,
        accuracy: 0,
        relevance: 0,
        completeness: 0,
        userSatisfaction: 0,
      },
      issueBreakdown: {},
      performanceTrends: {
        responseTime: { average: 0, trend: 'stable' },
        successRate: 0,
        validationRate: 0,
      },
      recommendations: ['No interactions recorded in this time period'],
    };
  }
}

// Singleton instance
let qualityMetricsService: QualityMetricsService | null = null;

export function getQualityMetricsService(): QualityMetricsService {
  if (!qualityMetricsService) {
    qualityMetricsService = new QualityMetricsService();
  }
  return qualityMetricsService;
}