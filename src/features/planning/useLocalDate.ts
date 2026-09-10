import { useEffect, useState } from 'react';

function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function useLocalDate(override?: string): string {
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(localDate()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return override ?? today;
}
