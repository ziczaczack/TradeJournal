'use client';

import { MotionConfig } from 'framer-motion';
import { ReactNode } from 'react';

interface MotionProviderProps {
    children: ReactNode;
}

// Honours the OS "reduce motion" setting for every framer-motion animation:
// transform and layout animations are skipped, opacity fades still run.
export function MotionProvider({ children }: MotionProviderProps) {
    return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
