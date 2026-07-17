# Windows Dependencies Installation Guide

This markdown file goes over how to install dependencies for the project on
****Windows****. It is important to follow these steps to ensure that the
project runs correctly.

## Windows Subsystem for Linux (WSL)

You can install WSL (Windows Subsystem for Linux) via the Microsoft Store to get
a linux based environment on your Windows machine. This is highly recommended
for dev in general althouhg not required for this project.

you can install WSL by following the instructions here:
[https://learn.microsoft.com/en-us/windows/wsl/install](https://learn.microsoft.com/en-us/windows/wsl/install)
or typing

```
wsl.exe --install
```

in a command prompt or powershell window. If you do this, you should then follow
the linux dependency installation guide instead of this one. NOTE: WSL includes
docker, so you will not need to install it separately.

# The Super Easy Way (install.sh)

run the install.sh script in powershell to install all dependencies for you.

```powershell
# add execute permission to the script
chmod +x ./install.sh
./install.sh
```

# The Easy Way (Winget)

## Winget

winget is a package manager for Windows that allows you to install software from
the command line. It is included with Windows 10 and later versions. You can use
winget to install Node.js, npm, and Docker.

if you don't have winget installed, you can download it from the Microsoft Store
or follow the instructions here:
[https://learn.microsoft.com/en-us/windows/package-manager/winget/](https://learn.microsoft.com/en-us/windows/package-manager/winget/)
or run this

```Powershell
# Install the WinGet PowerShell module for all users
Install-PackageProvider -Name NuGet -Force
Install-Module -Name Microsoft.WinGet.Client -Force -Scope AllUsers
# Repair or bootstrap WinGet for all users
Repair-WinGetPackageManager -AllUsers
```

## Node.js and npm Installation

To install node and npm using Winget run the following command in powershell to
get the list of available versions (you may have to agree to the license
agreement):

```Powershell
winget search OpenJS.NodeJS

# output will look like this:
Name          Id                Version  Source
------------------------------------------------
Node.js       OpenJS.NodeJS     26.4.0   winget
Node.js 10    OpenJS.NodeJS.10  10.24.1  winget
Node.js 12    OpenJS.NodeJS.12  12.22.12 winget
Node.js 14    OpenJS.NodeJS.14  14.21.3  winget
Node.js 15    OpenJS.NodeJS.15  15.14.0  winget
.
.
.
```

for this project, you need to install Node.js 22 or newer. For this guide we
will use the latest Long Term Support (LTS) version which is currently 24.18.0.
To install it, run the following command in powershell:

```Powershell
# Install the latest LTS version of Node.js and npm
winget install OpenJS.NodeJS.LTS --source winget

# Verify the installation
node -v
npm -v
```

NOTE: if you get:

```Powershell
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system. For
more information, see about_Execution_Policies at https:/go.microsoft.com/fwlink/?LinkID=135170.
```

run the following command in powershell to allow scripts to run:

```Powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

You can now dev locally, but in order to pass onboarding you will need to
install Docker as well.

## Docker Installation

Docker is a platform that allows you to run applications in containers. It is
required for this project to build the image and run the application. Our core
infrastrucuture is a Kuvernetes cluster, which works on deploying containers.
Docker is available for Windows 10 and later versions. You can install Docker
using Winget by running the following command in powershell:

```Powershell
# Install Docker  (recommended to use Docker Desktop)
winget install Docker.DockerDesktop --source winget

# Verify the installation
docker --version
```

## The Harder Way (Manual Installation)

## Node.js and npm Installation

Read the instructions on the Node.js website to install Node.js and npm on
Windows: [https://nodejs.org/en/download/](https://nodejs.org/en/download/).

### NOTE:

The top part is using docker to run a node container, which is not what we want.
We want to install node and npm, use the "prebuilt for Windows" at the bottom of
the page.

## Docker Installation

You can install Docker Desktop for Windows by following the instructions on the
Docker website:
[https://docs.docker.com/desktop/install/windows-install/](https://docs.docker.com/desktop/install/windows-install/).
