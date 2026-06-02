'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCelebration } from '@/hooks/use-celebration';

export function CelebrationEffect() {
  const params = useSearchParams();
  const { celebrate } = useCelebration();

  useEffect(() => {
    if (params.get('celebration') === 'true') {
      const t = setTimeout(() => celebrate(), 600);
      return () => clearTimeout(t);
    }
  }, [params, celebrate]);

  return null;
}
