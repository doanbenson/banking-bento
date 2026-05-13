const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export const formatCurrency = (amount: number | null): string => {
  if (amount === null) return 'N/A';
  return usdFormatter.format(amount);
};

export const formatAbsoluteCurrency = (amount: number): string => {
  return usdFormatter.format(Math.abs(amount));
};

export const formatShortDate = (dateString: string): string => {
  return shortDateFormatter.format(new Date(dateString));
};
