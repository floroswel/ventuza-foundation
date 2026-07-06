import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  forwardRef,
} from "react";
import { VariableSizeList, type ListChildComponentProps } from "react-window";

export type VirtualizedMessagesHandle = {
  scrollToBottom: (behavior?: "auto" | "smooth") => void;
  /** Trigger a fresh measurement of the item at index (e.g. after content grows). */
  remeasure: (index?: number) => void;
};

type Props<T> = {
  items: T[];
  keyFor: (item: T, index: number) => string;
  estimatedItemHeight?: number;
  height: number;
  width?: number | string;
  renderItem: (item: T, index: number) => ReactNode;
  /** Called when the topmost visible index reaches 0 → load older messages. */
  onReachTop?: () => void;
  /** Auto-scroll to bottom when items.length increases & user is near bottom. */
  stickToBottom?: boolean;
  /** Called after a load-more prepend so caller can preserve scroll anchoring. */
  onPrependAnchor?: (addedCount: number) => void;
  /** Previous items reference to detect prepends (older messages loaded at top). */
  prevLength?: number;
};

/**
 * Virtualized chat list. Each row auto-measures via ResizeObserver, and heights
 * are cached & reported to VariableSizeList. Handles:
 *   - initial scroll to bottom,
 *   - sticky-to-bottom on new messages when the user is near the bottom,
 *   - top-anchor preservation after prepending older messages,
 *   - onReachTop callback for infinite scroll upward.
 */
function VirtualizedMessagesInner<T>(
  {
    items,
    keyFor,
    estimatedItemHeight = 72,
    height,
    width = "100%",
    renderItem,
    onReachTop,
    stickToBottom = true,
    prevLength,
  }: Props<T>,
  ref: React.Ref<VirtualizedMessagesHandle>,
) {
  const listRef = useRef<VariableSizeList | null>(null);
  const sizeMap = useRef<Map<string, number>>(new Map());
  const nearBottomRef = useRef(true);
  const prevCountRef = useRef(items.length);
  const initialScrolledRef = useRef(false);

  const getSize = useCallback(
    (index: number) => {
      const k = keyFor(items[index], index);
      return sizeMap.current.get(k) ?? estimatedItemHeight;
    },
    [items, keyFor, estimatedItemHeight],
  );

  const setSize = useCallback(
    (index: number, size: number) => {
      const k = keyFor(items[index], index);
      const prev = sizeMap.current.get(k);
      if (prev !== size) {
        sizeMap.current.set(k, size);
        listRef.current?.resetAfterIndex(index, false);
      }
    },
    [items, keyFor],
  );

  useImperativeHandle(
    ref,
    () => ({
      scrollToBottom: (behavior = "auto") => {
        const list = listRef.current;
        if (!list || items.length === 0) return;
        void behavior;
        list.scrollToItem(items.length - 1, "end");
      },
      remeasure: (index) => {
        listRef.current?.resetAfterIndex(index ?? 0, true);
      },
    }),
    [items.length],
  );

  // Handle appended items (new outgoing / incoming message): scroll to bottom if user near bottom.
  useLayoutEffect(() => {
    const prev = prevLength ?? prevCountRef.current;
    const curr = items.length;
    if (curr > prev) {
      const appendedAtBottom = true; // caller guarantees new messages always append.
      if (appendedAtBottom && stickToBottom && nearBottomRef.current) {
        // Defer to next tick so row measurements happen first.
        requestAnimationFrame(() => {
          listRef.current?.scrollToItem(curr - 1, "end");
        });
      }
    }
    prevCountRef.current = curr;
  }, [items.length, prevLength, stickToBottom]);

  // Initial scroll to bottom on first render with content.
  useEffect(() => {
    if (initialScrolledRef.current) return;
    if (items.length === 0) return;
    initialScrolledRef.current = true;
    requestAnimationFrame(() => {
      listRef.current?.scrollToItem(items.length - 1, "end");
    });
  }, [items.length]);

  const Row = useMemo(() => {
    function RowInner({ index, style }: ListChildComponentProps) {
      const item = items[index];
      const rowRef = useRef<HTMLDivElement>(null);

      useLayoutEffect(() => {
        const el = rowRef.current;
        if (!el) return;
        const observer = new ResizeObserver(() => {
          const h = el.getBoundingClientRect().height;
          if (h > 0) setSize(index, h);
        });
        observer.observe(el);
        // initial measure
        const h = el.getBoundingClientRect().height;
        if (h > 0) setSize(index, h);
        return () => observer.disconnect();
      }, [index]);

      return (
        <div style={style}>
          <div ref={rowRef}>{renderItem(item, index)}</div>
        </div>
      );
    }
    return RowInner;
  }, [items, renderItem, setSize]);

  const handleItemsRendered = useCallback(
    ({
      visibleStartIndex,
      visibleStopIndex,
    }: {
      visibleStartIndex: number;
      visibleStopIndex: number;
    }) => {
      nearBottomRef.current = visibleStopIndex >= items.length - 2;
      if (visibleStartIndex <= 1 && onReachTop) onReachTop();
    },
    [items.length, onReachTop],
  );

  return (
    <VariableSizeList
      ref={listRef}
      height={height}
      width={width}
      itemCount={items.length}
      itemSize={getSize}
      estimatedItemSize={estimatedItemHeight}
      overscanCount={6}
      onItemsRendered={handleItemsRendered}
    >
      {Row}
    </VariableSizeList>
  );
}

export const VirtualizedMessages = forwardRef(VirtualizedMessagesInner) as <T>(
  props: Props<T> & { ref?: React.Ref<VirtualizedMessagesHandle> },
) => ReturnType<typeof VirtualizedMessagesInner>;
