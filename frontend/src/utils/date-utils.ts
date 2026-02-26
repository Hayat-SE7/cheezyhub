import { format, parseISO, isValid } from 'date-fns';

export const safeFormat = (dateInput: any, formatStr: string = 'MMM dd, yyyy') => {
  if (!dateInput) return 'No Date';

  // Attempt to parse if it's a string (common with JSON APIs)
  let date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;

  // Fallback: If parseISO fails, try the standard constructor
  if (!isValid(date)) {
    date = new Date(dateInput);
  }

  // If it's STILL invalid, return a placeholder instead of crashing/erroring
  if (!isValid(date)) {
    console.error("Invalid date received:", dateInput);
    return 'Invalid Date';
  }

  return format(date, formatStr);
};