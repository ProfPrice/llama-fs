// OverlayPopup.tsx
import React, { useEffect, useRef } from 'react';
import { Button, Input } from "@nextui-org/react";
import CustomCheckbox from '../CustomCheckbox';
import Select from 'react-select';

interface OverlayPopupProps {
  isOpen: boolean;
  onClose: () => void;
  maxTreeDepth: number;
  setMaxTreeDepth: (depth: number) => void;
  processAction: number;
  setProcessAction: (action: number) => void;
  model: string;
  setModel: (model: string) => void;
  groqAPIKey: string;
  setGroqAPIKey: (key: string) => void;
  openOnBatchComplete: boolean;
  setOpenOnBatchComplete: (openOnBatchComplete: boolean) => void;
  theme: string,
  setTheme: (theme: string) => void;
}

const OverlayPopup: React.FC<OverlayPopupProps> = ({
  isOpen, onClose, maxTreeDepth, setMaxTreeDepth,
  processAction, setProcessAction, model, setModel, groqAPIKey, setGroqAPIKey,
  openOnBatchComplete, setOpenOnBatchComplete, theme, setTheme
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const options = [
    { value: 'llama3', label: 'llama3' },
    { value: 'groq', label: 'groq' }
  ]

  const themeOptions = [
    { value: 'dark', label:'Dark' },
    { value: 'light', label:'Light' },
    { value: 'pink', label:'Cute' }
  ]

  if (!isOpen) return null;

  return (
    <div className="overlay">
      <div className="overlay-content bg-secondary flex flex-col w-[400px] justify-center" ref={overlayRef}>

        <div className="flex flex-row justify-between">
          <span className="text-text-primary font-bold text-2xl">Settings</span>
          <Button onClick={onClose} className="rounded-3xl bg-text-secondary pt-1 pb-1 pr-4 pl-4 text-white">Close</Button>
        </div>

        <div className="mt-4 flex flex-col flex-1">
          <label className="font-bold text-text-primary">Max Tree Depth</label>
          <div className="flex flex-row flex-1">
            <Button auto flat onClick={() => setMaxTreeDepth(maxTreeDepth - 1)} disableAnimation={true} disabled={maxTreeDepth <= 0} className="text-text-primary font-bold text-2xl">-</Button>
            <Input
                    className="ml-2 mr-2 text-center text-text-primary"
                    classNames={{ label: "text-black/50", innerWrapper: "maxtreedepth-input-wrapper", input: "custom-input" }}
                    readOnly
                    value={maxTreeDepth.toString()}
            />
            <Button auto flat onClick={() => setMaxTreeDepth(maxTreeDepth + 1)} disableAnimation={true} disabled={maxTreeDepth >= 10} className="text-text-primary font-bold text-2xl">+</Button>
          </div>
        </div>

        <div className="mt-4">
          <label className="font-bold text-text-primary">Action</label>
          <CustomCheckbox isSelected={processAction === 1} onChange={() => setProcessAction(1)} label="Duplicate" />
          <CustomCheckbox isSelected={processAction === 0} onChange={() => setProcessAction(0)} label="Move" />
        </div>

        <div className="mt-4">
          <label className="font-bold text-text-primary">File Explorer</label>
          <CustomCheckbox isSelected={openOnBatchComplete} onChange={() => setOpenOnBatchComplete(!openOnBatchComplete)} label="Open Windows File Explorer After Organizing" />
        </div>

        <div className="mt-4">
          <label className="font-bold text-text-primary">Model</label>
          <Select
            value={options.find(option => option.value === model)}
            onChange={(selectedOption) => setModel(selectedOption?.value || '')}
            options={options}
          />
        </div>

        <div className="mt-4">
          <label className="font-bold text-text-primary">Theme</label>
          <Select
            value={themeOptions.find(option => option.value === theme)}
            onChange={(selectedOption) => setTheme(selectedOption?.value || '')}
            options={themeOptions}
          />
        </div>

        {model === 'groq' && (
          <div className="mt-4">
            <label className="font-bold text-text-primary">Groq API Key</label>
            <Input 
              value={groqAPIKey} 
              onChange={(e) => setGroqAPIKey(e.target.value)} 
              className="text-text-primary" 
              classNames={{ label: "text-black/50", innerWrapper: "maxtreedepth-input-wrapper", input: "custom-input" }}
              
            />
          </div>
        )}

        <div className="flex flex-1 text-center items-center justify-center">
          <span className="text-text-secondary mt-6">All changes are saved automatically.</span>
        </div>
      </div>
    </div>
  );
};

export default OverlayPopup;
