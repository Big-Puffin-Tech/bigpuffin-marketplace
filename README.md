# Kinetik

Kinetik's plugins for small and medium-sized businesses. Each business keeps its Kinetik knowledge base in its own Supabase project. Supabase is the online database service that holds it. The knowledge base's technical name is OKB, short for organisational knowledge base. The plugins are:

- `business-analyst`: the business analyst, the agent of the business's owner and administrators. It sets up Kinetik with the owner, adds staff and gives them their roles, and interviews the business's people about their workflows.
- `kinetik`: the database operator, every member of staff's agent, and the skills every business gets.
- `okb`: the sign-in, the `okb` command, and the tools each agent uses in the knowledge base.

## Getting set up

Install the Claude desktop app, and sign in to it. In the app's **Code** tab, open the **Terminal**, and paste the command for your computer. The commands are for macOS and for Windows, in PowerShell.

### 1. The business's owner, before setup

The owner is the person at the business who will own the Supabase account and become Kinetik's first administrator. The owner runs this command first, before the business has a Supabase project.

On macOS:

```sh
cd ~ && curl -fsSLO https://raw.githubusercontent.com/Kinetik-Infotech/kinetik-marketplace/main/install/install.sh && bash install.sh Kinetik-Infotech/kinetik-marketplace --owner
```

On Windows:

```powershell
cd ~; Invoke-WebRequest -UseBasicParsing https://raw.githubusercontent.com/Kinetik-Infotech/kinetik-marketplace/main/install/install.ps1 -OutFile install.ps1; powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 Kinetik-Infotech/kinetik-marketplace --owner
```

The script installs the programs and the plugins, as section 3 says. It then makes the folder `kinetik` in your home folder, and makes the business analyst that folder's agent. It does not sign you in, since there is no project to sign in to yet. Give `--folder <folder>` for another folder, outside any Git repository.

It ends with "Start a new Code session on" the folder. Quit and reopen the Claude desktop app. Start a new Code session on `~/kinetik`, and type:

```
Set up Kinetik
```

Before you type it, create a free account at supabase.com. The business analyst then gives you one command.

Click Run on it, and paste a Supabase access token you make with a short expiry. The command asks your business's name and which Supabase project to use, or creates one in London. It builds everything, and asks your name, email and a password you choose. It ends with a short summary. The business analyst never sees, asks for or types a password, a secret key or a token.

### 2. Each member of staff, after setup

Once setup has finished, the business's administrator adds each member of staff with their business analyst. The administrator then gives the member of staff two things:

- a one-time invitation code, such as `K7QM-3XRD-W9PA`, which works once, for 7 days;
- the command for their computer, with their email, the project's address and its publishable key filled in.

The command, with those values in place of the angle brackets, on macOS:

```sh
cd ~ && curl -fsSLO https://raw.githubusercontent.com/Kinetik-Infotech/kinetik-marketplace/main/install/install.sh && bash install.sh Kinetik-Infotech/kinetik-marketplace --email <email> --url <project address> --key <publishable key> --join
```

On Windows:

```powershell
cd ~; Invoke-WebRequest -UseBasicParsing https://raw.githubusercontent.com/Kinetik-Infotech/kinetik-marketplace/main/install/install.ps1 -OutFile install.ps1; powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 Kinetik-Infotech/kinetik-marketplace --email <email> --url <project address> --key <publishable key> --join
```

The script installs the programs and the plugins, then sets up the folder `kinetik` in your home folder with `okb setup`. The sign-in asks for your invitation code. Then it asks you to choose a password, twice. The password stays hidden as you type it, and goes only to your business's Supabase project. Save it in your password manager. A wrong code, or one that has run out, is refused, and after five wrong tries the code stops working. Ask your administrator for a new one.

The last step, `okb sync`, installs your business's own release of the plugins from your business's knowledge base. Until Kinetik publishes the business's first release, it says there is no release yet, and the plugins from this marketplace stay.

It ends with "Start a new Code session on" your folder. Quit and reopen the Claude desktop app, start a new Code session on the folder, and type:

```
who am I?
```

Your database operator answers with your name, your business's project and your access.

### 3. What the script installs and prints

The script installs each of these programs that is missing:

- Claude Code's command-line tool, `claude`, for adding this marketplace and installing the plugins;
- Node.js 26, for the plugins and your sign-in;
- Git, for your copy of this marketplace;
- Python 3, for pages, workbooks and PDFs;
- Google Chrome on macOS, or Microsoft Edge on Windows, for pictures of pages and for PDFs;
- Poppler and Tesseract, for PDFs and scanned pages;
- FFmpeg and ImageMagick, for recordings, videos and pictures;
- whisper.cpp and its model, `ggml-base.bin`, for transcribing recordings.

It prints one line for each program: installed, already there, or failed with the command to run by hand.

On macOS, it installs Homebrew first, and installs the programs with it. It asks for your Mac password to install Homebrew and Node.js. On Windows, it installs the programs with `winget`. Windows asks you once to approve the installs that need an administrator, such as Node.js and Git.

It checks each file it downloads against the checksum it holds. On macOS, it downloads each installer it runs into a new folder that only you can open, and removes the folder when it ends. It writes each program's own output to a log in your temporary folder, and names the log when a step fails.

It then adds this marketplace, and installs the `okb`, `kinetik` and `business-analyst` plugins from it, with one line for each. Last, it runs `okb setup`, which prints each step as it does it.

The script never asks for or keeps a password. Only the sign-in asks, at its own prompt.

A step that stops shows Claude Code's or the sign-in's message. Run the same command again: each program and each step already done says so, and the run carries on from where it stopped. A folder that is already signed in keeps its password.
