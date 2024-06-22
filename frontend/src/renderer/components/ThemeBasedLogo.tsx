import llamaFsLogo from '../../../assets/llama_fs.png'
import llamaFsLogoDark from '../../../assets/llama_fs_dark.png'
import llamaFsLogoPink from '../../../assets/llama_fs_pink.png'
import { useTheme } from './ThemeContext';

function ThemeBasedLogo() {
    const { theme } = useTheme();  // Use theme from your ThemeContext
  
    // Mapping of theme names to logo imports
    const logos: { [key: string]: string } = {
        dark: llamaFsLogoDark,
        light: llamaFsLogo,
        pink: llamaFsLogoPink
    };
  
    // Get the current logo based on the theme, default to 'light' if not found
    const currentLogo = logos[theme] || logos.light;
  
    return (
      <img src={currentLogo} alt="Llama FS Logo" style={{ width: '61px' }} />
    );
};

export default ThemeBasedLogo