import { FC, RefObject, useEffect, useRef, useState } from "react";
import Speaker0Icon from "../../../assets/svgs/speaker-0.svg?react";
import Speaker1Icon from "../../../assets/svgs/speaker-1.svg?react";
import Speaker2Icon from "../../../assets/svgs/speaker-2.svg?react";
import SpeakerMuteIcon from "../../../assets/svgs/speaker-mute.svg?react";
import { Tooltip } from "../../base/tooltip/Tooltip";
import { getVolumeFromEvent } from "./getVolumeFromEvent";
import {
  containerStyles,
  fillStyles,
  iconButtonStyles,
  sliderContainerStyles,
  sliderWidth,
  thumbSize,
  thumbStyles,
  tooltipContainerStyles,
  tooltipStyles,
  trackStyles,
} from "./VolumeControl.styles";

export interface IVolumeControlProps {
  isMuted: boolean;
  /**
   * The VolumeControl is pinned when the user makes an update to the volume.
   * It stays pinned until the user interacts with another player control element.
   */
  isPinned: boolean;
  onMouseEnter: () => void;
  onMuteToggle: () => void;
  /**
   * Called when the user interacts with the volume slider (e.g., mousedown).
   * Used by the parent to track the last interacted player control element.
   */
  onInteraction: () => void;
  /**
   * @param volume goes from 0 to 1.
   */
  onVolumeChange: (volume: number) => void;
  toolTipBoundsRef: RefObject<HTMLElement | null>;
  volume: number;
}

export const VolumeControl: FC<IVolumeControlProps> = ({
  isMuted,
  isPinned,
  onInteraction,
  onMouseEnter,
  onMuteToggle,
  onVolumeChange,
  toolTipBoundsRef,
  volume,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const isExpanded = isHovered || isPinned;
  const thumbPosition = (isMuted ? 0 : volume) * (sliderWidth - thumbSize);

  const handleMouseEnter = () => {
    setIsHovered(true);
    onMouseEnter();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  useEffect(() => {
    const handleSliderMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      // Prevents text selection.
      event.preventDefault();
      onInteraction();
      const newVolume = getVolumeFromEvent({ event, sliderRef });
      if (newVolume !== undefined) {
        console.log("VolumeControl: setting volume:", newVolume);
        onVolumeChange(newVolume);
      }

      // Drag handlers.
      const handleMouseMove = (e: MouseEvent) => {
        const newVolume = getVolumeFromEvent({ event: e, sliderRef });
        if (newVolume !== undefined) {
          console.log("VolumeControl: setting volume:", newVolume);
          onVolumeChange(newVolume);
        }
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    if (sliderRef.current) {
      sliderRef.current.addEventListener("mousedown", handleSliderMouseDown);
    }
  }, [onVolumeChange, onInteraction]);

  /**
   * Renders the appropriate speaker icon based on mute state and volume level.
   */
  const renderVolumeIcon = () => {
    if (isMuted) return <SpeakerMuteIcon />;
    if (volume === 0) return <Speaker0Icon />;
    if (volume <= 0.5) return <Speaker1Icon />;
    return <Speaker2Icon />;
  };

  const speakerAriaLabel = isMuted ? "Unmute" : "Mute";
  const sliderAriaLabel = `Volume: ${Math.round(volume * 100)}`;
  return (
    <div
      css={containerStyles}
      data-is-volume-control-expanded={isExpanded}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Tooltip
        boundsRef={toolTipBoundsRef}
        css={tooltipContainerStyles}
        // showTooltip={true}
        text={speakerAriaLabel}
        tooltipStylesOverride={tooltipStyles}
      >
        <button
          aria-label={speakerAriaLabel}
          css={iconButtonStyles}
          onClick={onMuteToggle}
          type="button"
        >
          {renderVolumeIcon()}
        </button>
      </Tooltip>
      <Tooltip
        boundsRef={toolTipBoundsRef}
        css={tooltipContainerStyles}
        ref={sliderRef}
        text={sliderAriaLabel}
        tooltipStylesOverride={tooltipStyles}
      >
        <div css={sliderContainerStyles}>
          <div css={trackStyles} />
          <div css={fillStyles} style={{ width: thumbPosition }} />
          <div css={thumbStyles} style={{ left: thumbPosition }} />
        </div>
      </Tooltip>
    </div>
  );
};
