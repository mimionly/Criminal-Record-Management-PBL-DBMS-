/**
 * Formats ISO strings into reader-friendly dates.
 */
export const formatDate = (dateString: string): string => {
  try {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-IN', options);
  } catch {
    return dateString;
  }
};

/**
 * Formats numbers as Indian Rupee currency representations.
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);
};
