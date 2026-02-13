import { SerializedStyles, Theme } from "@emotion/react";
import { FC, ReactNode, Ref, RefObject, useRef, useState } from "react";
import { passMultipleRefs } from "../../../shared/utils/passMultipleRefs";
import {
  tooltipContainerStyles,
  tooltipDefaultMarginTop,
  tooltipStyles,
} from "./Tooltip.styles";

export interface ITooltipProps {
  /**
   * Optional ref to a bounding container. If provided, the tooltip will be
   * clamped to stay within this container's horizontal bounds.
   */
  boundsRef?: RefObject<HTMLElement | null>;
  /** Trigger element. */
  children: ReactNode;
  /** Style override for the outmost container. */
  className?: string;
  ref?: Ref<HTMLElement>;
  /** Optional flag to show the tooltip in addition to hover state. */
  showTooltip?: boolean;
  /** Tooltip text. */
  text: string;
  /** Style override for tooltip content. */
  tooltipStylesOverride?:
    | SerializedStyles
    | ((theme: Theme) => SerializedStyles);
}

/**
 * A tooltip component that displays text content on hover.
 * Automatically clamps horizontal position to stay within bounds.
 *
 * @param props - The component props.
 * @param props.boundsRef - Optional ref to constrain tooltip within.
 * @param props.children - The trigger element.
 * @param props.className - Optional style override for the tooltip content.
 * @param props.content - The tooltip text to display.
 * @returns The tooltip component wrapping the children.
 */
export const Tooltip: FC<ITooltipProps> = ({
  boundsRef,
  children,
  className,
  ref,
  showTooltip,
  text,
  tooltipStylesOverride,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState<"bottom" | "top">("bottom");
  // Horizontal offset from centered position (in pixels).
  const [horizontalOffset, setHorizontalOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);

    const container = containerRef.current;
    const tooltip = tooltipRef.current;
    if (!container || !tooltip) return;

    const containerRect = container.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;

    // Calculate horizontal clamping if boundsRef is provided.
    if (boundsRef?.current) {
      const boundsRect = boundsRef.current.getBoundingClientRect();

      // Where the tooltip center would be (centered on container).
      const tooltipCenterX = containerRect.left + containerRect.width / 2;
      const tooltipLeft = tooltipCenterX - tooltipWidth / 2;
      const tooltipRight = tooltipCenterX + tooltipWidth / 2;

      // Calculate offset needed to stay within bounds.
      let offset = 0;
      if (tooltipLeft < boundsRect.left) {
        // Tooltip extends past left edge.
        offset = boundsRect.left - tooltipLeft;
      } else if (tooltipRight > boundsRect.right) {
        // Tooltip extends past right edge.
        offset = boundsRect.right - tooltipRight;
      }
      setHorizontalOffset(offset);
    } else {
      setHorizontalOffset(0);
    }

    // Check if tooltip would be clipped by window and flip to top.
    // Only enabled for automatic positioning; ignore when style override exists.
    if (!tooltipStylesOverride) {
      const tooltipHeight = tooltip.offsetHeight;
      const spaceBelow = window.innerHeight - containerRect.bottom;
      setPosition(
        spaceBelow < tooltipHeight + tooltipDefaultMarginTop ? "top" : "bottom",
      );
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Calculate transform with horizontal offset.
  const transform =
    horizontalOffset !== 0
      ? `translateX(calc(-50% + ${horizontalOffset}px))`
      : "translateX(-50%)";

  return (
    <div
      className={className}
      css={tooltipContainerStyles}
      data-is-hovered={isHovered}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      ref={passMultipleRefs([containerRef, ref])}
    >
      {children}
      <div
        css={[tooltipStyles, tooltipStylesOverride]}
        data-tooltip-position={tooltipStylesOverride ? undefined : position}
        data-show-tooltip={showTooltip}
        ref={tooltipRef}
        style={{ transform }}
      >
        {text}
      </div>
    </div>
  );
};
