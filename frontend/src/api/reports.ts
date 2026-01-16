import api from "./client";

export type YtdMonthlyRevenueResponse = {
  year: number;
  months: Array<{ month: number; label: string; amount: number }>;
  totalYtd: number;
};

export async function fetchYtdMonthlyRevenue(): Promise<YtdMonthlyRevenueResponse> {
  const res = await api.get<YtdMonthlyRevenueResponse>("/reports/revenue/ytd-monthly");
  return res.data;
}
