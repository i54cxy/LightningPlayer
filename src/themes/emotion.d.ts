import "@emotion/react";

declare module "@emotion/react" {
  export interface Theme {
    colors: {
      button: {
        text: {
          background: string;
          color: string;
          hoverBackground: string;
        };
      };
      playerControls: {
        button: {
          background: string;
          borderRadius: string;
          color: string;
          foreground: string;
        };
        playbackSettings: {
          background: string;
        };
        previewThumbnail: {
          background: string;
          border: string;
          timestampBackground: string;
          timestampColor: string;
        };
        progressBar: {
          background: string;
          hoverFill: string;
          thumb: string;
          thumbnailProgress: string;
        };
        timestamp: {
          background: string;
        };
        tooltip: {
          background: string;
          color: string;
        };
        volumeControl: {
          fill: string;
          thumb: string;
          track: string;
        };
      };
      playbackMessage: {
        color: string;
      };
      root: {
        background: string;
      };
      scrollbar: {
        thumb: string;
        track: string;
      };
      text: {
        default: string;
        link: string;
        selected: string;
      };
      titleBar: {
        activeBackground: string;
        activeForeground: string;
        hoverBackground: string;
        hoverCloseBackground: string;
        hoverCloseForeground: string;
        pressedBackground: string;
        pressedCloseBackground: string;
        inactiveBackground: string;
        inactiveForeground: string;
      };
      tooltip: {
        background: string;
        color: string;
      };
      window: {
        background: string;
      };
    };
    motion: {
      playerControls: {
        button: {
          foregroundScale: number;
          transitionDuration: string;
          transitionTimingFunction: string;
        };
        overlay: {
          transitionDuration: string;
          transitionTimingFunction: string;
        };
        progressBar: {
          transitionDuration: string;
          transitionTimingFunction: string;
        };
      };
    };
  }
}
