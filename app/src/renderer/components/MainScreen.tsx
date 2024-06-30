import { Select, SelectItem, Input, Button } from "@nextui-org/react";
import { useState, useEffect, useRef } from "react";
import FolderIcon from "./Icons/FolderIcon";
import FileIcon from "./Icons/FileIcon";
import SettingsIcon from "./Icons/SettingsIcon";
import ChevronDown from "./Icons/ChevronDown";
import ChevronRight from "./Icons/ChevronRight";
import { useTheme } from "./ThemeContext";
import { useSettings } from "./SettingsContext";
import ThemeBasedLogo from "./ThemeBasedLogo";
import { FileData, AcceptedState, preorderTraversal, buildTree } from "./Utils";
import CustomCheckbox from './CustomCheckbox';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { debounce } from 'lodash';
import ChevronRight from "./Icons/ChevronRight";
import { fetchBatch, fetchFolderContents, fetchSingleDocumentSummary } from './API';
import { motion } from 'framer-motion';

const Spinner = () => (
  <motion.div
    animate={{ rotate: 360 }}
    transition={{ repeat: Infinity, duration: 1 }}
    style={{
      width: 50,
      height: 50,
      border: '5px solid #949494',
      borderTop: '5px solid #e3e3e3',
      borderRadius: '50%',
    }}
  />
);

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

  const [fixedSizePercentage, setFixedSizePercentage] = useState(0);
  
  useEffect(() => {

    const checkApiStatus = async (): Promise<boolean> => {
      try {
        const response = await fetch('/api/status'); // Replace with your actual API status endpoint
        if (response.ok) {
          return true;
        }
      } catch (error) {
        console.error('API is not available yet:', error);
      }
      return false;
    };

    const waitForApi = async () => {
      while (true) {
        const isApiUp = await checkApiStatus();
        if (isApiUp) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second before retrying
      }
    };

    window.electron.ipcRenderer.on('open-folder', (folderPath: string) => {
      setFilePath(folderPath);
      fetchFolderContents(filePath).then(contents => setFolderContents(contents));
    });
  
    if (filePathValid) {
      waitForApi().then(() => {
        fetchFolderContents(filePath).then(contents => setFolderContents(contents));
      });
    }

    const handleResize = () => {
      
      updateFileViewDims()
      
      const container = document.getElementById("panel-container");
      if (container) {
        const fixedPixelSize = 80
  
        var calc = parseInt(((fixedPixelSize / container.offsetHeight) * 100).toFixed(2));
        setFixedSizePercentage(calc);
      }

    };
  
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call to set dimensions

  }, [filePathValid]);

  const rightPanelRef = useRef(null);


  // Adjust max tree depth safely within bounds
  const adjustMaxTreeDepth = (delta) => {
    const newDepth = Math.min(10, Math.max(0, maxTreeDepth + delta));
    setMaxTreeDepth(newDepth);
  };

  // Handle action toggle between Move (0) and Duplicate (1)
  const handleActionChange = (action) => {
    if (processAction !== action) {
      setProcessAction(action);
      if (action == 1) {
        rightPanelRef.current.expand()
      } else {
        rightPanelRef.current.collapse()
      }
      updateFileViewDims()
    }
  };

  const [folderContents, setFolderContents] = useState<any[]>([]);
  const [folderContentsImageUrls, setFolderContentsImageUrls] = useState<{ [key: string]: string }>({});

  const [nameWidth, setNameWidth] = useState<number>(200);
  const [sizeWidth, setSizeWidth] = useState<number>(200);
  const [modifiedWidth, setModifiedWidth] = useState<number>(200);

  const handleNameResize = (size: number) => {
    setNameWidth(size);
  };

  const handleSizeResize = (size: number) => {
    setSizeWidth(size);
  };

  const handleModifiedResize =  (size: number) => {
    setModifiedWidth(size);
  };
  
  const handleBrowseFolder = async () => {
    const result = await window.electron.ipcRenderer.invoke('open-folder-dialog');
    if (result) {
      setFilePath(result as string);
      const contents = await fetchFolderContents(result as string);
      console.log('fetchFolderContents:',contents)
      setFolderContents(contents);
      setFilePathValid(true);
    }
  };

  const toggleFolderContentsVisible = (oldFolderContents, target) => {

    return oldFolderContents.map(item => {
      if (item.name === target.name && item.depth === target.depth) {
        return {
          ...item,
          folderContentsDisplayed: !item.folderContentsDisplayed
        };
      } else if (item.folderContents.length > 0) {
        return {
          ...item,
          folderContents: toggleFolderContentsVisible(item.folderContents, target)
        };
      }
      return item;
      
    });

  };

  const loadImageBase64 = async (filePath: string) => {

    try {
      const base64Data = await window.electron.ipcRenderer.invoke('load-image', filePath);
      setFolderContentsImageUrls(prev => ({ ...prev, [filePath]: base64Data }));
    } catch (error) {
      console.error('Failed to load image base64:', error);
    }

  };
  

  const attemptToggleFolderContentsVisible = async (toggleFolderVisible: boolean, parentFolderData: any) => {
    try {
      var prev = JSON.parse(JSON.stringify(folderContents));
    
      if (toggleFolderVisible !== undefined && toggleFolderVisible && parentFolderData !== undefined) {
        prev = toggleFolderContentsVisible(prev, parentFolderData);
      }
  
      setFolderContents(prev);
  
      // Load images for files in the folder
      if (parentFolderData && parentFolderData.absolutePath) {
        await loadImageBase64(parentFolderData.absolutePath);
      }
  
      console.log('folderContents:', prev);
    } catch (error) {
      console.error("Error reading directory:", error);
    }
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
      setFileViewHeight(prevHeight => prevHeight !== newHeight ? newHeight : prevHeight);
      setFileViewWidth(prevWidth => prevWidth !== newWidth ? newWidth-20 : prevWidth);
    }
  }, 200);

  const updateItemSummary = (oldFolderContents, target, newSummary) => {
    return oldFolderContents.map(item => {
      if (item.name === target.name && item.depth === target.depth) {
        return {
          ...item,
          summary: newSummary
        };
      } else if (item.folderContents.length > 0) {
        return {
          ...item,
          folderContents: updateItemSummary(item.folderContents, target, newSummary)
        };
      }
      return item;
    });
  };
  
  const attemptUpdateItemSummary = async (newSummary: string, targetItemData: any) => {
    try {
      var prev = JSON.parse(JSON.stringify(folderContents));
  
      // For updating item's summary.
      if (newSummary !== undefined && targetItemData !== undefined) {
        prev = updateItemSummary(prev, targetItemData, newSummary);
      }
  
      setFolderContents(prev);
  
      console.log('updated folderContents with new summary:', prev);

      return true

    } catch (error) {
      console.error("Error updating item summary:", error);

      return false

    }

  };

  const [reSummarizeLoading, setReSummarizeLoading] = useState(true)
  const [reSummarizeLoadingTargetPath, setReSummarizeLoadingTargetPath] = useState('')

  // Prompt API to re-summarize a given path.
  const reSummarize = async (path: string, item: any) => {

    setReSummarizeLoading(true)
    setReSummarizeLoadingTargetPath(path)

    const summary = await fetchSingleDocumentSummary({
      file_path: path,
      groq_api_key:groqAPIKey,
      model,
      instruction
    })

    console.log('summary:',summary)
    
    const updated = await attemptUpdateItemSummary(summary.summary, item)

    console.log('updated:',updated)

    setReSummarizeLoadingTargetPath('')
    setReSummarizeLoading(false)
    
  }

  const handleOpenFile = async (item: any) => {
    try {
      console.log('item.absolutePath:',item.absolutePath)
      await window.electron.ipcRenderer.invoke('open-file', item.absolutePath);
    } catch (error) {
      console.error("Failed to open file:", error);
    }

  };

  const renderFileItem = (item: any) => {
    var computedPadding = `${25}px`;
    
    if (item.depth == 0) {
      computedPadding = "0px";
    }
  
    const indentStyle = { paddingLeft: `${computedPadding}` };
    const maxNameWidth = (nameWidth / 100) * fileViewWidth;
  
    // Function to check if the file has an image extension
    const isImageFile = (filePath: string) => {
      const imageExtensions = ['.jpg', '.jpeg', '.png'];
      return imageExtensions.some(extension => filePath.toLowerCase().endsWith(extension));
    };

    return (
      <div key={item.absolutePath}>
        <div
          key={item.name + item.depth}
          className="flex flex-col pb-2"
          style={indentStyle}
        >
          <Button variant="ghost" disableRipple={true} disableAnimation={true}
            onClick={() => {
              attemptToggleFolderContentsVisible(
                true,
                item
              );
            }}>
            <div className="flex flex-row flex-1">
              <div style={{ width: `${maxNameWidth - ((25*item.depth))}px` }} className={`flex flex-row items-center`}>
                <div className="flex flex-row flex-1">
                  <div className="">
                    {item.folderContentsDisplayed && (<ChevronDown color={theme == 'dark' ? "#e3e3e3" : "#121212"} />) ||
                      (<ChevronRight color={theme == 'dark' ? "#e3e3e3" : "#121212"} />)}
                  </div>
                  <span className="mr-2">
                    {item.isDirectory ? <FolderIcon color={"#E8B130"} /> :
                      <FileIcon color={theme == 'dark' ? "#e3e3e3" : "#121212"} />}
                  </span>
                  <span className={item.isDirectory ? "flex flex-1 text-text-primary font-bold text-sm" :
                    "flex flex-1 text-text-primary font-bold text-sm"}>
                    {truncateName(item.name, maxNameWidth - (120 + (25*item.depth)))}
                  </span>
                </div>
              </div>
              <div style={{ width: `${((sizeWidth / 100) * fileViewWidth)}px` }} className={`flex flex-row items-center`}>
                <span className={item.isDirectory ? "flex flex-1 text-text-primary font-bold text-sm" :
                  "flex flex-1 text-text-primary font-bold text-sm"}>
                  {item.size}
                </span>
              </div>
              <div style={{ width: `${((modifiedWidth / 100) * fileViewWidth) - 50}px` }} className={`flex flex-row items-center`}>
                <span className={item.isDirectory ? "flex flex-1 text-text-primary font-bold text-sm" :
                  "flex flex-1 text-text-primary font-bold text-sm"}>
                  {item.modified}
                </span>
              </div>
            </div>
          </Button>
          {item.folderContentsDisplayed && (
            <div>
              {item.isDirectory && (<div className="flex justify-start items-start mt-[5px]">
                {item.folderContents.length > 0 && (
                  <div>
                    {item.folderContents.map(subItem => renderFileItem(subItem))}
                  </div>
                ) || (
                  <div className="flex flex-row items-center ml-[25px] mt-[5px]">
                    <ChevronRight color={theme == 'dark' ? "#e3e3e3" : "#121212"} />
                    <span className="text-text-primary">
                      Folder Empty
                    </span>
                  </div>
                )}
              </div>) || (<div className="flex flex-col bg-secondary mt-2 bg-secondary rounded-3xl pb-2 mb-2">
                <span className="text-text-primary pl-4 pr-4 pt-2 pb-2 bg-primary rounded-tl-3xl rounded-tr-3xl">{truncateName(item.name, maxNameWidth*2.2)}</span>
                
                <div className="flex flex-row items-center">
                  <div className="mt-4 mb-2 ml-4 rounded-3xl overflow-hidden" style={{
                    width:maxNameWidth/2
                  }}>
                    {isImageFile(item.absolutePath) && (
                      <img src={folderContentsImageUrls[item.absolutePath]} alt={item.name} />
                    )}
                  </div>
                  {(reSummarizeLoading && reSummarizeLoadingTargetPath == item.absolutePath) && (<div className={`flex flex-1 flex-col p-4 items-center justify-center w-full`}>
  
                  <Spinner />
                  <span className="text-text-primary mt-1">Summarizing...</span>
  
                  </div>) ||
                  (<div className={`flex flex-col flex-1 p-4 items-center justify-center`}>
                  <div className="pl-2 pr-4 items-center justify-center text-center">
                    {item.summary.length > 0 && (<span className="text-text-primary mb-1 text-center">"{item.summary}"</span>) ||
                      (<span className="text-text-primary mb-1 text-center">No summary yet. "Organize!" will do this for all target files!</span>)}
                  </div>
                  <div className={`flex flex-col`}>
                    <div className="flex-row flex" style={{
                      marginTop:'10px'
                    }}>
                      <Button auto flat disableAnimation={true}
                          onClick={() => reSummarize(item.absolutePath, item)} 
                          className={`${filePathValid ? 'bg-success' : 'bg-background'} text-themewhite pt-2 pb-2 pl-4 pr-4 rounded-3xl h-[40px] ml-2`}
                          fullWidth={true}
                      >
                        {item.summary.length == 0 ? 'Summarize Single File' : 'Re-Summarize'}
                      </Button>
                    </div>
                  </div>
                  </div>)}
                </div>
              </div>)}
            </div>
          )}
        </div>
      </div>
    );
  };
  

  const handleBatch = async () => {

    if (filePathValid) {

      setLoading(true);

      const data = await fetchBatch({
        path: filePath,
        model,
        instruction,
        max_tree_depth: maxTreeDepth,
        file_format: fileFormats[fileFormatIndex],
        groq_api_key: groqAPIKey,
        process_action: processAction
      });

      console.log('batch:', data)
      setLoading(false);

    }

  };

  const openSettings = () => {};

  const [copyFolderContents, setCopyFolderContents] = useState<any[]>([]);

  const [copyNameWidth, setCopyNameWidth] = useState<number>(200);
  const [copySizeWidth, setCopySizeWidth] = useState<number>(200);
  const [copyModifiedWidth, setCopyModifiedWidth] = useState<number>(200);

  const handleCopyNameResize = (size: number) => {
    setCopyNameWidth(size);
  };

  const handleCopySizeResize = (size: number) => {
    setCopySizeWidth(size);
  };

  const handleCopyModifiedResize =  (size: number) => {
    setCopyModifiedWidth(size);
  };
  
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
            {false && (<div className="mb-5">
              <label className="block font-bold mb-2 text-text-primary">File Format</label>
              <div className="">
                <Select
                  selectedKeys={[fileFormatIndex.toString()]}
                  onChange={(e) => { setFileFormatIndex(e.target.value == null ? fileFormatIndex : parseInt(e.target.value)); }}
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
            </div>)}
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
        <div className="flex-1 flex flex-col" id="panel-container">
          <PanelGroup direction={"vertical"}>
            
            {/* File Windows Start */}
            <Panel defaultSize={100 - fixedSizePercentage} minSize={100 - fixedSizePercentage} maxSize={100 - fixedSizePercentage} className="flex flex-1">
              {(loading && processAction == 0) ? (
                <div className={`flex flex-1 flex-col p-4 items-center justify-center w-full h-screen`}>

                  <Spinner />
                  <span className="text-text-primary mt-1">Reading and organizing your files...</span>

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
                              <Panel defaultSize={50} minSize={25} onResize={handleNameResize}>
                                <div className="flex flex-row items-center">
                                  <span className="flex flex-1 text-text-secondary font-bold pt-2 pl-4 pr-4 pb-2">
                                    Name
                                  </span>
                                </div>
                              </Panel>
                              <PanelResizeHandle />
                              <Panel defaultSize={15} minSize={20} onResize={handleSizeResize}>
                                <div className="flex flex-row items-center">
                                  <span className="w-[3px] h-[24px] rounded bg-text-secondary"></span>
                                  <span className="flex flex-1 text-text-secondary font-bold pt-2 pl-4 pr-4 pb-2">
                                    Size
                                  </span>
                                </div>
                              </Panel>
                              <PanelResizeHandle />
                              <Panel defaultSize={35} minSize={25} onResize={handleModifiedResize}>
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
                            <div className="scrollview flex-col bg-background">
                              {folderContents.map(item => renderFileItem(item))}
                            </div>
                          </div>
                          {/* File Section End */}
                        </div>
                      </div>
                      {/* Target End */}
                    </Panel>
                    <Panel defaultSize={50} ref={rightPanelRef} collapsible={true}>
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
            </Panel>
            {/* File Windows End */}
            
            {/* Instruction Area Start */}
            <Panel defaultSize={fixedSizePercentage} minSize={fixedSizePercentage} maxSize={fixedSizePercentage} className="flex flex-1 flex-col pr-4 pl-5 pb-4 pt-2 border-t border-secondary bg-secondary">
              <label className="block font-bold mb-2 text-text-primary ">Prompt</label>
              <div className="flex flex-1 flex-row">
                <div className="flex flex-1 flex-row">
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
                  <div className={'ml-2'}>

                    <Button auto flat disableAnimation={true}
                    onClick={handleBatch} 
                    className={`${filePathValid ? 'bg-success' : 'bg-background'} text-themewhite pt-2 pb-2 pl-4 pr-4 rounded-3xl h-[40px]`}
                    >Organize!</Button>

                  </div>
                  {/* Submit Button End */}
                </div>
              </div>
            </Panel>
            {/* Instruction Area End */}
            
          </PanelGroup>
        </div>
        {/* Workspace End */}
      </div>
    </div>
  );
}

export default MainScreen;
