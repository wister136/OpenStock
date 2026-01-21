'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  const isDark = theme === 'dark';

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="h-8 px-3 text-[10px]"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? '白天模式' : '黑夜模式'}
    </Button>
  );
}
