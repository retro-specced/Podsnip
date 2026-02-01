import React, { useRef, useState, useEffect, ReactNode } from 'react';
import './ScrollableContainer.css';

interface ScrollableContainerProps {
    children: ReactNode;
    className?: string; // Applied to the inner scroll content
    containerClassName?: string; // Applied to the wrapper
    style?: React.CSSProperties;
    innerRef?: React.RefObject<HTMLDivElement>; // To access the scrolling element from parent
    onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
    fadeDelay?: number;
}

export const ScrollableContainer: React.FC<ScrollableContainerProps> = ({
    children,
    className = '',
    containerClassName = '',
    style,
    innerRef,
    onScroll,
    fadeDelay = 1000,
}) => {
    const localRef = useRef<HTMLDivElement>(null);
    const scrollRef = innerRef || localRef; // Use passed ref or local one

    const scrollbarTrackRef = useRef<HTMLDivElement>(null);
    const scrollbarThumbRef = useRef<HTMLDivElement>(null);
    const scrollbarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Custom Scrollbar State
    const [isScrollbarVisible, setIsScrollbarVisible] = useState(false);
    const [isScrollbarDragging, setIsScrollbarDragging] = useState(false);

    const dragStartY = useRef(0);
    const scrollStartY = useRef(0);

    // Update scrollbar thumb position
    const updateScrollbar = () => {
        const container = scrollRef.current;
        const thumb = scrollbarThumbRef.current;
        const track = scrollbarTrackRef.current;

        if (!container || !thumb || !track) return;

        const { scrollTop, scrollHeight, clientHeight } = container;

        // Hide if content fits
        if (scrollHeight <= clientHeight) {
            thumb.style.display = 'none';
            return;
        }
        thumb.style.display = 'block';

        const trackHeight = track.clientHeight;
        // Calculate thumb height proportional to view
        const thumbHeight = Math.max(30, (clientHeight / scrollHeight) * trackHeight);

        // Calculate top position
        // Max accessible scroll top is (scrollHeight - clientHeight)
        // Max thumb top is (trackHeight - thumbHeight)
        const scrollableRange = scrollHeight - clientHeight;
        const scrollRatio = scrollableRange > 0 ? scrollTop / scrollableRange : 0;

        const maxThumbTop = trackHeight - thumbHeight;
        const thumbTop = scrollRatio * maxThumbTop;

        thumb.style.height = `${thumbHeight}px`;
        thumb.style.transform = `translateY(${thumbTop}px)`;
    };

    // Scrollbar Fade Logic
    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        const showScrollbar = () => {
            setIsScrollbarVisible(true);
            updateScrollbar();

            if (scrollbarTimeoutRef.current) clearTimeout(scrollbarTimeoutRef.current);

            // Only hide if NOT dragging
            if (!isScrollbarDragging) {
                scrollbarTimeoutRef.current = setTimeout(() => {
                    setIsScrollbarVisible(false);
                }, fadeDelay);
            }
        };

        const handleScrollEvent = (e: Event) => {
            // We also trigger onScroll prop if manual listener used (but React attach handles that separately)
            updateScrollbar();
            showScrollbar();
        };

        // Show initially
        updateScrollbar();
        showScrollbar();

        // Native event listeners for behavior
        container.addEventListener('scroll', handleScrollEvent);
        container.addEventListener('mouseenter', showScrollbar);
        container.addEventListener('mousemove', showScrollbar);

        const observer = new ResizeObserver(() => {
            updateScrollbar();
        });
        observer.observe(container);

        return () => {
            container.removeEventListener('scroll', handleScrollEvent);
            container.removeEventListener('mouseenter', showScrollbar);
            container.removeEventListener('mousemove', showScrollbar);
            observer.disconnect();
            if (scrollbarTimeoutRef.current) clearTimeout(scrollbarTimeoutRef.current);
        };
    }, [isScrollbarDragging, fadeDelay, scrollRef]);

    // Scrollbar Dragging
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isScrollbarDragging) return;
            e.preventDefault();

            const container = scrollRef.current;
            const track = scrollbarTrackRef.current;
            if (!container || !track) return;

            const deltaY = e.clientY - dragStartY.current;
            const { scrollHeight, clientHeight } = container;

            // Move ratio approximation
            const multiplier = scrollHeight / clientHeight;
            container.scrollTop = scrollStartY.current + deltaY * multiplier;
        };

        const handleMouseUp = () => {
            if (isScrollbarDragging) {
                setIsScrollbarDragging(false);
                // Restart fade out
                if (scrollbarTimeoutRef.current) clearTimeout(scrollbarTimeoutRef.current);
                scrollbarTimeoutRef.current = setTimeout(() => {
                    setIsScrollbarVisible(false);
                }, fadeDelay);
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isScrollbarDragging, fadeDelay, scrollRef]);

    const onThumbMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsScrollbarDragging(true);
        setIsScrollbarVisible(true);
        if (scrollbarTimeoutRef.current) clearTimeout(scrollbarTimeoutRef.current);

        dragStartY.current = e.clientY;
        if (scrollRef.current) {
            scrollStartY.current = scrollRef.current.scrollTop;
        }
    };

    return (
        <div className={`custom-scroll-container ${containerClassName}`} style={style}>
            <div
                className={`scrollable-content ${className}`}
                ref={scrollRef}
                onScroll={onScroll}
            >
                {children}
            </div>

            <div
                className={`custom-scrollbar-track ${isScrollbarVisible || isScrollbarDragging ? 'visible' : ''}`}
                ref={scrollbarTrackRef}
            >
                <div
                    className="custom-scrollbar-thumb"
                    ref={scrollbarThumbRef}
                    onMouseDown={onThumbMouseDown}
                />
            </div>
        </div>
    );
};
