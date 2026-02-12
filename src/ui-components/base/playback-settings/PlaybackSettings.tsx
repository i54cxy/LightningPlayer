import { FC } from "react";
import { playbackSettingsContainerStyles } from "./PlaybackSettings.styles";

/**
 * TODO: Implement PlaybackSettings with two settings: 1. Pin controls 2. Rotate.
 */

/**
 * A popup settings menu that appears above the progress bar, on top of the settings button.
 *
 * @returns The playback settings component.
 */
export const PlaybackSettings: FC = () => {
  return (
    <div css={playbackSettingsContainerStyles}>
      {/* Empty for now - placeholder for settings content. */}
    </div>
  );
};
