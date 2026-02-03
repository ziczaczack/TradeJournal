'use client';

import { useEffect, useRef } from 'react';
import { useSpring, useTransform, motion, useInView } from 'framer-motion';

interface AnimatedNumberProps {
    value: number;
    format?: 'currency' | 'percent' | 'number';
    duration?: number;
    className?: string;
    prefix?: string;
    suffix?: string;
    decimals?: number;
}

export function AnimatedNumber({
    value,
    format = 'number',
    duration = 1,
    className = '',
    prefix = '',
    suffix = '',
    decimals = 0,
}: AnimatedNumberProps) {
    const ref = useRef<HTMLSpanElement>(null);
    const isInView = useInView(ref, { once: true, margin: '-50px' });

    const spring = useSpring(0, {
        damping: 30,
        stiffness: 100,
        duration: duration * 1000,
    });

    const display = useTransform(spring, (current) => {
        const rounded = Number(current.toFixed(decimals));

        switch (format) {
            case 'currency':
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    signDisplay: 'always',
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals,
                }).format(rounded);
            case 'percent':
                return `${rounded.toFixed(decimals)}%`;
            default:
                return rounded.toLocaleString('en-US');
        }
    });

    useEffect(() => {
        if (isInView) {
            spring.set(value);
        }
    }, [spring, value, isInView]);

    return (
        <motion.span ref={ref} className={className}>
            {prefix}
            <motion.span>{display}</motion.span>
            {suffix}
        </motion.span>
    );
}

export default AnimatedNumber;
