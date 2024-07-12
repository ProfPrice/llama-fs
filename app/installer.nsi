!include "MUI2.nsh"

!define mui.Header.Text "Welcome to the LlamaFS Installer"

!macro customInstall
  ; Ensure Ollama is installed locally
  SetOutPath "$INSTDIR"
  ExecWait '"$INSTDIR\\OllamaSetup.exe" /S'

  ; Register llama3 and moondream with local ollama installation
  ExecWait 'ollama create llama3 -f "$INSTDIR\\resources\\llama3\\Modelfile"'
  ExecWait 'ollama create moondream -f "$INSTDIR\\resources\\moondream\\Modelfile"'

  ; Associate program in Windows Registry
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\LlamaFS" "DisplayName" "LlamaFS"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\LlamaFS" "UninstallString" "$INSTDIR\\Uninstall.exe"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\LlamaFS" "InstallLocation" "$INSTDIR"

  ; Add context menu entry in Windows Registry
  WriteRegStr HKCR "Directory\\shell\\LlamaFS" "" "Organize with LlamaFS"
  StrCpy $0 "\"$INSTDIR\\LlamaFS.exe\" --folderPath=\"%1\""
  WriteRegStr HKCR "Directory\\shell\\LlamaFS\\command" "" $0
  ; Set LlamaFS.exe as the associated program for directories
  WriteRegStr HKCR "Directory\\shell\\LlamaFS\\command" "DelegateExecute" ""

  ; Make uninstaller available
  WriteUninstaller "$INSTDIR\\Uninstall.exe"

!macroend

!macro customUnInstall
  ; Cleanup registry and files during uninstallation
  DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\LlamaFS"
  DeleteRegKey HKCR "Directory\\shell\\LlamaFS"
  RMDir /r "$INSTDIR"
!macroend

; Name "LlamaFS"
; OutFile "LlamaFS.exe"
; InstallDir "$PROGRAMFILES\LlamaFS"
RequestExecutionLevel admin

Section "MainSection" SEC01
  ; Call custom install macro
  !insertmacro customInstall

  ; Copy necessary files to $INSTDIR
  SetOutPath "$INSTDIR"
  File /r "resources\build\win-unpacked\*"
  ; Create directories and copy dist files
  CreateDirectory "$INSTDIR\dist"
  File /r "resources\app\dist\*"
SectionEnd

Section "Uninstall"
  ; Call custom uninstall macro
  !insertmacro customUnInstall
SectionEnd
