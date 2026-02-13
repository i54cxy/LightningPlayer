import { InputAudioTrack } from "mediabunny";
import { FC } from "react";
import { audioTrackSelectorContainerStyles } from "./AudioTrackSelector.styles";
import { AudioTrackSelectorItem } from "./AudioTrackSelectorItem";

export interface IAudioTrackSelectorProps {
  /** The list of available audio tracks. */
  audioTracks: InputAudioTrack[];
  /** Style override for the outmost container. */
  className?: string;
  /** Callback when a track is selected. */
  onSelectTrack: (index: number) => void;
  /** The index of the currently selected audio track. */
  selectedTrackIndex: number;
}

/**
 * A popup menu that lists all available audio tracks for selection.
 * Displays each track as a selectable item with the selected track highlighted.
 *
 * @param props - The component props.
 * @param props.audioTracks - The list of available audio tracks.
 * @param props.onSelectTrack - Callback when a track is selected.
 * @param props.selectedTrackIndex - The currently selected track index.
 * @returns The audio track selector component.
 */
export const AudioTrackSelector: FC<IAudioTrackSelectorProps> = ({
  audioTracks,
  className,
  onSelectTrack,
  selectedTrackIndex,
}) => {
  return (
    <div className={className} css={audioTrackSelectorContainerStyles}>
      {audioTracks.map((track, index) => {
        /** Handles selecting this audio track. */
        const handleClick = () => onSelectTrack(index);

        return (
          <AudioTrackSelectorItem
            isSelected={index === selectedTrackIndex}
            key={track.id}
            onClick={handleClick}
            text={track.name ?? `Track ${index + 1}`}
          />
        );
      })}
    </div>
  );
};
