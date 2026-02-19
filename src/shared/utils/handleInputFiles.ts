import { SetStateAction, useSetAtom } from "jotai";

/**
 * Processes input files from file selection or drag-and-drop.
 * Filters to only include audio and video media types.
 *
 * @param params.files - The files from the input event, either a FileList or File array.
 * @param params.setInputFiles - Jotai setter for the inputFilesState atom.
 * @returns An array of media Files, or an empty array if none are valid.
 */
export const handleInputFiles = ({
  files,
  setInputFiles,
}: {
  files: File[] | FileList;
  setInputFiles: ReturnType<
    typeof useSetAtom<File[], [SetStateAction<File[]>], void>
  >;
}): File[] => {
  if (files.length <= 0) {
    console.error("handleInputFiles: empty.");
    return [];
  }
  const filteredFiles = [...files].filter(
    (file) => file.type.startsWith("audio/") || file.type.startsWith("video/"),
  );
  setInputFiles(filteredFiles);
  console.log("handleInputFiles:", filteredFiles);

  return filteredFiles;
};
