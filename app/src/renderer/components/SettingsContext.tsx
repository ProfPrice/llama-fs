import React, { createContext, useContext, useState, useEffect } from 'react';

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
  conversations: []
};

type Conversation = {
  folder: string,
  copyFolder: string,
  processAction: number,
  selected: boolean,
  date: string
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
  toggleConversationSelected: (index: number) => {},
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
    setConversations((prevConversations) => 
      [{ ...conversation, selected: true, date: new Date().toISOString() }, ...prevConversations.map(conv => ({ ...conv, selected: false }))]
    );
  };

  const removeConversation = (index: number) => {
    setConversations((prevConversations) => {
      return prevConversations.filter((_, i) => i !== index);
    });
  };

  const resetConversations = () => {
    setConversations([]);
  };

  const toggleConversationSelected = (index: number) => {
    setConversations((prevConversations) => 
      prevConversations.map((conversation, i) => 
        i === index ? { ...conversation, selected: !conversation.selected } : { ...conversation, selected: false }
      )
    );
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
    console.log('newSettings:',newSettings)
    localStorage.setItem('settings', JSON.stringify(newSettings));
  }, [conversations, filePath, model, fileFormats, fileFormatIndex, groqAPIKey, instruction, maxTreeDepth, processAction, filePathValid, fileDuplicatePath, openOnBatchComplete, conversations]);

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
      conversations,
      toggleConversationSelected
    }}>
      {children}
    </SettingsContext.Provider>
  );
};
