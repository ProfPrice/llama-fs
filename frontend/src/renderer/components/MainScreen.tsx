import { Button } from "@nextui-org/button";
import { Input } from "@nextui-org/input";
import { Checkbox, Select} from '@nextui-org/react';
import { useState } from "react";
import FolderIcon from "./Icons/FolderIcon";
import PlusIcon from "./Icons/PlusIcon";
import CheckIcon from "./Icons/CheckIcon";
import SettingsIcon from "./Icons/SettingsIcon";
import ollamaWave from "../../../assets/ollama_wave.gif";
import { useTheme } from "./ThemeContext";
import { useSettings } from "./SettingsContext";
import ThemeBasedLogo from "./ThemeBasedLogo";
import { supportedFileTypes, FileData, AcceptedState, preorderTraversal, buildTree} from "./Utils" 


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
    processAction, setProcessAction
  } = useSettings();

  // Per-session variables.
  const [filePath, setFilePath] = useState<string>(""); // TODO: Implement routing this variable from context menu.
  const [filePathValid, setFilePathValid] = useState<boolean>(true) // TODO: Set filePathValid if the path exists every time its updated and on routing load.
  
  // Variable indicating waiting for LLM computation.
  const [loading, setLoading] = useState<boolean>(false);

  // Variables for exploring generated content.
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const handleFileSelect = (fileData: FileData) => {
    setSelectedFile(fileData);
  };

  // Variables for holding the results of LLM computation.
  const [newOldMap, setNewOldMap] = useState([]);
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

    const data = await response.json();
    setNewOldMap(data);

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
    const returnedObj: { base_path: string; src_path: any; dst_path: any }[] =
      [];
    preOrderedFiles.forEach((file) => {
      const isAccepted = acceptedState[file.fullfilename];
      if (isAccepted) {
        const noRootFileName = file.fullfilename.replace("/root/", "");
        if (newOldMap.some((change) => change.dst_path === noRootFileName)) {
          const acceptedChangeMap = newOldMap.find(
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
    setNewOldMap([]);
    setPreOrderedFiles([]);
    setAcceptedState([]);
  };

  const openSettings = () => {}

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

  const { dialog } = window.require('electron').remote;

  const handleBrowseFolder = async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const newFilePath = result.filePaths[0];
      setFilePath(newFilePath);
      validateAndFetchFolderContents(newFilePath, 0);
    }
  };

  const [folderContents, setFolderContents] = useState([]);

  const validateAndFetchFolderContents = async (path, depth) => {
    const fs = window.require('fs');
    fs.stat(path, (err, stats) => {
      if (err) {
        console.error("Error reading directory:", err);
        return;
      }
      if (stats.isDirectory()) {
        fs.readdir(path, { withFileTypes: true }, (err, files) => {
          if (err) {
            console.error("Error reading directory:", err);
            return;
          }
          const fileDetails = files.map(file => ({
            name: file.name,
            isDirectory: file.isDirectory(),
            size: file.size, // Size needs to be fetched separately if required
            modified: new Date().toLocaleString(), // Placeholder for last modified
            folderContents: [],
            folderContentsDisplayed: false,
            depth: depth
          }));
          setFolderContents(prev => updateFolderContents(prev, path, fileDetails));
        });
      }
    });
  };

  const updateFolderContents = (contents, basePath, newContents) => {
    const updateRecursive = (items, currentPath) => {
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
  

  // Function to render each file and folder
  const renderFileItem = (item) => {
    const indentStyle = { paddingLeft: `${item.depth * 20}px` };
    return (
      <div key={item.name + item.depth}>
        <div className="flex items-center" style={indentStyle} onClick={() => {
          if (item.isDirectory) {
            validateAndFetchFolderContents(`${filePath}/${item.name}`, item.depth + 1);
          }
        }}>
          <span className="mr-2">{item.isDirectory ? <FolderIcon /> : <FileIcon />}</span>
          <span className="flex-1">{item.name}</span>
          <span className="mr-2">{item.size}</span>
          <span>{item.modified}</span>
        </div>
        {item.folderContentsDisplayed && item.folderContents.map(subItem => renderFileItem(subItem))}
      </div>
    );
  };

  return (
    <div className="bg-background flex h-screen w-full">
      <div className="flex-1 flex flex-col">
        {/* SideMenu Start */}
        <div className="p-2 flex justify-between flex-col bg-primary">
          {/* Logo Section Start */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <ThemeBasedLogo />
              <span className="text-text-primary font-bold">LlamaFS</span>
            </div>
          </div>
          {/* Logo Section End */}

          {/* Quick Settings Start */}
          <div className="">

            {/* Filenames Dropdown Start */}
            <div className="mb-4">
              <label className="block font-bold mb-1">Filenames</label>
              <Select
                bordered
                fullWidth
                value={fileFormatIndex.toString()}
                onChange={(e) => setFileFormatIndex(parseInt(e.target.value))}
              >
                {fileFormats.map((format, index) => (
                  <option key={index} value={index}>
                    {format}
                  </option>
                ))}
              </Select>
            </div>
            {/* Filenames Dropdown End */}

            {/* Max Tree Depth Plus/Minus Scale Start */}
            <div className="mb-4 flex items-center">
              <label className="font-bold mr-2">Max Tree Depth</label>
              <Button auto flat onClick={() => adjustMaxTreeDepth(-1)} disabled={maxTreeDepth <= 0}>-</Button>
              <Input
                className="mx-2"
                readOnly
                value={maxTreeDepth.toString()}
                width="50px"
              />
              <Button auto flat onClick={() => adjustMaxTreeDepth(1)} disabled={maxTreeDepth >= 10}>+</Button>
            </div>
            {/* Max Tree Depth Plus/Minus Scale End */}

            {/* Move/Duplicate Checkboxes Start */}
            <div className="mb-4 flex items-center">
              <label className="font-bold mr-2">Action</label>
              <Checkbox
                checked={processAction === 0}
                onChange={() => handleActionChange(0)}
                className="mr-2"
              >
                Move
              </Checkbox>
              <Checkbox
                checked={processAction === 1}
                onChange={() => handleActionChange(1)}
              >
                Duplicate
              </Checkbox>
            </div>
            {/* Move/Duplicate Checkboxes End */}

          </div>
          {/* Quick Settings End */}
          
          {/* Settings Button Start */}
          <div className="border-t border-secondary pt-2">
            <Button variant="ghost" onClick={() => openSettings()}>
              <SettingsIcon className="h-11 w-10 text-text-primary mt-2" />
            </Button>
          </div>
          {/* Settings Button End */}
        </div>
        {/* SideMenu End */}

        {/* Workspace Start */}
        <div className="flex-1 flex flex-col">
          {/* File Windows Start */}
          {loading && (<div className="flex flex-col items-center">
            <h2 className="text-lg text-text-primary font-semibold mb-2">
              Reading and classifying your files...
            </h2>
            <div className="flex justify-center" style={{ width: "50%" }}>
              <img
                src={ollamaWave}
                alt="Loading..."
                style={{ width: "100%" }}
              />
            </div>
          </div>) || 
          (<div className="flex-1 flex flex-row">
            {/* Target Start */}
            <div className="flex-1 flex">
              {/* Folder Select Start */}
              <div className="flex flex-1 flex-row h-10">
                <Input
                  className="w-max rounded-lg flex flex-1 h-10"
                  placeholder="Select folder to organize"
                  type="text"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  onBlur={() => validateAndFetchFolderContents(filePath)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    height: "40px"
                  }}
                />
                <Button className="" onClick={handleBrowseFolder}>Browse</Button>
              </div>
              {/* Folder Select End */}

              {filePathValid && (<div>
                {/* Folder Categories Start */}
                <div className="flex h-10">
                  <span className="mr-2 text-text-primary font-bold">Name</span>
                  <span className="flex-1 text-text-primary font-bold">Size</span>
                  <span className="text-text-primary font-bold">Modified</span>
                </div>
                {/* Folder Categories End */}

                {/* File Section Start */}
                <div className="flex flex-1 flex-col overflow-auto">
                  {folderContents.map(item => renderFileItem(item))}
                </div>
                {/* File Section End */}
              </div>) || (<div className="flex flex-1 justify-center">
                  <span className="text-text-primary">
                    Select a valid folder to organize with Browse.
                  </span>
              </div>)}
            </div>
            {/* Target End */}

            {/* Results Start */}
            <div className="flex-1 flex">
            </div>
            {/* Results End */}
          </div>)}
          {/* File Windows End */}

          {/* Instruction Area Start */}
          <div className="">
            {/* Prompt Start */}
            <div className="">
            </div>
            {/* Prompt End */}

            {/* Submit Button Start */}
            <div className="">
            </div>
            {/* Submit Button End */}
          </div>
          {/* Instruction Area End */}
        </div>
        {/* Workspace End */}
      </div>
    </div>
  );
}

export default MainScreen;
