import { FC, ReactNode } from "react";
import {
  chipContainerStyles,
  chipIconStyles,
  chipRightIconContainerStyles,
  chipTextCenteredStyles,
  chipTextStyles,
} from "./PlaybackSettingsChip.styles";

export interface IPlaybackSettingsChipProps {
  /** Style override for the outmost container. */
  className?: string;
  ["data-toggled-on"]?: boolean;
  /** Whether the chip is disabled. */
  disabled?: boolean;
  /** The icon element displayed on the left side of the chip. */
  icon?: ReactNode;
  /** Click handler for the chip. */
  onClick: () => void;
  /** Optional element displayed on the right side (e.g., chevron for submenu). */
  rightIcon?: ReactNode;
  /** The text label displayed next to the icon. */
  text: string;
}

/**
 * A clickable chip with an icon on the left and text on the right.
 * Used as a menu item within PlaybackSettings.
 *
 * @param props - The component props.
 * @param props.disabled - Whether the chip is disabled.
 * @param props.icon - The icon element displayed on the left.
 * @param props.onClick - Click handler.
 * @param props.rightIcon - Optional right-side element.
 * @param props.text - The text label.
 * @returns The playback settings chip component.
 */
export const PlaybackSettingsChip: FC<IPlaybackSettingsChipProps> = ({
  className,
  disabled,
  icon,
  onClick,
  rightIcon,
  text,
  ...htmlAttributes
}) => {
  return (
    <button
      className={className}
      css={chipContainerStyles}
      disabled={disabled}
      onClick={onClick}
      {...htmlAttributes}
    >
      {icon && <span css={chipIconStyles}>{icon}</span>}
      <span css={[chipTextStyles, !icon && chipTextCenteredStyles]}>{text}</span>
      {rightIcon && <span css={chipRightIconContainerStyles}>{rightIcon}</span>}
    </button>
  );
};
