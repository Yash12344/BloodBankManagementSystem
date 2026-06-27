/** Pure camp finance summary. Money in integer minor units. */
export interface CampFinance {
  expenseMinor: number;
  revenueMinor: number;
  netMinor: number; // revenue - expenses (negative = net cost)
}

export function summarizeCampFinance(expenseAmounts: number[], revenueMinor: number): CampFinance {
  const expenseMinor = expenseAmounts.reduce((sum, a) => sum + a, 0);
  return { expenseMinor, revenueMinor, netMinor: revenueMinor - expenseMinor };
}
