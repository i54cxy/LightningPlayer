/**
 * @param params.event - Mouse event containing clientX position.
 * @param params.sliderRef - Ref to the slider element.
 * @returns Volume (0-1) from mouse position relative to slider, or
 * undefined if the slider ref is not available or has zero width.
 */
export const getVolumeFromEvent = ({
  event,
  sliderRef,
}: {
  event: MouseEvent | React.MouseEvent;
  sliderRef: React.RefObject<HTMLDivElement | null>;
}): number | undefined => {
  if (!sliderRef.current) return;
  const rect = sliderRef.current.getBoundingClientRect();
  if (rect.width === 0) return;
  return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
};
