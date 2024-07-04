import { Button } from "@nextui-org/react";
import ChevronDown from "../Icons/ChevronDown";
import ChevronRight from "../Icons/ChevronRight";
import FolderIcon from "../Icons/FolderIcon";
import FileIcon from "../Icons/FileIcon";
import { useTheme } from "../ThemeContext";
import { motion } from "framer-motion";
import React from "react";
import { useState, useEffect, useRef } from "react";

const RenderFileItem = ({
  item,
  fileViewWidth,
  nameWidth,
  sizeWidth,
  modifiedWidth,
  folderContentsImageUrls,
  reSummarizeLoading,
  reSummarizeLoadingTargetPath,
  truncateName,
  attemptToggleFolderContentsVisible,
  loadImageBase64,
  reSummarize,
  filePathValid
}) => {
  const { theme } = useTheme();
  const computedPadding = (item.depth == 0) ? '0px' : `${25}px`;

  const indentStyle = { paddingLeft: `${computedPadding}` };
  const maxNameWidth = (nameWidth / 100) * fileViewWidth;

  // Function to check if the file has an image extension
  const isImageFile = (filePath) => {
    const imageExtensions = [".jpg", ".jpeg", ".png"];
    return imageExtensions.some((extension) =>
      filePath.toLowerCase().endsWith(extension)
    );
  };

  return (
    <div key={item.absolutePath}>
      <div key={item.name + item.depth} className="flex flex-col pb-2" style={indentStyle}>
        <Button variant="ghost" disableRipple={true} disableAnimation={true} onClick={() => attemptToggleFolderContentsVisible(true, item)}>
          <div className="flex flex-row flex-1">
            <div style={{ width: `${maxNameWidth - 25 * item.depth}px` }} className="flex flex-row items-center">
              <div className="flex flex-row flex-1">
                <div className="">
                  {item.folderContentsDisplayed ? (
                    <ChevronDown color={(theme == "dark" || theme == "pink") ? "#e3e3e3" : "#121212"} />
                  ) : (
                    <ChevronRight color={(theme == "dark" || theme == "pink") ? "#e3e3e3" : "#121212"} />
                  )}
                </div>
                <span className="mr-2">
                  {item.isDirectory ? (
                    <FolderIcon color={"#E8B130"} />
                  ) : (
                    <FileIcon color={(theme == "dark" || theme == "pink") ? "#e3e3e3" : "#121212"} />
                  )}
                </span>
                <span className={item.isDirectory ? "flex flex-1 text-text-primary font-bold text-sm" : "flex flex-1 text-text-primary font-bold text-sm"}>
                  {truncateName(item.name, maxNameWidth - (120 + 25 * item.depth))}
                </span>
              </div>
            </div>
            <div style={{ width: `${(sizeWidth / 100) * fileViewWidth}px` }} className="flex flex-row items-center">
              <span className={item.isDirectory ? "flex flex-1 text-text-primary font-bold text-sm" : "flex flex-1 text-text-primary font-bold text-sm"}>{item.size}</span>
            </div>
            <div style={{ width: `${(modifiedWidth / 100) * fileViewWidth - 50}px` }} className="flex flex-row items-center">
              <span className={item.isDirectory ? "flex flex-1 text-text-primary font-bold text-sm" : "flex flex-1 text-text-primary font-bold text-sm"}>{item.modified}</span>
            </div>
          </div>
        </Button>
        {item.folderContentsDisplayed && (
          <div>
            {item.isDirectory ? (
              <div className="flex justify-start items-start mt-[5px]">
                {item.folderContents.length > 0 ? (
                  <div>
                    {item.folderContents.map((subItem) => (
                      <RenderFileItem
                        key={subItem.absolutePath}
                        item={subItem}
                        fileViewWidth={fileViewWidth}
                        nameWidth={nameWidth}
                        sizeWidth={sizeWidth}
                        modifiedWidth={modifiedWidth}
                        folderContentsImageUrls={folderContentsImageUrls}
                        reSummarizeLoading={reSummarizeLoading}
                        reSummarizeLoadingTargetPath={reSummarizeLoadingTargetPath}
                        truncateName={truncateName}
                        attemptToggleFolderContentsVisible={attemptToggleFolderContentsVisible}
                        loadImageBase64={loadImageBase64}
                        reSummarize={reSummarize}
                        filePathValid={filePathValid}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-row items-center ml-[25px] mt-[5px]">
                    <ChevronRight color={theme == "dark" ? "#e3e3e3" : "#121212"} />
                    <span className="text-text-primary">Folder Empty</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col bg-secondary mt-2 bg-secondary rounded-3xl pb-2 mb-2">
                <Button variant="ghost" disableRipple={true} disableAnimation={true} onClick={() => attemptToggleFolderContentsVisible(true, item)}>
                    <span className=" flex flex-1 text-text-primary pl-4 pr-4 pt-2 pb-2 bg-primary rounded-tl-3xl rounded-tr-3xl">{truncateName(item.name, maxNameWidth * 2)}</span>
                </Button>
                <div className="flex flex-row items-center">
                  <div className="mt-4 mb-2 ml-4 rounded-3xl overflow-hidden" style={{ width: maxNameWidth / 2 }}>
                    {(!item.isDirectory && isImageFile(item.absolutePath)) && <img src={folderContentsImageUrls[item.absolutePath]} alt={item.name} />}
                  </div>
                  {reSummarizeLoading && reSummarizeLoadingTargetPath == item.absolutePath ? (
                    <div className="flex flex-1 flex-col p-4 items-center justify-center w-full">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        style={{ width: 50, height: 50, border: "5px solid #949494", borderTop: "5px solid #e3e3e3", borderRadius: "50%" }}
                      />
                      <span className="text-text-primary mt-1">Summarizing...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col flex-1 p-4 items-center justify-center">
                      <div className="pl-2 pr-4 items-center justify-center text-center">
                        {item.summary.length > 0 ? (
                          <span className="text-text-primary mb-1 text-center">"{item.summary}"</span>
                        ) : (
                          <span className="text-text-primary mb-1 text-center">No summary yet.</span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex-row flex" style={{ marginTop: "10px" }}>
                          <Button
                            auto
                            flat
                            disableAnimation={true}
                            onClick={() => reSummarize(item.absolutePath, item)}
                            className={`${filePathValid ? "bg-success" : "bg-background"} text-themewhite pt-2 pb-2 pl-4 pr-4 rounded-3xl h-[40px] ml-2`}
                            fullWidth={true}
                          >
                            {item.summary.length == 0 ? "Summarize Single File" : "Re-Summarize"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RenderFileItem;
