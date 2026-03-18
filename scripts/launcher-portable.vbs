' SiteNavigator portable launcher: starts portable exe hidden.
Option Explicit

Dim shell, fso, scriptDir, exePath
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
exePath = fso.BuildPath(scriptDir, "sitenavigator-win.exe")

shell.Run """" & exePath & """", 0, False
