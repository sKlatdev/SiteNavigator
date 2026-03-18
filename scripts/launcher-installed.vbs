' SiteNavigator installed launcher: starts the packaged server hidden.
Option Explicit

Dim shell, fso, scriptDir, exePath
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
exePath = fso.BuildPath(scriptDir, "sitenavigator.exe")

shell.Run """" & exePath & """", 0, False
