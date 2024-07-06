import { Select, SelectItem, Input, Button } from "@nextui-org/react";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "./ThemeContext";
import { useSettings } from "./SettingsContext";
import { debounce } from 'lodash';
import { fetchFolderContents, fetchSingleDocumentSummary } from './API';
import RenderFileItem from "./Main/RenderFileItem";
import SettingsIcon from "./Icons/SettingsIcon";
import SidebarIcon from "./Icons/SidebarIcon";
import NewChatButton from "./Icons/NewChatButton";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Spinner, truncateName } from './Utils'
import { API } from '../../../globals' 
import OverlayPopup from './Main/OverlayPopup';
import ErrorPopup from './Main/ErrorPopup';
import { format, isToday, isYesterday, differenceInDays, parseISO } from 'date-fns';

const getDateCategory = (dateString) => {
  console.log('dateString:',dateString)
  const date = parseISO(dateString);
  console.log('date:',date)
  if (isToday(date)) {
    return 'Today';
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  const daysDifference = differenceInDays(new Date(), date);
  if (daysDifference <= 7) {
    return 'Previous 7 days';
  }
  if (daysDifference <= 30) {
    return 'Previous 30 days';
  }
  return 'Older';
};

const MainScreen = () => {
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
    filePath, setFilePath,
    fileDuplicatePath, setFileDuplicatePath,
    filePathValid, setFilePathValid,
    openOnBatchComplete, setOpenOnBatchComplete,
    addConversation,
    removeConversation,
    conversations,
    resetConversations,
    toggleConversationSelected
  } = useSettings();

  const loadConversation = async (index: number) => {
    try {
      if (index >= 0 && index < conversations.length) {
        const conversation = conversations[index];
  
        // Fetch folder contents for the main folder
        const mainContents = await fetchFolderContents(conversation.folder);
        setFolderContents(mainContents.folder_contents);
  
        // Fetch folder contents for the copy folder if processAction is 1
        if (conversation.processAction === 1) {
          const copyContents = await fetchFolderContents(conversation.copyFolder);
          setCopyFolderContents(copyContents.folder_contents);
        }
  
        // Set other states from the conversation
        setFilePath(conversation.folder);
        setFileDuplicatePath(conversation.copyFolder);
        setProcessAction(conversation.processAction);
        setFilePathValid(true);
  
        // Toggle the selected conversation
        toggleConversationSelected(index);
      } else {
        console.error('Invalid conversation index:', index);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const clearVariables = () => {

    setFilePath('')
    setFilePathValid(false)
    setFolderContents([])
    setCopyFolderContents([])

  }

  const [loading, setLoading] = useState<boolean>(false);
  const [fixedSizePercentage, setFixedSizePercentage] = useState(0);
  const [folderContents, setFolderContents] = useState<any[]>([]);
  const [folderContentsImageUrls, setFolderContentsImageUrls] = useState<{ [key: string]: string }>({});
  const [nameWidth, setNameWidth] = useState<number>(200);
  const [sizeWidth, setSizeWidth] = useState<number>(200);
  const [modifiedWidth, setModifiedWidth] = useState<number>(200);
  const [fileViewHeight, setFileViewHeight] = useState(0);
  const [fileViewWidth, setFileViewWidth] = useState(0);
  const [reSummarizeLoading, setReSummarizeLoading] = useState(true);
  const [reSummarizeLoadingTargetPath, setReSummarizeLoadingTargetPath] = useState('');
  const rightPanelRef = useRef(null);
  const fileViewResizeRef = useRef(null);
  const [errorPopup, setErrorPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  useEffect(() => {

    console.log("conversations:",conversations)

    const checkApiStatus = async (): Promise<boolean> => {
      try {
        const response = await fetch(API);
        console.log('checkApiStatus:',response)
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
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    };

    window.electron.ipcRenderer.on('open-folder', (folderPath: string) => {
      setFilePath(folderPath);
      fetchFolderContents(folderPath).then(
        (contents) => {

          setFolderContents(contents.folder_contents)
          setFilePathValid(true);
          if (copyFolderContents.length == 0) {
            setFileDuplicatePath(contents.unique_path)
          }

        }
      );
      
    });

    if (filePathValid) {
      waitForApi().then(() => {
        fetchFolderContents(filePath).then(
          (contents) => {
  
            setFolderContents(contents.folder_contents)
            if (copyFolderContents.length == 0) {
              setFileDuplicatePath(contents.unique_path)
            }
  
          }
        );
      });
    }

    window.addEventListener('resize', handleResize);
    handleResize();
  }, [filePathValid]);

  const handleResize = () => {
    updateFileViewDims();
    const container = document.getElementById("panel-container");
    if (container) {
      var everythingElse = container.offsetHeight - 73.93
      var everythingElsePercent = parseFloat(((everythingElse/container.offsetHeight)*100).toFixed(2))
      setFixedSizePercentage(everythingElsePercent);
    }
  };

  const handleOpenFile = async (str: string) => {
    try {
      console.log('handleOpenFile:',str)
      await window.electron.ipcRenderer.invoke('open-file', str, true);
    } catch (error) {
      console.error("Failed to open file:", error);
    }

  };

  const handleActionChange = (action) => {
    if (processAction !== action) {
      setProcessAction(action);
      if (action == 1) {
        rightPanelRef.current.expand();
      } else {
        rightPanelRef.current.collapse();
      }
      handleResize()
    }
  };

  const handleNameResize = (size: number) => {
    setNameWidth(size);
  };

  const handleSizeResize = (size: number) => {
    setSizeWidth(size);
  };

  const handleModifiedResize = (size: number) => {
    setModifiedWidth(size);
  };

  const handleBrowseFolder = async () => {
    const result = await window.electron.ipcRenderer.invoke('open-folder-dialog');
    if (result) {
        setFilePath(result);
        const { folder_contents, unique_path } = await fetchFolderContents(result);
        setFolderContents(folder_contents);
        setCopyFolderContents([])
        setFileDuplicatePath(unique_path)
        console.log('unique_path:',unique_path)
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

  const attemptToggleFolderContentsVisible = async (toggleFolderVisible: boolean, parentFolderData: any, isCopyContents: boolean = false) => {
    try {
      let prev = JSON.parse(JSON.stringify(isCopyContents ? copyFolderContents : folderContents));
  
      if (toggleFolderVisible !== undefined && toggleFolderVisible && parentFolderData !== undefined) {
        prev = toggleFolderContentsVisible(prev, parentFolderData);
      }
  
      if (isCopyContents) {
        setCopyFolderContents(prev);
      } else {
        setFolderContents(prev);
      }
  
      if (parentFolderData && parentFolderData.absolutePath && !parentFolderData.isDirectory) {
        await loadImageBase64(parentFolderData.absolutePath);
      }
    } catch (error) {
      console.error("Error reading directory:", error);
    }
  };
  

  const updateFileViewDims = debounce(() => {
    if (fileViewResizeRef.current) {
      const newHeight = fileViewResizeRef.current.clientHeight;
      const newWidth = fileViewResizeRef.current.clientWidth;
      setFileViewHeight(prevHeight => (prevHeight !== newHeight ? newHeight : prevHeight));
      setFileViewWidth(prevWidth => (prevWidth !== newWidth ? newWidth - 20 : prevWidth));
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

      if (newSummary !== undefined && targetItemData !== undefined) {
        prev = updateItemSummary(prev, targetItemData, newSummary);
      }

      setFolderContents(prev);

      return true;
    } catch (error) {
      console.error("Error updating item summary:", error);

      return false;
    }
  };

  const reSummarize = async (path: string, item: any) => {
    setReSummarizeLoading(true);
    setReSummarizeLoadingTargetPath(path);

    const summary = await fetchSingleDocumentSummary({
      file_path: path,
      groq_api_key: groqAPIKey,
      model,
      instruction
    });

    await attemptUpdateItemSummary(summary.summary, item);

    setReSummarizeLoadingTargetPath('');
    setReSummarizeLoading(false);
  };

  const fetchBatch = async (body) => {
    console.log('batch body:', body);
    try {
      const response = await fetch(`${API}/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorContent = await response.json();
        setErrorPopup(true);
        setErrorMessage(errorContent.detail || "Unknown error occurred");
        return;
      }

      const content = await response.json();
      console.log('batch content:', content);
      return content;
    } catch (error) {
      console.log('fetchbatch error:',error)
      if (error.message.includes("Failed to fetch")) {
        fetchBatch(body)
      } else {
        setErrorPopup(true);
        setErrorMessage(error.message || "Unknown error occurred");
      }
    }
  };

  const handleBatch = async () => {
    if (filePathValid) {
      setLoading(true);

      try {
        setCopyFolderContents([]);
        const { _, unique_path } = await fetchFolderContents(filePath);
        setFileDuplicatePath(unique_path);

        const result = await fetchBatch({
          path: filePath,
          model,
          instruction,
          max_tree_depth: maxTreeDepth,
          file_format: fileFormats[fileFormatIndex],
          groq_api_key: groqAPIKey,
          process_action: processAction,
        });

        if (result) {

          // Add conversation persistence.
          addConversation({
            folder: filePath,
            copyFolder: unique_path,
            processAction: processAction,
            selected: true
          })

          // Set current contents.
          if (processAction == 0) {
            setFolderContents(result.folder_contents);
            if (openOnBatchComplete) {
              await handleOpenFile(filePath);
            }
          } else {
            setFileDuplicatePath(unique_path);
            setCopyFolderContents(result.folder_contents);
            if (openOnBatchComplete) {
              await handleOpenFile(unique_path);
            }
          }
        }

      } catch (error) {
        console.error("Error in handleBatch:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const openSettings = () => {
    setIsSettingsOpen(true);
  };

  const closeSettings = () => {
    setIsSettingsOpen(false);
  };

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

  const handleCopyModifiedResize = (size: number) => {
    setCopyModifiedWidth(size);
  };

  return (
    <div className="flex h-screen w-full">
      <div className="flex-1 flex flex-row">
      <div className={`transition-width duration-300 ease-in-out ${sidebarOpen ? 'w-[250px]' : 'w-0'} overflow-hidden flex flex-col bg-primary`}>
          <div className="flex flex-row border-b border-r border-secondary h-[71px] pt-[25px] pl-[20px] pr-[20px] justify-between items-between">
            <div>
              <Button variant="ghost" disableRipple={true} disableAnimation={true} onClick={() => toggleSidebar()}>
                <SidebarIcon  color={(theme == "dark" || theme == "pink") ? "#e3e3e3" : "#121212"} />
              </Button>
            </div>
            <div>
              <Button variant="ghost" disableRipple={true} disableAnimation={true} onClick={() => clearVariables()}>
                <NewChatButton  color={(theme == "dark" || theme == "pink") ? "#e3e3e3" : "#121212"} />
              </Button>
            </div>
          </div>

          {(conversations != undefined && conversations.length > 0) && (
            <div className="flex flex-1 flex-col pl-4 pr-4 flex-1">
              {(() => {
                const seenCategories = new Set();
                return conversations.map((conversation, index) => {
                  const category = getDateCategory(conversation.date);
                  const shouldShowTitle = !seenCategories.has(category);
                  if (shouldShowTitle) seenCategories.add(category);
                  return (
                    <div key={index} className="flex flex-col mb-2">
                      {shouldShowTitle && (
                        <div className="flex items-center justify-start mt-2 mb-2 text-gray-500">
                          {category}
                        </div>
                      )}
                      <Button variant="ghost" className="p-2 flex flex-col text-left rounded-3xl hover:bg-secondary text-text-primary" onClick={() => loadConversation(index)}>
                        <span className="font-semibold text-sm">
                          {conversation.folder.split('\\').pop()}
                        </span>
                        <span className="text-xs text-gray-500">{truncateName(conversation.folder, 300)}</span>
                      </Button>
                    </div>
                  );
                });
              })()}
            </div>
          ) || (
            <div className="flex flex-1 flex-col pl-4 pr-4 flex-1">
            </div>
          )}

          <div className="border-t border-secondary p-4 flex-row items-center justify-center">
            <Button variant="ghost" onClick={() => openSettings()} className="ml-[74px] items-center justify-center">
              <SettingsIcon className="ml-[15px] h-[40px] w-[40px] text-text-primary" />
              <span className="text-text-primary text-[12px] ml-[15px]">Settings</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col" id="panel-container">
          <PanelGroup direction={"vertical"}>
            <Panel defaultSize={fixedSizePercentage} minSize={fixedSizePercentage} maxSize={fixedSizePercentage} className="flex flex-1">
            <div className="flex flex-1 flex-col">
                  <div className="flex flex-row bg-primary p-4">
                    {!sidebarOpen && (<div className="mr-4 mt-[7px]">
                      <Button variant="ghost" disableRipple={true} disableAnimation={true} onClick={() => toggleSidebar()}>
                        <SidebarIcon  color={(theme == "dark" || theme == "pink") ? "#e3e3e3" : "#121212"} />
                      </Button>
                    </div>)}
                    <Button className="flex flex-1 rounded-3xl" variant="ghost" onClick={handleBrowseFolder}>
                      <div className="bg-accent flex flex-row flex-1 items-center justify-center">
                      <Input
                        className="flex flex-1 text-text-primary"
                        classNames={{ label: "text-black/50", innerWrapper: "custom-input-wrapper", input: "custom-input", inputWrapper: "input-wrapper" }}
                        placeholder="Select a folder..."
                        type="text"
                        value={filePath}
                      />
                      <div className="text-text-primary rounded-r bg-accent pr-3 rounded-r-3xl ml-2">Browse</div>
                      </div>
                    </Button>
                  </div>
                  {filePathValid ? (
                    <div className="flex flex-1 bg-background flex-1 flex flex-row border-secondary border-t-2 border-b-2">
                      <PanelGroup direction="horizontal" autoSaveId="outerPanel">
                        <Panel defaultSize={50}>
                          <div ref={fileViewResizeRef} className="flex flex-1 h-full">
                            <div className="w-full flex flex-col bg-secondary">
                              <div className="flex flex-row pt-2 pl-4 pr-4 pb-2 ">
                                  <Button auto flat onClick={() => handleOpenFile(filePath)} className={`${filePathValid ? (loading ? "bg-text-secondary" : "bg-accent") : "bg-background"} text-themewhite rounded-3xl h-[30px] pl-4 pr-4`}>
                                    Open
                                  </Button>
                                  <Button className="flex flex-row" variant="ghost" auto flat disableAnimation={true} onClick={() => handleOpenFile(filePath)}>
                                    <span className="text-text-primary font-bold ml-[10px] mt-[0px]">{filePath}</span>
                                  </Button>
                              </div>

                              <div className="flex flex-row">
                                <PanelGroup direction="horizontal" autoSaveId="example">
                                  <Panel defaultSize={50} minSize={25} onResize={handleNameResize}>
                                    <div className="flex flex-row items-center">
                                      <span className="flex flex-1 text-text-secondary font-bold pt-2 pl-4 pr-4 pb-2">Name</span>
                                    </div>
                                  </Panel>
                                  <PanelResizeHandle />
                                  <Panel defaultSize={20} minSize={20} onResize={handleSizeResize}>
                                    <div className="flex flex-row items-center">
                                      <span className="w-[3px] h-[24px] rounded bg-text-secondary"></span>
                                      <span className="flex flex-1 text-text-secondary font-bold pt-2 pl-4 pr-4 pb-2">Size</span>
                                    </div>
                                  </Panel>
                                  <PanelResizeHandle />
                                  <Panel defaultSize={35} minSize={25} onResize={handleModifiedResize}>
                                    <div className="flex flex-row items-center">
                                      <span className="w-[3px] h-[24px] rounded bg-text-secondary"></span>
                                      <span className="flex flex-1 text-text-secondary font-bold pt-2 pl-4 pr-4 pb-2">Modified</span>
                                    </div>
                                  </Panel>
                                </PanelGroup>
                              </div>

                              

                              {(!loading || processAction == 1) && (<div className="parent" style={{ height: fileViewHeight - 80 }}>
                                  <div className="scrollview flex-col bg-background">
                                    {folderContents.map(item => (
                                      <RenderFileItem
                                        key={item.absolutePath}
                                        item={item}
                                        fileViewWidth={fileViewWidth}
                                        nameWidth={nameWidth}
                                        sizeWidth={sizeWidth}
                                        modifiedWidth={modifiedWidth}
                                        folderContentsImageUrls={folderContentsImageUrls}
                                        reSummarizeLoading={reSummarizeLoading}
                                        reSummarizeLoadingTargetPath={reSummarizeLoadingTargetPath}
                                        truncateName={truncateName}
                                        attemptToggleFolderContentsVisible={(toggleFolderVisible, parentFolderData) => attemptToggleFolderContentsVisible(toggleFolderVisible, parentFolderData, false)}
                                        loadImageBase64={loadImageBase64}
                                        reSummarize={reSummarize}
                                        filePathValid={filePathValid}
                                      />
                                    ))}
                                  </div>
                                </div>) || (<div className="flex flex-1 flex-col items-center justify-center text-center text-text-primary bg-background">
                                    <Spinner spinnerColor={(theme == 'pink') ? '#bb86fc' : undefined}/>
                                    <span className="mt-2">Organizing files. This may take a few minutes...</span>
                                  </div>)}

                            </div>
                          </div>
                        </Panel>
                        <Panel defaultSize={50} ref={rightPanelRef} collapsible={true}>
                          {processAction == 1 && (
                            <div ref={fileViewResizeRef} className="flex flex-1 h-full">
                              <div className="w-full flex flex-col bg-secondary">
                                <div className="flex flex-row pt-2 pl-4 pr-4 pb-2 ">
                                    <Button auto flat onClick={() => handleOpenFile(fileDuplicatePath)} className={`${filePathValid ? (loading ? "bg-text-secondary" : "bg-accent") : "bg-background"} text-themewhite rounded-3xl h-[30px] pl-4 pr-4`}>
                                      Open
                                    </Button>
                                    <Button className="flex flex-row" variant="ghost" auto flat disableAnimation={true} onClick={() => handleOpenFile(fileDuplicatePath)}>
                                      <span className="text-text-primary font-bold ml-[10px] mt-[0px]">{fileDuplicatePath}</span>
                                    </Button>
                                </div>

                                <div className="flex flex-row">
                                  <PanelGroup direction="horizontal" autoSaveId="example">
                                    <Panel defaultSize={50} minSize={25} onResize={handleCopyNameResize}>
                                      <div className="flex flex-row items-center">
                                        <span className="flex flex-1 text-text-secondary font-bold pt-2 pl-4 pr-4 pb-2">Name</span>
                                      </div>
                                    </Panel>
                                    <PanelResizeHandle />
                                    <Panel defaultSize={15} minSize={20} onResize={handleCopySizeResize}>
                                      <div className="flex flex-row items-center">
                                        <span className="w-[3px] h-[24px] rounded bg-text-secondary"></span>
                                        <span className="flex flex-1 text-text-secondary font-bold pt-2 pl-4 pr-4 pb-2">Size</span>
                                      </div>
                                    </Panel>
                                    <PanelResizeHandle />
                                    <Panel defaultSize={35} minSize={25} onResize={handleCopyModifiedResize}>
                                      <div className="flex flex-row items-center">
                                        <span className="w-[3px] h-[24px] rounded bg-text-secondary"></span>
                                        <span className="flex flex-1 text-text-secondary font-bold pt-2 pl-4 pr-4 pb-2">Modified</span>
                                      </div>
                                    </Panel>
                                  </PanelGroup>
                                </div>

                                {copyFolderContents.length > 0 && (<div className="parent" style={{ height: fileViewHeight - 80 }}>
                                  <div className="scrollview flex-col bg-background">
                                    {copyFolderContents.map(item => (
                                      <RenderFileItem
                                        key={item.absolutePath}
                                        item={item}
                                        fileViewWidth={fileViewWidth}
                                        nameWidth={copyNameWidth}
                                        sizeWidth={copySizeWidth}
                                        modifiedWidth={copyModifiedWidth}
                                        folderContentsImageUrls={folderContentsImageUrls}
                                        reSummarizeLoading={reSummarizeLoading}
                                        reSummarizeLoadingTargetPath={reSummarizeLoadingTargetPath}
                                        truncateName={truncateName}
                                        attemptToggleFolderContentsVisible={(toggleFolderVisible, parentFolderData) => attemptToggleFolderContentsVisible(toggleFolderVisible, parentFolderData, true)}
                                        loadImageBase64={loadImageBase64}
                                        reSummarize={reSummarize}
                                        filePathValid={filePathValid}
                                      />
                                    ))}
                                  </div>
                                </div>) || (<div className="pt-12 bg-background flex-1 items-center justify-center text-center">
                                  {loading && (<div className="flex flex-1 flex-col items-center justify-center text-center text-text-primary">
                                    <Spinner spinnerColor={(theme == 'pink') ? '#bb86fc' : undefined}/>
                                    <span className="mt-2">Organizing files. This may take a few minutes...</span>
                                  </div>) || (<span className="text-text-primary">Your organized files will be duplicated here.</span>)}
                                </div>)}
                              </div>
                            </div>
                          )}
                        </Panel>
                      </PanelGroup>
                    </div>
                  ) : (
                    <div className="flex flex-1 justify-center pt-4 bg-background">
                      <span className="text-text-primary">Select a folder to organize.</span>
                    </div>
                  )}
                </div>
            </Panel>
            <PanelResizeHandle />
            <Panel defaultSize={100 - fixedSizePercentage} minSize={100 - fixedSizePercentage} maxSize={100 - fixedSizePercentage} className="flex flex-1 flex-col pr-4 pl-5 pb-4 pt-2 border-t border-secondary bg-secondary">
              <label className="block font-bold mb-2 text-text-primary">Prompt</label>
              <div className="flex flex-1 flex-row">
                <div className="flex flex-1 flex-row">
                  <div className="flex flex-1">
                    <Input
                      classNames={{ label: "text-black/50", innerWrapper: "prompt-input-wrapper", input: "custom-input", inputWrapper: "input-wrapper" }}
                      placeholder="E.g. Organize by unique people and locations."
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                    />
                  </div>
                  <div className="ml-2">
                    <Button auto flat onClick={handleBatch} 
                      className={`${filePathValid ? (loading ? "bg-text-secondary" : "bg-success") : "bg-background"} text-themewhite pt-2 pb-2 pl-4 pr-4 rounded-3xl h-[40px]`}
                      disabled={loading}
                    >
                      {loading ? "Thinking..." : (copyFolderContents.length > 0 ? "Re-Organize" : "Organize")}
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>
      <OverlayPopup
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        maxTreeDepth={maxTreeDepth}
        setMaxTreeDepth={setMaxTreeDepth}
        processAction={processAction}
        setProcessAction={handleActionChange}
        model={model}
        setModel={setModel}
        groqAPIKey={groqAPIKey}
        setGroqAPIKey={setGroqAPIKey}
        openOnBatchComplete={openOnBatchComplete}
        setOpenOnBatchComplete={setOpenOnBatchComplete}
        setTheme={setTheme}
        theme={theme}
        resetConversations={resetConversations}
      />
      <ErrorPopup
        isOpen={errorPopup}
        onClose={() => {
          setErrorPopup(false)
        }}
        error={errorMessage}
      />
    </div>
  );
};

export default MainScreen;
