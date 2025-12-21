'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface LiquidSwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
}

const LiquidSwitch = React.forwardRef<HTMLInputElement, LiquidSwitchProps>(
    ({ className, checked, onCheckedChange, ...props }, ref) => {
        return (
            <input
                type="checkbox"
                ref={ref}
                checked={checked}
                onChange={(e) => onCheckedChange?.(e.target.checked)}
                className={cn('liquid-switch', className)}
                {...props}
            />
        );
    }
);

LiquidSwitch.displayName = 'LiquidSwitch';

export { LiquidSwitch };
