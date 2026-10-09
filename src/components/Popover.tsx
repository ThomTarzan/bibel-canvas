import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { placePopover, type PopoverPrefer } from '../lib/placePopover';

export function Popover({
  children,
  className,
  onClose,
  anchorRef,
  anchorElement,
  prefer,
  watch,
}: {
  children: ReactNode;
  className?: string;
  onClose: () => void;
  anchorRef?: RefObject<HTMLElement | null>;
  anchorElement?: HTMLElement | null;
  prefer: PopoverPrefer;
  watch?: unknown;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({
    position: 'fixed',
    top: 0,
    left: 0,
    visibility: 'hidden',
  });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const place = () => {
      const anchor = anchorElement ?? anchorRef?.current;
      if (!anchor) return;
      const anchorRect = anchor.getBoundingClientRect();
      const placement = placePopover({
        anchor: {
          left: anchorRect.left,
          top: anchorRect.top,
          width: anchorRect.width,
          height: anchorRect.height,
        },
        size: {
          width: node.offsetWidth || 248,
          height: Math.max(node.offsetHeight, node.scrollHeight) || 180,
        },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        prefer,
      });
      const next: CSSProperties = {
        position: 'fixed',
        left: placement.left,
        top: placement.top,
        maxHeight: placement.maxHeight,
        maxWidth: placement.maxWidth,
        visibility: 'visible',
      };
      setStyle((current) =>
        current.left === next.left &&
        current.top === next.top &&
        current.maxHeight === next.maxHeight &&
        current.maxWidth === next.maxWidth &&
        current.visibility === 'visible'
          ? current
          : next,
      );
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorElement, anchorRef, prefer, watch]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (ref.current?.contains(target)) return;
      const anchor = anchorElement ?? anchorRef?.current;
      if (anchor?.contains(target)) return;
      onClose();
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [anchorElement, anchorRef, onClose]);

  return createPortal(
    <div
      ref={ref}
      className={className ? `popover ${className}` : 'popover'}
      data-popover="true"
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
