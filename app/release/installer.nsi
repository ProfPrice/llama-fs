; -------- Includes -------- 
!include "MUI2.nsh"
!include "logiclib.nsh"
!include "FileFunc.nsh"

; Header image
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "nsis.bmp"

; -------- Defines -------- 
!define NAME "LlamaFS"
!define APPFILE "LlamaFS.exe"
!define VERSION "1.2.0"
!define SLUG "${NAME} v${VERSION}"

; -------- General -------- 
Name "${NAME}"
OutFile "${NAME} Setup.exe"
InstallDir "$LOCALAPPDATA\${NAME}"
InstallDirRegKey HKCU "Software\${NAME}" ""
RequestExecutionLevel admin

; -------- Pages -------- 
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "license.txt"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Set UI language
!insertmacro MUI_LANGUAGE "English"

; Set default installation directory
Function .onInit
    ; Set $INSTDIR to $LOCALAPPDATA\${NAME}
    StrCpy $INSTDIR "$LOCALAPPDATA\${NAME}"
FunctionEnd

; -------- Components Section -------- 
Section "Install LlamaFS" SecLlamaFS
    SetOutPath "$INSTDIR"
    File /r "build\win-unpacked\*.*"
    WriteRegStr HKCU "Software\${NAME}" "" "$INSTDIR"

    ; Associate program in Windows Registry
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}" "DisplayName" "${NAME}"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}" "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}" "InstallLocation" "$INSTDIR"

    ; Add context menu entry in Windows Registry under HKCR
    WriteRegExpandStr HKCR "Directory\\shell\\${NAME}" "" "Organize with ${NAME}"
    WriteRegExpandStr HKCR "Directory\\shell\\${NAME}" "Icon" "$INSTDIR\\${APPFILE},0"

    ; Build the command string in parts to handle quotes correctly
    ; StrCpy $0 "\"$INSTDIR\\${APPFILE}\" --folderPath=\"%1\""

    ; Write the command string to the registry
    WriteRegExpandStr HKCR "Directory\\shell\\${NAME}\\command" "" `"$INSTDIR\${APPFILE}" --folderPath="%1"`

    ; Create Start Menu Shortcuts
    CreateDirectory "$SMPROGRAMS\${NAME}"
    CreateShortCut "$SMPROGRAMS\${NAME}\${NAME}.lnk" "$INSTDIR\${APPFILE}" "" "$INSTDIR\${APPFILE}" 0
    CreateShortCut "$DESKTOP\${NAME}.lnk" "$INSTDIR\${APPFILE}" "" "$INSTDIR\${APPFILE}" 0

    ; Make uninstaller available
    WriteUninstaller "$INSTDIR\Uninstall.exe"

    ; Set the OLLAMA_RUNNERS_DIR environment variable
    WriteRegStr HKCU "Environment" "OLLAMA_RUNNERS_DIR" "$LOCALAPPDATA\Programs\Ollama\ollama_runners"

    ; Notify Windows about the environment variable change
    System::Call 'kernel32::SendMessageTimeout(i 0xffff, i ${WM_SETTINGCHANGE}, i 0, t "Environment", i 0, i 1000, *i 0)'

SectionEnd

SectionGroup "Install Ollama" SecOllamaGroup

    Section "Install Ollama" SecOllama
        ; Base size for Ollama Setup
        AddSize 10240000 ; 10 GB in KB
        SetOutPath "$INSTDIR"
        ExecWait '"$INSTDIR\resources\resources\ollama\OllamaSetup.exe" /S'
    SectionEnd

    Section "Download llama3 for central processing" SecLlama3
        ExecWait 'ollama pull llama3'
    SectionEnd

    Section "Download moondream for image files" SecMoondream
        ExecWait 'ollama pull moondream'
    SectionEnd

SectionGroupEnd

; -------- Uninstall LlamaFS -------- 
Section "Uninstall"
    ; Cleanup registry and files during uninstallation
    DeleteRegKey HKCR "Directory\\shell\\${NAME}"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}"

    ; Remove Shortcuts
    Delete "$SMPROGRAMS\${NAME}\${NAME}.lnk"
    Delete "$DESKTOP\${NAME}.lnk"
    RMDir "$SMPROGRAMS\${NAME}"

    ; Remove environment variable
    DeleteRegValue HKCU "Environment" "OLLAMA_RUNNERS_DIR"
    
    ; Notify Windows about the environment variable change
    System::Call 'kernel32::SendMessageTimeout(i 0xffff, i ${WM_SETTINGCHANGE}, i 0, t "Environment", i 0, i 1000, *i 0)'

    ; Remove installed files
    RMDir /r "$INSTDIR"
SectionEnd
