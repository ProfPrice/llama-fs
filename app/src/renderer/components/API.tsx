// API.tsx

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
  