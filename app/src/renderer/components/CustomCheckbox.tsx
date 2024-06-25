import React from 'react';
import CheckIcon from './Icons/CheckIcon';
import { cn } from '@nextui-org/react';

interface CustomCheckboxProps {
  isSelected: boolean;
  onChange: () => void;
  label: string;
}

const CustomCheckbox: React.FC<CustomCheckboxProps> = ({ isSelected, onChange, label }) => {
  return (
    <div className="flex items-center cursor-pointer" onClick={onChange}>
      <div className="bg-themewhite w-5 h-5 flex items-center justify-center mr-2 rounded">
        {isSelected && <CheckIcon className="text-themeblack" />}
      </div>
      <span className="text-text-primary">{label}</span>
    </div>
  );
};

export default CustomCheckbox;
