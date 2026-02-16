'use client';
import { useState, useRef, useEffect } from 'react';
import { ResponsiveContainer } from 'recharts';

/**
 * A wrapper for Recharts ResponsiveContainer that only renders the chart
 * when the parent container has a valid, non-zero width and height.
 * This prevents the persistent "width(-1) and height(-1)" console warnings.
 */
export default function SafeResponsiveContainer({ children, ...props }) {
    const containerRef = useRef(null);
    const [shouldRender, setShouldRender] = useState(false);
    const timeoutRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const checkAndRender = () => {
            if (!containerRef.current) return;

            const { width, height } = containerRef.current.getBoundingClientRect();

            // Only render if we have strictly positive dimensions
            if (width > 0 && height > 0) {
                // Add a small delay to ensure layout is fully settled
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }

                timeoutRef.current = setTimeout(() => {
                    setShouldRender(true);
                }, 100);
            } else {
                setShouldRender(false);
            }
        };

        // Use ResizeObserver for dynamic resizing
        const resizeObserver = new ResizeObserver(() => {
            // Use requestAnimationFrame to ensure we check after layout
            requestAnimationFrame(checkAndRender);
        });

        resizeObserver.observe(containerRef.current);

        // Initial check
        requestAnimationFrame(checkAndRender);

        return () => {
            resizeObserver.disconnect();
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full" style={{ minHeight: 1, minWidth: 1 }}>
            {shouldRender ? (
                <ResponsiveContainer width="100%" height="100%">
                    {children}
                </ResponsiveContainer>
            ) : null}
        </div>
    );
}
