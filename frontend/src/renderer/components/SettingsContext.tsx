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
  processAction: 0
};

const SettingsContext = createContext({
  ...defaultSettings,
  setModel: (model: string) => {},
  setFileFormatIndex: (index: number) => {},
  addFileFormat: (newFormat: string) => {},
  removeFileFormat: (index: number) => {},
  setGroqAPIKey: (groqAPIKey: string) => {},
  setInstruction: (instruction: string) => {},
  setMaxTreeDepth: (maxTreeDepth: number) => {},
  setProcessAction: (processAction: number) => {}
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

  useEffect(() => {
    console.log('here!!!')
    const newSettings = {
      model,
      fileFormats,
      fileFormatIndex,
      groqAPIKey,
      instruction,
      maxTreeDepth,
      processAction
    };
    localStorage.setItem('settings', JSON.stringify(newSettings));
    console.log('synced settings:',newSettings)
  }, [model, fileFormats, fileFormatIndex, groqAPIKey, instruction, maxTreeDepth, processAction]);

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
      processAction, setProcessAction
    }}>
      {children}
    </SettingsContext.Provider>
  );
};
