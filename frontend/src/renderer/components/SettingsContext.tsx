import React, { createContext, useContext, useState, useEffect } from 'react';

const initialFileFormats = [
  "{YEAR}-{MONTH}-{DAY}_{CONTENT}.{EXTENSION}",
  "{CONTENT}_{YEAR}-{MONTH}-{DAY}_v{VERSION}.{EXTENSION}",
  "{TYPE}_{YEAR}-{MONTH}-{DAY}_{CONTENT}.{EXTENSION}",
  "{CATEGORY}_{DATE}_{ID}.{EXTENSION}"
];

const SettingsContext = createContext({
  model: "llama3",
  setModel: (model: string) => {},
  fileFormats: initialFileFormats,
  fileFormatIndex: 0,
  setFileFormatIndex: (index: number) => {},
  addFileFormat: (newFormat: string) => {},
  removeFileFormat: (index: number) => {},
  groqAPIKey: "",
  setGroqAPIKey: (groqAPIKey: string) => {},
  instruction: "",
  setInstruction: (instruction: string) => {},
  maxTreeDepth: 3,
  setMaxTreeDepth: (maxTreeDepth: number) => {},
  processAction: 0,
  setProcessAction: (maxTreeDepth: number) => {}
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [model, setModel] = useState('llama3');
  const [fileFormats, setFileFormats] = useState(initialFileFormats);
  const [fileFormatIndex, setFileFormatIndex] = useState(0);
  const [groqAPIKey, setGroqAPIKey] = useState("");
  const [instruction, setInstruction] = useState("");
  const [maxTreeDepth, setMaxTreeDepth] = useState(3);
  const [processAction, setProcessAction] = useState(0);

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
    localStorage.setItem('settings', JSON.stringify({
      model,
      fileFormats,
      fileFormatIndex,
      groqAPIKey,
      instruction,
      maxTreeDepth,
      processAction
    }));
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
