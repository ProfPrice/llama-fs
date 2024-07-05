import React, { createContext, useContext, useState, useEffect } from 'react';
import { fileURLToPath } from 'url';

const initialFileFormats = [
  "{Y}-{M}-{D}_{CONTENT}.{EXT}",
  "{CONTENT}_{Y}-{M}-{D}.{EXT}"
];

const defaultSettings = {
  model: "llama3",
  fileFormats: initialFileFormats,
  fileFormatIndex: 0,
  groqAPIKey: "",
  instruction: "",
  maxTreeDepth: 3,
  processAction: 1,
  filePath: "",
  filePathValid: false,
  fileDuplicatePath: "",
  openOnBatchComplete: false,
  conversations: [] as Conversation[]
};

type Conversation = {
  folder: string,
  copyFolder: string,
  processAction: number,
  selected: boolean
}

const SettingsContext = createContext({
  ...defaultSettings,
  setModel: (model: string) => {},
  setFileFormatIndex: (index: number) => {},
  addFileFormat: (newFormat: string) => {},
  removeFileFormat: (index: number) => {},
  setGroqAPIKey: (groqAPIKey: string) => {},
  setInstruction: (instruction: string) => {},
  setMaxTreeDepth: (maxTreeDepth: number) => {},
  setProcessAction: (processAction: number) => {},
  setFilePath: (filePath: string) => {},
  setFilePathValid: (filePathValid: boolean) => {},
  setFileDuplicatePath: (fileDuplicatePath: string) => {},
  setOpenOnBatchComplete: (openOnBatchComplete: boolean) => {},
  addConversation: (conversation: Conversation) => {},
  removeConversation: (index: number) => {},
  resetConversations: () => {},
  getConversations: () => [] as Conversation[],
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const savedSettings = JSON.parse(localStorage.getItem('settings')) || defaultSettings;

  const [model, setModel] = useState(savedSettings.model);
  const [fileFormats, setFileFormats] = useState(savedSettings.fileFormats);
  const [fileFormatIndex, setFileFormatIndex] = useState(savedSettings.fileFormatIndex);
  const [groqAPIKey, setGroqAPIKey] = useState(savedSettings.groqAPIKey);
  const [instruction, setInstruction] = useState(savedSettings.instruction);
  const [maxTreeDepth, setMaxTreeDepth] = useState(savedSettings.maxTreeDepth);
  const [processAction, setProcessAction] = useState(savedSettings.processAction);
  const [filePath, setFilePath] = useState(savedSettings.filePath)
  const [fileDuplicatePath, setFileDuplicatePath] = useState(savedSettings.fileDuplicatePath)
  const [filePathValid, setFilePathValid] = useState(savedSettings.filePathValid)
  const [openOnBatchComplete, setOpenOnBatchComplete] = useState(savedSettings.openOnBatchComplete)
  const [conversations, setConversations] = useState<Conversation[]>(savedSettings.conversations);

  const addFileFormat = (newFormat: string) => {
    setFileFormats((prevFormats) => [...prevFormats, newFormat]);
  };

  const removeFileFormat = (index: number) => {
    setFileFormats((prevFormats) => {
      const newFormats = prevFormats.filter((_, i) => i !== index);
      if (fileFormatIndex >= newFormats.length) {
        setFileFormatIndex(newFormats.length - 1);
      }
      return newFormats;
    });
  };

  const addConversation = (conversation: Conversation) => {
    setConversations((prevConversations) => [...prevConversations, conversation]);
  };

  const removeConversation = (index: number) => {
    setConversations((prevConversations) => {
      return prevConversations.filter((_, i) => i !== index);
    });
  };

  const resetConversations = () => {
    setConversations([]);
  };

  const getConversations = () => {
    return conversations;
  };

  useEffect(() => {
    const newSettings = {
      model,
      fileFormats,
      fileFormatIndex,
      groqAPIKey,
      instruction,
      maxTreeDepth,
      processAction,
      filePath,
      filePathValid,
      fileDuplicatePath,
      openOnBatchComplete,
      conversations
    };
    localStorage.setItem('settings', JSON.stringify(newSettings));
  }, [filePath, model, fileFormats, fileFormatIndex, groqAPIKey, instruction, maxTreeDepth, processAction, filePathValid, fileDuplicatePath, openOnBatchComplete, conversations]);

  return (
    <SettingsContext.Provider value={{
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
      resetConversations,
      getConversations
    }}>
      {children}
    </SettingsContext.Provider>
  );
};
