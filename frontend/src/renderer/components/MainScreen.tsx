import { Select, SelectItem, SelectSection, Input, Button, cn} from "@nextui-org/react";
import { useState, useEffect, useRef } from "react";
import FolderIcon from "./Icons/FolderIcon";
import FileIcon from "./Icons/FileIcon";
import SettingsIcon from "./Icons/SettingsIcon";
import CheckIcon from "./Icons/CheckIcon";
import ollamaWave from "../../../assets/ollama_wave.gif";
import { useTheme } from "./ThemeContext";
import { useSettings } from "./SettingsContext";
import ThemeBasedLogo from "./ThemeBasedLogo";
import { FileData, AcceptedState, preorderTraversal, buildTree } from "./Utils";
import CustomCheckbox from './CustomCheckbox';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { debounce } from 'lodash';

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
    
    if (filePathValid) {
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
    }
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

  const [nameWidth, setNameWidth] = useState<number>(200);
  const [sizeWidth, setSizeWidth] = useState<number>(200);
  const [modifiedWidth, setModifiedWidth] = useState<number>(200);

  const handleNameResize = (size: number) => {
    console.log(`Resizing Name Column to: ${size} percent`);
    setNameWidth(size);
  };

  const handleSizeResize = (size: number) => {
    console.log(`Resizing Size Column to: ${size} percent`);
    setSizeWidth(size);
  };

  const handleModifiedResize = (size: number) => {
    console.log(`Resizing Modified Column to: ${size} percent`);
    setModifiedWidth(size);
  };


  const [copyNameWidth, setCopyNameWidth] = useState<number>(200);
  const [copySizeWidth, setCopySizeWidth] = useState<number>(200);
  const [copyModifiedWidth, setCopyModifiedWidth] = useState<number>(200);
  const [centerDraggableWidth, setCenterDraggableWidth] = useState<number>(200);

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
      const fileDetails = contents.map((file: any) => ({
        name: file.name,
        isDirectory: file.isDirectory,
        size: file.size,
        modified: file.modified,
        folderContents: [],
        folderContentsDisplayed: false,
        depth: depth
      }));
      setFolderContents(prev => updateFolderContents(prev, path, fileDetails, depth));
      setFilePathValid(true)
    } catch (error) {
      console.error("Error reading directory:", error);
    }
  };

  const updateFolderContents = (contents: any[], basePath: string, newContents: any[], depth: number) => {
    if (depth === 0) {
      // We are refreshing our primary content.
      return newContents;
    } else {
      // Recursively navigate through the contents to find the correct folder to update.
      const baseSegments = basePath.split('/');
      const fileSegments = filePath.split('/');
      
      const relativeSegments = fileSegments.slice(baseSegments.length);
      let currentLevel = contents;
  
      relativeSegments.forEach((segment, index) => {
        const currentItem = currentLevel.find(item => item.name === segment && item.isDirectory);
        if (currentItem) {
          if (index === relativeSegments.length - 1) {
            // We have reached the target directory to update.
            currentItem.folderContents = newContents;
          } else {
            // Move deeper into the directory structure.
            currentLevel = currentItem.folderContents;
          }
        }
      });
      return contents;
    }
  };  

  const formatSize = (bytes) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
  };

  const truncateName = (name, maxWidth) => {
    const ellipsis = '...';
    let truncatedName = name;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = 'bold 16px Arial'; // Adjust based on your font settings

    while (context.measureText(truncatedName).width > maxWidth) {
      if (truncatedName.length <= 1) {
        break;
      }
      truncatedName = truncatedName.substring(0, truncatedName.length - 1);
    }
    if (context.measureText(name).width > maxWidth) {
      truncatedName += ellipsis;
    }
    return truncatedName;
  };

  
  const [fileViewHeight, setFileViewHeight] = useState(0);
  const [fileViewWidth, setFileViewWidth] = useState(0);
  const fileViewResizeRef = useRef(null);

  const updateFileViewDims = debounce(() => {
    if (fileViewResizeRef.current) {
      const newHeight = fileViewResizeRef.current.clientHeight;
      const newWidth = fileViewResizeRef.current.clientWidth;

      console.log('fileViewResizeRef.current:',fileViewResizeRef.current)
      console.log('newHeight',newHeight)
      console.log('newWidth',newWidth)

      setFileViewHeight(prevHeight => prevHeight !== newHeight ? newHeight : prevHeight);
      setFileViewWidth(prevWidth => prevWidth !== newWidth ? newWidth : prevWidth);
    }
  }, 200);

  
  const renderFileItem = (item: any) => {

    const indentStyle = { paddingLeft: `${item.depth * 20}px` };
    const maxNameWidth = (nameWidth / 100) * fileViewWidth;

    console.log('renderFileItem nameWidth:',nameWidth)

    return (<Button variant="ghost" disableRipple={true} disableAnimation={true} 

      onClick={() => {
        if (item.isDirectory) {
          validateAndFetchFolderContents(
            `${filePath}/${item.name}`,
            item.depth + 1
          );
        }
    }}>
      <div
        key={item.name + item.depth}
        className="flex items-center pb-2"
        style={indentStyle}
      >
        <div className="flex flex-row flex-1">
          <div style={{ width: `${maxNameWidth}px` }} className={`flex flex-row items-center`}>
            <div className="flex flex-row flex-1">
              <span className="mr-2">
                {item.isDirectory ? <FolderIcon color={"#E8B130"} /> : 
                <FileIcon color={theme == 'dark' ? "#e3e3e3" : "#121212"} />}
              </span>
              <span className={item.isDirectory ? "flex flex-1 text-text-primary font-bold" : 
                "flex flex-1 text-text-primary font-bold"}>
                {truncateName(item.name, maxNameWidth-120)}
              </span>
            </div>
          </div>
          <div style={{ width: `${(sizeWidth/100)*fileViewWidth}px` }} className={`flex flex-row items-center`}>
            <span className={item.isDirectory ? "flex flex-1 text-text-primary font-bold" : 
              "flex flex-1 text-text-primary font-bold"}>
              {formatSize(item.size)}
            </span>
          </div>
          <div style={{ width: `${(modifiedWidth/100)*fileViewWidth}px` }} className={`flex flex-row items-center`}>
            <span className={item.isDirectory ? "flex flex-1 text-text-primary font-bold" : 
            "flex flex-1 text-text-primary font-bold"}>
              {item.modified}
            </span>
          </div>
        </div>
        <div>
          {item.folderContents.map(subItem => renderFileItem(subItem))}
        </div>
      </div>
      </Button>);
  };
  
  useEffect(() => {
    if (filePathValid) {
      validateAndFetchFolderContents(filePath, 0);
    }
  
    const handleResize = () => updateFileViewDims();
  
    window.addEventListener('resize', handleResize);
    updateFileViewDims(); // Initial call to set dimensions
  
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [filePathValid]);

  return (
    <div className="flex h-screen w-full">
      <div className="flex-1 flex flex-row">
        {/* SideMenu Start */}
        <div className="w-[200px] flex flex-col bg-primary">
          {/* Logo Section Start */}
          <div className="p-4 flex flex-col">
            <div className="flex items-center gap-2 ml-3">
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
            <Button variant="ghost" onClick={() => openSettings()} className="ml-[46px] items-center justify-center">
              <SettingsIcon className="ml-[15px] h-[40px] w-[40px] text-text-primary" />
              <span className="text-text-primary text-[12px]">More Settings</span>
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
            <div className="flex bg-primary p-4">
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

            {filePathValid && (<div className="flex flex-1 bg-background flex-1 flex flex-row border-secondary border-t-2 border-b-2">

              <PanelGroup direction="horizontal" autoSaveId="outerPanel">
                <Panel defaultSize={50}>
                  {/* Target Start */}
                  <div ref={fileViewResizeRef} className={`flex flex-1 h-full`}>
                    <div className="w-full flex flex-col bg-secondary">

                      <span className={`
                        text-text-primary font-bold 
                        pt-2 pl-4 pr-4 pb-2
                      `}>{filePath}</span>

                      {/* Folder Categories Header Start */}
                      <div className="flex flex-row">
                        <PanelGroup direction="horizontal" autoSaveId="example">
                          <Panel defaultSize={40} minSize={25} onResize={handleNameResize}>
                            <div className="flex flex-row items-center">
                              <span className="flex flex-1 text-text-secondary font-bold pt-2 pl-4 pr-4 pb-2">
                                Name
                              </span>
                            </div>
                          </Panel>
                          <PanelResizeHandle />
                          <Panel defaultSize={20} minSize={20} onResize={handleSizeResize}>
                            <div className="flex flex-row items-center">
                              <span className="w-[3px] h-[24px] rounded bg-text-secondary"></span>
                              <span className="flex flex-1 text-text-secondary font-bold pt-2 pl-4 pr-4 pb-2">
                                Size
                              </span>
                            </div>
                          </Panel>
                          <PanelResizeHandle />
                          <Panel defaultSize={30} minSize={25} onResize={handleModifiedResize}>
                            <div className="flex flex-row items-center">
                              <span className="w-[3px] h-[24px] rounded bg-text-secondary"></span>
                              <span className="flex flex-1 text-text-secondary font-bold pt-2 pl-4 pr-4 pb-2">
                                Modified
                              </span>
                            </div>
                          </Panel>
                        </PanelGroup>
                      </div>
                      {/* Folder Categories Header End */}

                      {/* File Section Start */}
                      <div className="parent" style={{height:fileViewHeight-80}}>
                        <div className="scrollview flex-col bg-background pl-2 pr-2 pb-2 roo">
                          {folderContents.map(item => renderFileItem(item))}
                        </div>
                      </div>
                      {/* File Section End */}
                    </div>
                  </div>
                  {/* Target End */}
                </Panel>
                <Panel defaultSize={50}>
                  {/* Copy Preview Start */}
                  {processAction == 1 && (<div className="flex-1 flex flex-col p-4 bg-background text-text-primary">
                    Hello World!
                  </div>)}
                  {/* Copy Preview  End */}
                </Panel>
              </PanelGroup>

            </div>) 
              || (<div className="flex flex-1 justify-center pt-4 bg-background">
                <span className="text-text-primary">
                  Select a folder to organize.
                </span>
            </div>)}

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
              <div className={`flex justify-end ml-2 rounded-3xl ${filePathValid ? 'bg-success' : 'bg-background'}`}>
                <Button auto flat disableAnimation={true}
                onClick={handleBatch} 
                className={`${filePathValid ? 'bg-success' : 'bg-background'} text-themewhite pt-2 pb-2 pl-4 pr-4 rounded-3xl`}
                >Organize!</Button>
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
