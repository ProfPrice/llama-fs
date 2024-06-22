import { Select, SelectItem, SelectSection, Input, Button, cn} from "@nextui-org/react";
import { useState, useEffect } from "react";
import FolderIcon from "./Icons/FolderIcon";
import SettingsIcon from "./Icons/SettingsIcon";
import CheckIcon from "./Icons/CheckIcon";
import ollamaWave from "../../../assets/ollama_wave.gif";
import { useTheme } from "./ThemeContext";
import { useSettings } from "./SettingsContext";
import ThemeBasedLogo from "./ThemeBasedLogo";
import { FileData, AcceptedState, preorderTraversal, buildTree } from "./Utils";
import CustomCheckbox from './CustomCheckbox';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        sendMessage(channel: string, ...args: unknown[]): void;
        on(channel: string, func: (...args: unknown[]) => void): (() => void);
        once(channel: string, func: (...args: unknown[]) => void): void;
        invoke(channel: string, ...args: unknown[]): Promise<unknown>;
      };
    };
  }
}

function MainScreen() {
  // Persistent settings across sessions.
  const { theme, setTheme } = useTheme();
  const {
    model, setModel,
    fileFormats,
    fileFormatIndex, setFileFormatIndex,
    addFileFormat,
    removeFileFormat,
    groqAPIKey, setGroqAPIKey,
    instruction, setInstruction,
    maxTreeDepth, setMaxTreeDepth,
    processAction, setProcessAction,
    filePath, setFilePath, // TODO: Implement overwriting the filePath variable from Windows/Finder context menu.
    filePathValid, setFilePathValid
  } = useSettings();

  // Per-session variables.
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const handleFileSelect = (fileData: FileData) => {
    setSelectedFile(fileData);
  };

  // Variables for holding the results of LLM computation.
  const [oldNewMap, setOldNewMap] = useState([]);
  const [preOrderedFiles, setPreOrderedFiles] = useState<FileData[]>([]);
  const [acceptedState, setAcceptedState] = useState<AcceptedState>({});

  const handleBatch = async () => {
    setLoading(true);

    const response = await fetch("http://localhost:8000/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: filePath,
        model: model,
        instruction: instruction,
        max_tree_depth: maxTreeDepth,
        file_format: fileFormats[fileFormatIndex],
        groq_api_key: groqAPIKey
      }),
    });

    /* 
    Example output from endpoint:
    # data = [
    #    {
    #         "file_path": "0.jpg",
    #         "new_path": "monochrome/images/2D World Building.jpg",
    #         "summary": "\n A black and white image of a building with the text \"2D World Building\" in white letters."
    #    },
    # ] 
    */
    const data = await response.json();
    setOldNewMap(data);

    const treeData = buildTree(data);
    const preOrderedTreeData = preorderTraversal(treeData, "", -1).slice(1);

    setPreOrderedFiles(preOrderedTreeData);
    setAcceptedState(
      preOrderedTreeData.reduce(
        (acc, file) => ({ ...acc, [file.fullfilename]: false }),
        {}
      )
    );

    setLoading(false);
  };

  const handleConfirmSelectedChanges = async () => {
    const returnedObj: { base_path: string; src_path: any; dst_path: any }[] = [];
    preOrderedFiles.forEach((file) => {
      const isAccepted = acceptedState[file.fullfilename];
      if (isAccepted) {
        const noRootFileName = file.fullfilename.replace("/root/", "");
        if (oldNewMap.some((change) => change.dst_path === noRootFileName)) {
          const acceptedChangeMap = oldNewMap.find(
            (change) => change.dst_path === noRootFileName
          );
          returnedObj.push({
            base_path: filePath,
            src_path: acceptedChangeMap.src_path,
            dst_path: acceptedChangeMap.dst_path,
          });
        }
      }
    });
    console.log(returnedObj);
    returnedObj.forEach(async (change) => {
      const response = await fetch("http://localhost:8000/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(change),
      });
      console.log(response);
    });
    setOldNewMap([]);
    setPreOrderedFiles([]);
    setAcceptedState([]);
  };

  const openSettings = () => {};

  // Adjust max tree depth safely within bounds
  const adjustMaxTreeDepth = (delta) => {
    const newDepth = Math.min(10, Math.max(0, maxTreeDepth + delta));
    setMaxTreeDepth(newDepth);
  };

  // Handle action toggle between Move (0) and Duplicate (1)
  const handleActionChange = (action) => {
    if (processAction !== action) {
      setProcessAction(action);
    }
  };

  const [folderContents, setFolderContents] = useState<any[]>([]);
  const [maxNameWidth, setMaxNameWidth] = useState<number>(200);
  const [maxSizeWidth, setMaxSizeWidth] = useState<number>(200);
  const [maxModifiedWidth, setMaxModifiedWidth] = useState<number>(100);

  const handleBrowseFolder = async () => {
    const result = await window.electron.ipcRenderer.invoke('open-folder-dialog');
    if (result) {
      setFilePath(result as string);
      await validateAndFetchFolderContents(result as string, 0);
    }
  };

  const validateAndFetchFolderContents = async (path: string, depth: number) => {
    try {
      const contents = await window.electron.ipcRenderer.invoke('read-folder-contents', path);
      console.log('contents:',contents)
      const fileDetails = contents.map((file: any) => ({
        name: file.name,
        isDirectory: file.isDirectory,
        size: file.size,
        modified: file.modified,
        folderContents: [],
        folderContentsDisplayed: false,
        depth: depth
      }));
      setFolderContents(prev => updateFolderContents(prev, path, fileDetails));
      setFilePathValid(true)
    } catch (error) {
      console.error("Error reading directory:", error);
    }
  };

  const updateFolderContents = (contents: any[], basePath: string, newContents: any[]) => {
    const updateRecursive = (items: any[], currentPath: string): any[] => {
      return items.map(item => {
        const fullPath = `${currentPath}/${item.name}`;
        if (fullPath === basePath) {
          return { ...item, folderContents: newContents, folderContentsDisplayed: !item.folderContentsDisplayed };
        } else if (item.isDirectory) {
          return { ...item, folderContents: updateRecursive(item.folderContents, fullPath) };
        }
        return item;
      });
    };

    return updateRecursive(contents, filePath);
  };

  const renderFileItem = (item: any) => {
    const indentStyle = { paddingLeft: `${item.depth * 20}px` };
    return (
      <div key={item.name + item.depth} className="flex items-center" style={indentStyle} onClick={() => {
        if (item.isDirectory) {
          validateAndFetchFolderContents(`${filePath}/${item.name}`, item.depth + 1);
        }
      }}>
        <span className="mr-2">{item.isDirectory ? <FolderIcon /> : <FileIcon />}</span>
        <span className="flex-1">{item.name}</span>
        <span className="mr-2">{item.size}</span>
        <span>{item.modified}</span>
      </div>
    );
  };

  useEffect(() => {

    // Check sizing.
    let maxName = 200;
    let maxSize = 200;
    let maxModified = 100;
    folderContents.forEach(item => {
      const nameWidth = item.name.length * 8;
      const sizeWidth = item.size.toString().length * 8;
      const modifiedWidth = item.modified.length * 8;
      if (nameWidth > maxName) maxName = nameWidth;
      if (sizeWidth > maxSize) maxSize = sizeWidth;
      if (modifiedWidth > maxModified) maxModified = modifiedWidth;
    });
    setMaxNameWidth(maxName);
    setMaxSizeWidth(maxSize);
    setMaxModifiedWidth(maxModified);

  }, [folderContents]);

  return (
    <div className="flex h-screen w-full">
      <div className="flex-1 flex flex-row">
        {/* SideMenu Start */}
        <div className="w-[200px] flex flex-col bg-primary">
          {/* Logo Section Start */}
          <div className="p-4 flex flex-col">
            <div className="flex items-center gap-2">
              <ThemeBasedLogo />
              <span className="text-text-primary font-bold ml-1">Llama-FS</span>
            </div>
          </div>
          {/* Logo Section End */}

          {/* Quick Settings Start */}
          <div className="flex flex-1 flex-col pl-4 pr-4 flex-1">

            {/* Filenames Dropdown Start */}
            <div className="mb-5">
              <label className="block font-bold mb-2 text-text-primary">File Format</label>
              <div className="">
                <Select
                  selectedKeys={[fileFormatIndex.toString()]}
                  onChange={(e) => { setFileFormatIndex(e.target.value == null ? fileFormatIndex : parseInt(e.target.value)); console.log('e:',e) }}
                  scrollShadowProps={{
                    isEnabled: false,
                  }}
                  classNames={{
                    innerWrapper: "fileformat-select-wrapper",
                    mainWrapper: "fileformat-select-main-wrapper",
                    label: "fileformat-value",
                    value: "fileformat-value"
                  }}
                >
                  {fileFormats.map((format, index) => (
                    <SelectItem key={index} value={index.toString()} 
                      className="text-themeblack bg-themewhite text-xs">
                      {format}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </div>
            {/* Filenames Dropdown End */}

            {/* Max Tree Depth Plus/Minus Scale Start */}
            <div className="flex flex-col">
              <label className="font-bold text-text-primary">Max Tree Depth</label>
              <div className="flex flex-row">
                <div className="flex flex-1 flex-row">
                  <Button auto flat 
                  onClick={() => adjustMaxTreeDepth(-1)} 
                  disabled={maxTreeDepth <= 0} 
                  className="text-text-primary font-bold text-3xl">-</Button>
                  <Input
                    className="mx-2 text-center text-text-primary"
                    classNames={{
                      label: "text-black/50",
                      innerWrapper: "maxtreedepth-input-wrapper",
                      input: "custom-input"
                    }}
                    readOnly
                    value={maxTreeDepth.toString()}
                  />
                  <Button auto flat 
                  onClick={() => adjustMaxTreeDepth(1)} 
                  disabled={maxTreeDepth >= 10} 
                  className="text-text-primary font-bold text-3xl">+</Button>
                </div>
              </div>
            </div>
            {/* Max Tree Depth Plus/Minus Scale End */}

            {/* Move/Duplicate Checkboxes Start */}
            <div className="mt-5 flex flex-col">
              <label className="font-bold text-text-primary">Action</label>
              <div>
                <div className="mt-2 mb-2">
                  <CustomCheckbox
                    isSelected={processAction === 1}
                    onChange={() => handleActionChange(1)}
                    label="Duplicate"
                  />
                </div>
                <div className="">
                  <CustomCheckbox
                    isSelected={processAction === 0}
                    onChange={() => handleActionChange(0)}
                    label="Move"
                  />
                </div>
              </div>
            </div>
            {/* Move/Duplicate Checkboxes End */}
          </div>
          {/* Quick Settings End */}

          {/* Settings Button Start */}
          <div className="border-t border-secondary p-4 flex-row items-center justify-center">
            <Button variant="ghost" onClick={() => openSettings()} className="ml-[65px]">
              <SettingsIcon className=" h-[40px] w-[40px] text-text-primary" />
              <span className="text-text-primary text-[12px]">Settings</span>
            </Button>
          </div>
          {/* Settings Button End */}
        </div>
        {/* SideMenu End */}

        {/* Workspace Start */}
        <div className="flex-1 flex flex-col">
          {/* File Windows Start */}
          {loading ? (
            <div className="flex flex-col items-center">
              <h2 className="text-lg text-text-primary font-semibold mb-2">
                Reading and classifying your files...
              </h2>
              <div className="flex justify-center w-1/2">
                <img
                  src={ollamaWave}
                  alt="Loading..."
                  className="w-full"
                />
              </div>
            </div>
          ) : (<div className="flex flex-1 flex-col">

            {/* Folder Select Start */}
            <div className="flex bg-secondary p-4">
              <Button className="flex flex-1 bg-accent rounded-3xl" variant="ghost" onClick={handleBrowseFolder}>
                <Input
                  className="flex flex-1 text-text-primary"
                  classNames={{
                    label: "text-black/50",
                    innerWrapper: "custom-input-wrapper",
                    input: "custom-input"
                  }}
                  placeholder="Select a folder..."
                  type="text"
                  value={filePath}
                />
                <div className="text-text-primary rounded-r bg-accent pr-3 rounded-r-3xl">
                  Browse
                </div>
              </Button>
            </div>
            {/* Folder Select End */}
            
            <div className="flex flex-1 bg-background flex-1 flex flex-col">

              {/* Target Start */}
              <div className="flex flex-1">
                {filePathValid && (
                  <div className="w-full">
                    {/* Folder Categories Start */}
                    <div className="flex flex-1 bg-secondary p-2">
                      <span className={`w-[${maxNameWidth}px] text-text-primary font-bold`}>Name</span>
                      <span className={`w-[${maxSizeWidth}px] text-text-primary font-bold`}>Size</span>
                      <span className={`w-[${maxModifiedWidth}px] text-text-primary font-bold`}>Modified</span>
                    </div>
                    {/* Folder Categories End */}

                    {/* File Section Start */}
                    <div className="">
                      {folderContents.map(item => renderFileItem(item))}
                    </div>
                    {/* File Section End */}
                  </div>
                ) || (
                  <div className="flex flex-1 justify-center mt-4">
                    <span className="text-text-primary">
                      Select a folder to organize.
                    </span>
                  </div>
                )}
              </div>
              {/* Target End */}

              {/* Results Start */}
              {processAction == 1 && (<div className="flex-1 flex flex-col p-4 bg-secondary">
                {}
              </div>)}
              {/* Results End */}

            </div>

          </div>)}
          {/* File Windows End */}

          {/* Instruction Area Start */}
          <div className="pr-4 pl-5 pb-4 pt-2 border-t border-secondary bg-secondary">
            <label className="block font-bold mb-2 text-text-primary">Prompt</label>
            <div className="flex flex-row">
              {/* Prompt Start */}
              <div className="flex flex-1">
                
                <Input
                  className="w-full"
                  classNames={{
                    label: "text-black/50",
                    innerWrapper: "prompt-input-wrapper",
                    input: "custom-input"
                  }}
                  placeholder={`E.g. Organize by unique people and locations.`}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                />
              </div>
              {/* Prompt End */}

              {/* Submit Button Start */}
              <div className="flex justify-end ml-2">
                <Button onClick={handleBatch} className={`bg-${filePathValid ? 'success' : 'background'} text-themewhite pt-2 pb-2 pl-4 pr-4 rounded-3xl`}
                >Submit</Button>
              </div>
              {/* Submit Button End */}
            </div>
          </div>
          {/* Instruction Area End */}
        </div>
        {/* Workspace End */}
      </div>
    </div>
  );
}

export default MainScreen;
