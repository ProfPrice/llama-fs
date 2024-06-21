import { Button } from "@nextui-org/button";
import { Input } from "@nextui-org/input";
import { useState } from "react";
import FolderIcon from "./Icons/FolderIcon";
import PlusIcon from "./Icons/PlusIcon";
import CheckIcon from "./Icons/CheckIcon";
import FileLine from "./FileLine";
import FileDetails from "./FileDetails";
import SettingsIcon from "./Icons/SettingsIcon";
import ollamaWave from "../../../assets/ollama_wave.gif";
import { useTheme } from "./ThemeContext";
import { useSettings } from "./SettingsContext";
import ThemeBasedLogo from "./ThemeBasedLogo";
import { supportedFileTypes, FileData, AcceptedState, preorderTraversal, buildTree} from "./Utils" 

function MainScreen() {

  const { theme, setTheme } = useTheme();
  const {
    model, setModel,
    fileFormats,
    fileFormatIndex, setFileFormatIndex,
    addFileFormat,
    removeFileFormat,
    groqAPIKey, setGroqAPIKey,
    instruction, setInstruction,
    maxTreeDepth, setMaxTreeDepth
  } = useSettings();

  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [filePath, setFilePath] = useState<string>(""); // TODO: Implement routing this variable from context menu.
  const [filePathValid, setFilePathValid] = useState<boolean>(true) // TODO: Set filePathValid if the path exists every time its updated and on routing load.
  const [loading, setLoading] = useState<boolean>(false);

  const handleFileSelect = (fileData: FileData) => {
    setSelectedFile(fileData);
  };

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

  // Add the className 'dark' to main div to enable dark mode
  return (
    <div className="bg-background flex h-screen w-full">
      <div className="flex-1 flex flex-col">
        <div className="p-2 flex justify-between flex-row bg-primary">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <ThemeBasedLogo />
              <span className="text-text-primary font-bold">LlamaFS</span>
            </div>
          </div>
          {false && (<div>
            <Button variant="ghost" onClick={() => openSettings()}>
              <SettingsIcon className="h-11 w-10 text-text-primary mt-2" />
            </Button>
          </div>)}
        </div>
        <div className="flex-1 flex">
          <div
            className={selectedFile != null ? "w-1/2 overflow-auto space-y-2 border-r border-secondary" : 
              "flex flex-1 justify-center overflow-autoborder-r border-secondary "}
          >
            {loading ? (
              // Existing loading block
              <div className="flex flex-col items-center">
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
              </div>
            ) : preOrderedFiles.length === 0 ? (
              <div
                className="flex-1 flex flex-col"
                style={{ height: "100%" }}
              >
                <div className="needsToOpenBrowse flex flex-1 flex-row h-10">
                  <Input
                    className="w-max rounded-lg flex flex-1 h-10"
                    placeholder="Select folder to organize"
                    type="text"
                    onChange={(e) => setFilePath(e.target.value)}
                    defaultValue={filePath}
                    style={{
                      width: "100%",
                      padding: "10px",
                      height: "40px"
                    }}
                  />
                  <div className="">
                    {filePathValid && (<div className="flex-center flex bg-background justify-center align-center h-10 w-10 border">
                      <CheckIcon className="text-success mt-2" />
                    </div>)
                    || (<div className="flex-center flex bg-accent justify-center align-center h-10 w-10 border" >
                      <PlusIcon className="text-text-primary mt-2" />
                    </div>)}
                  </div>
                </div>
                {false && (<div>
                  <p className="text-center mt-2 text-text-primary text-sm ">Supported file types:</p>
                  <span className="list-disc text-center text-text-primary text-sm ">
                    {supportedFileTypes.map((type, index) => {
                      const suffix = (index+1 == supportedFileTypes.length) ? "" : ", "
                      return (<span key={index}>{type}{suffix}</span>)
                    })}
                  </span>
                </div>)}
              </div>
            ) : (
              // Existing file details block
              <FileDetails fileData={selectedFile} />
            )}
            {preOrderedFiles.map((file) => (
              <div onClick={() => handleFileSelect(file)}>
                <FileLine
                  key={file.fullfilename}
                  filename={file.filename}
                  indentation={file.depth}
                  fullfilename={file.fullfilename}
                  acceptedState={acceptedState}
                  setAcceptedState={setAcceptedState}
                />
              </div>
            ))}
          </div>
          {selectedFile != null && (<div className="w-1/2 overflow-auto p-4">
            <FileDetails fileData={selectedFile} />
            {/* Container for explaining the data in the file line that's selected */}
            {/* This container will be populated with content dynamically based on the selected FileLine */}
          </div>)}
        </div>
      </div>
    </div>
  );
}

export default MainScreen;
