import { useEffect, useRef } from 'react';
import { useMotionValue, useSpring } from 'framer-motion';

/**
 * useMagneticEffect
 * Calculates the relative position of the cursor and applies a smooth spring-based
 * attraction force to the referenced element when within a proximity range.
 *
 * @param range The active range of the proximity field in pixels
 * @param strength The scaling factor of the magnetic pull (default: 0.35, max 15px displacement)
 */
export function useMagneticEffect(range = 60, strength = 0.25) {
    const ref = useRef<any>(null);
    
    // Core spring physics for microinteractions: stiffness: 350, damping: 25, mass: 0.5
    const springConfig = { stiffness: 350, damping: 25, mass: 0.5 };
    
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    
    const springX = useSpring(x, springConfig);
    const springY = useSpring(y, springConfig);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!ref.current) return;
            
            const rect = ref.current.getBoundingClientRect();
            const elX = rect.left + rect.width / 2;
            const elY = rect.top + rect.height / 2;
            
            const distanceX = e.clientX - elX;
            const distanceY = e.clientY - elY;
            const distance = Math.hypot(distanceX, distanceY);
            
            if (distance < range) {
                // Restrict displacement to a maximum of 15px
                const pullX = Math.max(-15, Math.min(15, distanceX * strength));
                const pullY = Math.max(-15, Math.min(15, distanceY * strength));
                x.set(pullX);
                y.set(pullY);
            } else {
                x.set(0);
                y.set(0);
            }
        };

        const handleMouseLeave = () => {
            x.set(0);
            y.set(0);
        };

        window.addEventListener('mousemove', handleMouseMove);
        
        // Save direct reference for cleanup
        const element = ref.current;
        if (element) {
            element.addEventListener('mouseleave', handleMouseLeave);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (element) {
                element.removeEventListener('mouseleave', handleMouseLeave);
            }
        };
    }, [x, y, range, strength]);

    return { ref, x: springX, y: springY };
}
