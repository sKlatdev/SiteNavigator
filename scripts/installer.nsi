Unicode True
RequestExecutionLevel user

!define APP_NAME "SiteNavigator"
!define APP_VERSION "1.0.0"
!define INSTALL_DIR "$LOCALAPPDATA\${APP_NAME}"
!define OUTPUT_DIR "${REPO_ROOT}\dist"

OutFile "${OUTPUT_DIR}\SiteNavigator-Setup.exe"
InstallDir "${INSTALL_DIR}"
Name "${APP_NAME}"

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Install"
  SetOutPath "$INSTDIR"
  File "/oname=sitenavigator.exe" "${PORTABLE_EXE}"
  File "/oname=SiteNavigator.vbs" "${REPO_ROOT}\scripts\launcher-installed.vbs"

  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\SiteNavigator.vbs"
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\SiteNavigator.vbs"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\sitenavigator.exe"
  Delete "$INSTDIR\SiteNavigator.vbs"
  Delete "$INSTDIR\Uninstall.exe"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"
  RMDir "$INSTDIR"
SectionEnd