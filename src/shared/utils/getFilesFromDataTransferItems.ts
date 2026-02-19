/**
 * Reads all entries from a FileSystemDirectoryReader.
 * Calls readEntries repeatedly until an empty array is returned,
 * because readEntries may not return all entries in a single call.
 *
 * @param reader - The directory reader to read entries from.
 * @returns All entries in the directory.
 */
const readAllEntries = async (
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> => {
  const allEntries: FileSystemEntry[] = [];
  let entries = await new Promise<FileSystemEntry[]>((resolve, reject) =>
    reader.readEntries(resolve, reject),
  );
  while (entries.length > 0) {
    allEntries.push(...entries);
    entries = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
  }
  return allEntries;
};

/**
 * Recursively extracts a File from a FileSystemEntry.
 * If the entry is a file, returns it in an array.
 * If the entry is a directory, recursively reads all contained files.
 *
 * @param entry - The file system entry to extract files from.
 * @returns All files contained within the entry.
 */
const getFilesFromEntry = async (entry: FileSystemEntry): Promise<File[]> => {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    return [file];
  }

  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const entries = await readAllEntries(reader);
    const nestedFiles = await Promise.all(entries.map(getFilesFromEntry));
    return nestedFiles.flat();
  }

  return [];
};

/**
 * Recursively extracts all files from a DataTransferItemList,
 * including files nested within dropped folders.
 * Preserves the order of items as they appear in the transfer.
 *
 * @param items - The DataTransferItemList from a drop event.
 * @returns All files, including those nested in directories.
 */
export const getFilesFromDataTransferItems = async (
  items: DataTransferItemList,
): Promise<File[]> => {
  const entries: FileSystemEntry[] = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry();
    if (entry) {
      entries.push(entry);
    }
  }
  const nestedFiles = await Promise.all(entries.map(getFilesFromEntry));
  return nestedFiles.flat();
};
