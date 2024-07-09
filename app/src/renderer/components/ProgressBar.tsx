import React from 'react';
import llama_light from '../../../assets/llama_fs_transparent_black.png';
import llama_dark from '../../../assets/llama_fs_transparent_white.png';

interface ProgressBarProps {
  progress: string;
  theme: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, theme }) => {
  return (
    <div className="w-full flex flex-col items-center justify-center">
      {theme === 'light' ? (
        <img src={llama_light} alt="Llama Light" className="h-[120px] w-auto mb-4" />
      ) : (
        <img src={llama_dark} alt="Llama Dark" className="h-[120px] w-auto mb-4" />
      )}
      <div className="pl-24 pr-24 pb-2 w-full">
        <div className="w-full bg-secondary rounded-full h-4">
          <div className="bg-success h-4 rounded-full" style={{ width: `${progress}` }}></div>
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
