# Evida

Evida is a desktop-first, local legal workspace for document import, source-bound case overview and Saksrom dialogue.

## Start the app

Double-click:

```text
Start Evida.bat
```

The start file first tries:

```text
Evida Release\Evida.exe
```

Then it tries the developer build:

```text
evida-core\desktop-tauri\src-tauri\target\release\evida-desktop.exe
```

## Where are the program files?

The easiest folder to use is:

```text
Evida Release\
```

It contains:

```text
Evida.exe
Evida installer.exe
Evida installer.msi
```

## Repository structure

```text
.
|-- Start Evida.bat              # only user-facing start file
|-- Evida Release\               # local release output, ignored by git
|-- Evida_Prod_Grade_Spec.md     # prod-grade requirements and checklist
|-- assets\brand\                # logo, icon and intro video
|-- docs\                        # planning and phase documentation
|-- archives\                    # old zip/intake packs, ignored by git
|-- legacy\                      # old analysis/scaffold material
`-- evida-core\                  # active source codebase
```

## Development

Frontend:

```powershell
cd evida-core\desktop-tauri
npm.cmd run build
```

Desktop release:

```powershell
cd evida-core\desktop-tauri
npm.cmd run tauri:build
```

After a release build, `evida-desktop.exe` can be copied to `Evida Release\Evida.exe`.
