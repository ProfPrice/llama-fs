// ErrorPopup.tsx
import React, { useEffect, useRef } from 'react';
import { Button } from "@nextui-org/react";

interface ErrorPopupProps {
  isOpen: boolean;
  onClose: () => void;
  error: string;
}

const ErrorPopup: React.FC<ErrorPopupProps> = ({
  isOpen, onClose, error
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

  if (!isOpen) return null;

  return (
    <div className="overlay">
      <div className="overlay-content bg-secondary flex flex-col w-[400px] justify-center" ref={overlayRef}>

        <div className="flex flex-row justify-between">
          <span className="text-text-primary font-bold text-2xl">Llama Error</span>
          <Button onClick={onClose} className="rounded-3xl bg-text-secondary pt-1 pb-1 pr-4 pl-4 text-white">Close</Button>
        </div>


        <div className="flex flex-row justify-between rounded-3xl bg-error p-2 mt-6 text-center items-center justify-center">
          <span className="text-text-primary text-center flex flex-1">{error}</span>
        </div>

        <div className="flex flex-1 text-center items-center justify-center">
          <span className="text-text-secondary mt-6">If issues persist, try restarting Llama-FS.</span>
        </div>
      </div>
    </div>
  );
};

export default ErrorPopup;
