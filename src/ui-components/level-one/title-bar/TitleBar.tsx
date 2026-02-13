import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAtom, useAtomValue } from "jotai";
import { FC, MouseEventHandler, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import ArrowLeftIcon from "../../../assets/svgs/arrow-left.svg?react";
import CloseIcon from "../../../assets/svgs/close.svg?react";
import MaximizeIcon from "../../../assets/svgs/maximize.svg?react";
import MinimizeIcon from "../../../assets/svgs/minimize.svg?react";
import PinIcon from "../../../assets/svgs/pin.svg?react";
import RestoreIcon from "../../../assets/svgs/restore-window.svg?react";
import UnpinIcon from "../../../assets/svgs/unpin.svg?react";
import { ROUTES } from "../../../route-components/routes";
import { isWindowFocusedState } from "../../../shared/atoms/isWindowFocusedState";
import { isWindowMaximizedState } from "../../../shared/atoms/isWindowMaximizedState";
import { titleBarPinnedState } from "../../../shared/atoms/titleBarPinnedState";
import { titleBarTextState } from "../../../shared/atoms/titleBarTextState";
import {
  dragRegionStyles,
  navigationControlsContainerStyles,
  pinnedContainerStyles,
  titleBarContainerStyles,
  windowControlsContainerStyles,
} from "./TitleBar.styles";

enum HoverState {
  Hovered,
  HoveredClicked,
  None,
}

export const TitleBar: FC = () => {
  const appWindow = getCurrentWindow();
  const location = useLocation();
  const navigate = useNavigate();
  const canGoBack = location.pathname !== ROUTES.root;
  const titleBarText = useAtomValue(titleBarTextState);
  // Dragging uses OS native apis and :hover doesn't work while dragging. In
  // addition, after a mouseDown from left button, the OS takes control of dragging,
  // and mouseUp events are not fired for the webview. So we need to track the hover
  // state manually using only mouseDown, mouseEnter, and mouseLeave.
  //
  // When the user clicks the title bar, the mouseDown event is fired, and then
  // the mouseLeave event is fired shortly after.
  // When the user releases the mouse button, the mouseEnter event is fired.
  //
  // To make sure that the hover styles persist while dragging, we use this little
  // state machine and make use of the order of the events mentioned above.
  const [isHovered, setIsHovered] = useState<HoverState>(HoverState.None);
  const isFocused = useAtomValue(isWindowFocusedState);
  const isMaximized = useAtomValue(isWindowMaximizedState);
  const [isPinned, setIsPinned] = useAtom(titleBarPinnedState);
  const maximizeButtonRef = useRef<HTMLButtonElement>(null);
  const dragRegionRef = useRef<HTMLDivElement>(null);

  // Event handlers to track the hovered state.
  const handleOnMouseDownTitleBar = () => {
    if (!isPinned) {
      // console.log("mouse down");
      setIsHovered(HoverState.HoveredClicked);
    }
  };
  const handleOnMouseEnterTitleBar = () => {
    if (!isPinned) {
      // console.log("mouse enter");
      setIsHovered(HoverState.Hovered);
    }
  };
  const handleOnMouseLeaveTitleBar = () => {
    if (!isPinned) {
      if (isHovered === HoverState.HoveredClicked) {
        // console.log("mouse leave - from clicked ");
        setIsHovered(HoverState.Hovered);
      } else {
        // console.log("mouse leave");
        setIsHovered(HoverState.None);
      }
    }
  };
  const handleOnMouseDownButton = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    // Prevent propagating mouseDown to title bar and therefore
    // updating the hover state.
    event.stopPropagation();
  };

  // Navigation button event handler.
  const handleOnBackClick = () => {
    navigate("..");
  };

  // Button event handlers.
  const handleOnPinClick = () => {
    setIsPinned(!isPinned);
  };
  const handleOnMinimizeClick = () => {
    appWindow.minimize();
  };
  const handleOnMaximizeClick = () => {
    appWindow.toggleMaximize();
  };
  const handleOnCloseClick = () => {
    appWindow.close();
  };

  // Drag handler.
  const handleOnDragRegionMouseDOwn: MouseEventHandler<HTMLDivElement> = (
    event,
  ) => {
    // Primary (left) button
    if (event.buttons === 1) {
      if (event.detail === 2) {
        // Maximize on double click
        appWindow.toggleMaximize();
      } else {
        // Else start dragging
        appWindow.startDragging();
      }
    }
  };

  return (
    <div
      css={[titleBarContainerStyles, isPinned && pinnedContainerStyles]}
      data-is-hovered={isHovered !== HoverState.None}
      data-is-focused={isFocused}
      onMouseDown={handleOnMouseDownTitleBar}
      onMouseEnter={handleOnMouseEnterTitleBar}
      onMouseLeave={handleOnMouseLeaveTitleBar}
    >
      <div css={navigationControlsContainerStyles}>
        {canGoBack && (
          <button
            id="titlebar-back"
            onClick={handleOnBackClick}
            onMouseDown={handleOnMouseDownButton}
            title="back"
          >
            <ArrowLeftIcon />
          </button>
        )}
      </div>
      <div
        css={dragRegionStyles}
        onMouseDown={handleOnDragRegionMouseDOwn}
        ref={dragRegionRef}
      >
        {titleBarText && <span>{titleBarText}</span>}
      </div>
      <div css={windowControlsContainerStyles}>
        <button
          id="titlebar-pin"
          onClick={handleOnPinClick}
          onMouseDown={handleOnMouseDownButton}
          title={isPinned ? "unpin" : "pin"}
        >
          {isPinned ? <UnpinIcon /> : <PinIcon />}
        </button>
        <button
          id="titlebar-minimize"
          onClick={handleOnMinimizeClick}
          onMouseDown={handleOnMouseDownButton}
          title="minimize"
        >
          <MinimizeIcon />
        </button>
        <button
          id="titlebar-maximize"
          onClick={handleOnMaximizeClick}
          onMouseDown={handleOnMouseDownButton}
          ref={maximizeButtonRef}
          title={isMaximized ? "restore" : "maximize"}
        >
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>
        <button
          id="titlebar-close"
          data-close-button
          onClick={handleOnCloseClick}
          onMouseDown={handleOnMouseDownButton}
          title="close"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
};
