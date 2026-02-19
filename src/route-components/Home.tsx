import { useSetAtom } from "jotai";
import { FC, useRef } from "react";
import { useNavigate } from "react-router";
import { inputFilesState } from "../shared/atoms/inputFilesState";
import { handleInputFiles } from "../shared/utils/handleInputFiles";
import { Button } from "../ui-components/base/button/Button";
import { FullscreenContainer } from "../ui-components/base/fullscreen-container/FullscreenContainer";
import {
  buttonStyles,
  contentContainerStyles,
  dragAndDropTextStyles,
  hiddenInputStyles,
  orTextStyles,
} from "./Home.styles";
import { ROUTES } from "./routes";

export const Home: FC = () => {
  const openFileInputRef = useRef<HTMLInputElement>(null);
  const openFolderInputRef = useRef<HTMLInputElement>(null);
  const setInputFiles = useSetAtom(inputFilesState);
  const navigate = useNavigate();

  const handleOnClickOpenFile = async () => {
    openFileInputRef.current?.click();
  };
  const handleOnChangeFileInput: React.ChangeEventHandler<HTMLInputElement> = (
    event,
  ) => {
    const files = event.target.files;
    if (files && files.length) {
      console.log("Selected files:", files);
      const filteredFiles = handleInputFiles({ files, setInputFiles });
      if (filteredFiles.length) {
        navigate(ROUTES.player);
      }
    }
  };

  const handleOnChangeFolderInput: React.ChangeEventHandler<
    HTMLInputElement
  > = (event) => {
    const files = event.target.files;
    if (files && files.length) {
      console.log("Selected folder files:", files);
      const filteredFiles = handleInputFiles({ files, setInputFiles });
      if (filteredFiles.length) {
        navigate(ROUTES.player);
      }
    }
  };

  const handleOnClickOpenFolder = () => {
    openFolderInputRef.current?.click();
  };

  return (
    <FullscreenContainer>
      <div css={contentContainerStyles}>
        <Button css={buttonStyles} onClick={handleOnClickOpenFile}>
          Open File(s)
        </Button>
        <input
          accept="audio/*,video/*"
          css={hiddenInputStyles}
          onChange={handleOnChangeFileInput}
          multiple
          ref={openFileInputRef}
          type="file"
        />
        <Button css={buttonStyles} onClick={handleOnClickOpenFolder}>
          Open Folder
        </Button>
        <input
          accept="audio/*,video/*"
          css={hiddenInputStyles}
          onChange={handleOnChangeFolderInput}
          ref={openFolderInputRef}
          type="file"
          {...{ webkitdirectory: "" }}
        />
        <p css={orTextStyles}>or</p>
        <p css={dragAndDropTextStyles}>Drag and drop here</p>
      </div>
    </FullscreenContainer>
  );
};
