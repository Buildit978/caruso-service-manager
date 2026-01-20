import { http } from "./http";

export type YtdMonthlyRevenueResponse = {
  year: number;
  months: Array<{ month: number; label: string; amount: number }>;
  totalYtd: number;
};

export async function fetchYtdMonthlyRevenue(): Promise<YtdMonthlyRevenueResponse> {
  return await http<YtdMonthlyRevenueResponse>("/reports/revenue/ytd-monthly");
}
