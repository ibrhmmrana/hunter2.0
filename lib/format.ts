/**
 * Number formatting utilities
 */

/**
 * Manually format a number with commas for thousands separators.
 * This ensures consistent formatting on both server and client.
 */
function formatNumberWithCommas(num: number): string {
  // Convert to string and split by decimal point
  const parts = num.toString().split('.');
  // Add commas to the integer part
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Join back together
  return parts.join('.');
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '0';
  return formatNumberWithCommas(num);
}

export function formatReviewCount(count: number | null | undefined): string {
  if (count === null || count === undefined) return '0';
  return formatNumber(count);
}

export function formatPercent(num: number | null | undefined, decimals: number = 1): string {
  if (num === null || num === undefined) return '0%';
  return `${num.toFixed(decimals)}%`;
}

