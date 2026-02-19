import { useSetAtom } from "jotai";
import { DragEventHandler, FC, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ROUTES } from "../../../route-components/routes";
import { inputFilesState } from "../../../shared/atoms/inputFilesState";
import { getFilesFromDataTransferItems } from "../../../shared/utils/getFilesFromDataTransferItems";
import { handleInputFiles } from "../../../shared/utils/handleInputFiles";
import { dragAndDropOverlayContainerStyles } from "./DragAndDropOverlay.styles";
import { DragAndDropState } from "./DragAndDropOverlay.types";

export const DragAndDropOverlay: FC = () => {
  const [dragAndDropState, setDragAndDropState] = useState<DragAndDropState>(
    DragAndDropState.None,
  );
  const location = useLocation();
  const navigate = useNavigate();
  const setInputFiles = useSetAtom(inputFilesState);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Listen at document level to detect drag start/end and prevent browser default file opening
  useEffect(() => {
    const handleDocumentDragEnter = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) {
        event.preventDefault();
        setDragAndDropState(DragAndDropState.Dragging);
      }
    };

    const handleDocumentDragOver = (event: DragEvent) => {
      // Must preventDefault on dragover to allow drop and prevent browser opening the file
      if (event.dataTransfer?.types.includes("Files")) {
        event.preventDefault();
      }
    };

    const handleDocumentDragLeave = (event: DragEvent) => {
      // relatedTarget is null when drag leaves the window entirely
      if (event.relatedTarget === null) {
        setDragAndDropState(DragAndDropState.None);
      }
    };

    const handleDocumentDrop = (event: DragEvent) => {
      // Prevent browser from opening the file if drop happens outside overlay
      event.preventDefault();
    };

    document.addEventListener("dragenter", handleDocumentDragEnter);
    document.addEventListener("dragover", handleDocumentDragOver);
    document.addEventListener("dragleave", handleDocumentDragLeave);
    document.addEventListener("drop", handleDocumentDrop);
    return () => {
      document.removeEventListener("dragenter", handleDocumentDragEnter);
      document.removeEventListener("dragover", handleDocumentDragOver);
      document.removeEventListener("dragleave", handleDocumentDragLeave);
      document.removeEventListener("drop", handleDocumentDrop);
    };
  }, []);

  const handleDragOver: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
  };
  const handleDrop: DragEventHandler<HTMLDivElement> = async (event) => {
    event.preventDefault();
    setDragAndDropState(DragAndDropState.None);
    const files = await getFilesFromDataTransferItems(event.dataTransfer.items);
    console.log("Dropped files:", files);
    if (files.length) {
      const filteredFiles = handleInputFiles({ files, setInputFiles });
      if (filteredFiles.length) {
        // Replace instead of push when already on the player route
        // so there's only one player entry in history.
        const isOnPlayer = location.pathname === ROUTES.player;
        navigate(ROUTES.player, { replace: isOnPlayer });
      }
    }
  };

  return (
    <div
      css={dragAndDropOverlayContainerStyles}
      data-drag-and-drop-active={dragAndDropState !== DragAndDropState.None}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      ref={dropZoneRef}
    >
      {(() => {
        switch (dragAndDropState) {
          case DragAndDropState.Dragging: {
            return <p>Drop to open</p>;
          }
          default:
            // Unexpected state
            return null;
        }
      })()}
    </div>
  );
};
