!include "MUI2.nsh"

Name "LlamaFS"
OutFile "LlamaFS.exe"
InstallDir "$PROGRAMFILES\LlamaFS"
RequestExecutionLevel admin
SetOutPath "$INSTDIR"

!define OLLAMA_SETUP "app\resources\ollama\OllamaSetup.exe"

!insertmacro MUI_LANGUAGE "English"

Section "MainSection" SEC01
  SetOutPath $INSTDIR
  File /r "app\dist\*"
  File /r "app\resources\*"

  ; Run OllamaSetup to ensure Ollama is installed locally.
  ExecWait '"$INSTDIR\${OLLAMA_SETUP}" /S' 

  ; Register llama3 and moondream with local ollama installation.
  ExecWait '"ollama create llama3 -f "$INSTDIR\app\resources\llama3\Modelfile""'
  ExecWait '"ollama create moondream -f "$INSTDIR\app\resources\moondream\Modelfile""'

  ; Associate program in Windows Registry.
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\YourAppName" "DisplayName" "LlamaFS"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\YourAppName" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\YourAppName" "InstallLocation" "$INSTDIR"

  ; Add context menu entry in Windows Registry.
  WriteRegStr HKCR "Directory\shell\LlamaFS" "" "Organize with LlamaFS"
  WriteRegStr HKCR "Directory\shell\LlamaFS\command" "" "\"$INSTDIR\LlamaFS.exe\" --folderPath=\"%1\""

  ; Make uninstaller available.
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LlamaFS"
  DeleteRegKey HKCR "Directory\shell\LlamaFS"

  RMDir /r "$INSTDIR"
SectionEnd
