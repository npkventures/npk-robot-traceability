'use client';

import { type ReactNode } from 'react';
import { SonarGrid } from '@/components/ui/sonar-grid';

export function HeroSonar({ children }: { children: ReactNode }) {
  return <SonarGrid className="t-hero-sonar" color="#356149" spacing={30} dotRadius={1}
    baseOpacity={.13} amplitude={1.5} pingEvery={3.2} ringWidth={80} interactive={false}>
    {children}
  </SonarGrid>;
}
