// API.tsx
import { API } from '../../../globals' 

export const fetchSingleDocumentSummary = async (body: any) => {
  console.log('body:',body)
  const response = await fetch(`${API}/summarize-document`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const content = await response.json()
  console.log('response:',content)
  return content;
};

  
export const fetchFolderContents = async (path: string) => {
    const response = await fetch(`${API}/get-folder-contents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
    });
    const content = await response.json()
    console.log('fetchFolderContents:',content)
    return content;
};
  