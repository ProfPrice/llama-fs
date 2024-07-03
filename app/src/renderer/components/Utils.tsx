// Utils.tsx
import { motion } from 'framer-motion';

// Exporting constants
export const supportedFileTypes = [".pdf", ".txt", ".png", ".jpg", ".jpeg"];

// Exporting types
export type FileData = {
  filename: string;
  fullfilename: string;
  depth: number;
  summary?: string;
  src_path?: string;
};

export const Spinner = ({dim}) => (
  <motion.div
    animate={{ rotate: 360 }}
    transition={{ repeat: Infinity, duration: 1 }}
    style={{
      width: (dim != undefined) ? dim : 50,
      height: (dim != undefined) ? dim : 50,
      border: '5px solid #949494',
      borderTop: '5px solid #e3e3e3',
      borderRadius: '50%',
    }}
  />
);

export const truncateName = (name, maxWidth) => {
  const ellipsis = '...';
  let truncatedName = name;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = 'bold 16px Arial';

  while (context.measureText(truncatedName).width > maxWidth) {
    if (truncatedName.length <= 1) {
      break;
    }
    truncatedName = truncatedName.substring(0, truncatedName.length - 1);
  }
  if (context.measureText(name).width > maxWidth) {
    truncatedName += ellipsis;
  }
  return truncatedName;
};

export type AcceptedState = { [key: string]: boolean };

// Exporting functions
export function preorderTraversal(
  node: { name: string; children?: any[]; summary?: string; src_path?: string },
  prevfilename: string,
  depth: number,
  result: FileData[] = []
): FileData[] {
  result.push({
    filename: node.name,
    fullfilename: `${prevfilename}/${node.name}`,
    depth,
    summary: node.summary,
    src_path: node.src_path,
  });

  if (node.children) {
    node.children.forEach((child) => {
      preorderTraversal(child, `${prevfilename}/${node.name}`, depth + 1, result);
    });
  }

  return result;
}

export function buildTree(
  paths: { src_path: string; dst_path: string; summary?: string }[]
): { name: string; children: any[] } {
  const root = { name: "root", children: [] };

  paths.forEach(({ src_path, dst_path, summary }) => {
    const parts = dst_path.split("/");
    let currentLevel = root.children;

    parts.forEach((part, index) => {
      let existingPath = currentLevel.find((p) => p.name === part);

      if (!existingPath) {
        if (index === parts.length - 1) {
          existingPath = { name: part, summary: summary, src_path: src_path };
        } else {
          existingPath = { name: part, children: [] };
        }
        currentLevel.push(existingPath);
      }

      if (existingPath.children) {
        currentLevel = existingPath.children;
      }
    });
  });

  return root;
}
