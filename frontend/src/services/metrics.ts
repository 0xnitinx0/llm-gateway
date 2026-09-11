import {
  DashboardMetrics,
  RequestDataPoint,
  CacheBreakdown,
  ActivityLogItem,
  UsageMetrics,
  CompressionMetrics,
  TournamentMetrics,
} from '../types/gateway';
import {
  MOCK_DASHBOARD_METRICS,
  MOCK_REQUEST_OVERVIEW,
  MOCK_CACHE_BREAKDOWN,
  MOCK_RECENT_ACTIVITY,
  MOCK_USAGE_METRICS,
  MOCK_COMPRESSION_METRICS,
  MOCK_TOURNAMENT_METRICS,
} from './mockData';

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  // Simulate minimal async delay for natural feel
  await new Promise((r) => setTimeout(r, 60));
  return MOCK_DASHBOARD_METRICS;
}

export async function getRequestOverviewData(): Promise<RequestDataPoint[]> {
  await new Promise((r) => setTimeout(r, 60));
  return MOCK_REQUEST_OVERVIEW;
}

export async function getCacheBreakdown(): Promise<CacheBreakdown> {
  await new Promise((r) => setTimeout(r, 60));
  return MOCK_CACHE_BREAKDOWN;
}

export async function getRecentActivity(): Promise<ActivityLogItem[]> {
  await new Promise((r) => setTimeout(r, 60));
  return MOCK_RECENT_ACTIVITY;
}

export async function getUsageMetrics(): Promise<UsageMetrics> {
  await new Promise((r) => setTimeout(r, 60));
  return MOCK_USAGE_METRICS;
}

export async function getCompressionMetrics(): Promise<CompressionMetrics> {
  await new Promise((r) => setTimeout(r, 60));
  return MOCK_COMPRESSION_METRICS;
}

export async function getTournamentMetrics(): Promise<TournamentMetrics> {
  await new Promise((r) => setTimeout(r, 60));
  return MOCK_TOURNAMENT_METRICS;
}
