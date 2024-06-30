// API.tsx

export const fetchSingleDocumentSummary = async (body: any) => {
  console.log('body:',body)
  const response = await fetch("http://localhost:11433/summarize-document", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return await response.json();
};

export const fetchBatch = async (body: any) => {
    const response = await fetch("http://localhost:11433/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return await response.json();
  };
  
export const fetchFolderContents = async (path: string) => {
    const response = await fetch("http://localhost:11433/get-folder-contents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
    });
    return await response.json();
};
  