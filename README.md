<div align="center">
  <h1>GitHub Deploy Desk</h1>
  <p><sub>Packed via Axiox Media</sub></p>
  <h3>Inspect a GitHub repository, read its README, then deploy source or an installer onto your own disk.</h3>
  <p>Two-step inspect / confirm · GFM README tables and images · optional MSI/EXE launch · zh / en desktop UI</p>

  <p>
    <a href="#install">Install</a> ·
    <a href="#features">Features</a> ·
    <a href="#requirements">Requirements</a> ·
    <a href="#architecture">Architecture</a> ·
    <a href="#faq">FAQ</a> ·
    <a href="#license">License</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/platform-Windows_10%2F11-0b0d12?style=flat-square" alt="Windows" />
    <img src="https://img.shields.io/badge/python-3.11%2B-e7c07a?style=flat-square" alt="Python 3.11+" />
    <img src="https://img.shields.io/badge/ui-zh%20%2F%20en-7ee0c6?style=flat-square" alt="Chinese and English UI" />
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT license" />
  </p>
</div>

> [!WARNING]
> **Confirm deploy can start a third-party installer.** An `.msi` / `.exe` from GitHub Releases is untrusted code until you decide otherwise. The PyInstaller EXE is unsigned; Windows SmartScreen may warn on first launch.

<a id="install"></a>

## Install

| Platform | Package | Guide |
|---|---|---|
| Windows 10/11 | `dist\GitHubDeployDesk.exe` | Python 3.11+ on PATH, close any running EXE, then `build_exe.bat` |
| Development | Run from source | `python app.py` or `python app.py --web` |

### Run from source

```bash
git clone https://github.com/<you>/GitHubDeployDesk.git
cd GitHubDeployDesk
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

`python app.py --web` serves only the local UI at `http://127.0.0.1:8787`.

### Build the Windows EXE

Close `GitHubDeployDesk.exe` first. The packer deletes the previous binary and will fail with `WinError 5` if the file is still open.

```bat
build_exe.bat
```

Or:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_exe.ps1
```

Output: `dist\GitHubDeployDesk.exe`. If the window fails to start, send `dist\deploy_desk.log`.

### First use

1. Paste a GitHub URL (`https://github.com/owner/repo`).
2. Click **Inspect repository**. The README opens on the right.
3. Switch README language if the repo ships `README_CN.md` or `README.zh-CN.md`.
4. Set the deploy path and folder name. Drive `D:\Projects` is preferred when D: exists.
5. Click **Confirm deploy**. The README docks below and progress takes the right pane.
6. If the latest Release contains `.msi` / `.exe`, choose install or source. Otherwise the default-branch zip is extracted.

<a id="features"></a>

## Features

| Area | Included |
|---|---|
| **Inspect first** | Repo metadata and README load before any download |
| **README viewer** | Markdown, GFM pipe tables, sanitized HTML, badges, and images |
| **Language picker** | `README*.md` at repo root and `docs/`; OS language, else English, else default |
| **Confirm deploy** | README moves to the lower dock; the right pane becomes progress |
| **Release installers** | Detects `.msi` / `.exe` / `.msix` / `.appx` and asks before launch |
| **Source extract** | Downloads the default-branch zip and strips GitHub's wrapper folder |
| **Token** | Optional GitHub token for private repos and higher API limits |
| **Desktop UI** | Dark glass layout, zh/en switch, window fills the frame |
| **Local only** | Binds `127.0.0.1`; GitHub is the only network target |

<a id="requirements"></a>

## Requirements

| | Minimum | Recommended |
|---|---|---|
| **OS** | Windows 10 x64 for the EXE | Windows 11 |
| **RAM** | 4 GB | 8 GB |
| **Disk** | 200 MB for the app | SSD plus space for extracted repos |
| **Python from source** | 3.11+ | 3.12 |
| **Optional** | GitHub token | Token when you hit unauthenticated rate limits |

WebView2 ships with current Windows 10/11. No GPU is required.

<a id="architecture"></a>

## Architecture

```text
pywebview desktop window
        │ HTTP on 127.0.0.1
FastAPI + uvicorn
        ├── GET  /api/defaults
        ├── POST /api/inspect
        ├── POST /api/readme
        └── POST /api/deploy        (SSE progress)
static HTML / CSS / JS
axioxmedia.py                      (packer watermark + OS title)
```

| Layer | Path | Responsibility |
|---|---|---|
| Window | `app.py` `run_desktop()` | Port pick, uvicorn thread, pywebview, dark title bar |
| Brand | `axioxmedia.py` | OS-language window title and packer mark |
| API | `app.py` | GitHub inspect, README fetch, deploy stream |
| UI | `static/` | i18n, README render (tables + images), two-step flow |
| Pack | `GitHubDeployDesk.spec` | Onefile EXE with `static/` bundled |

The windowed EXE has no console. `ensure_stdio()` and `log_config=None` keep uvicorn from crashing when `sys.stderr` is `None`.

<a id="faq"></a>

## FAQ

<details>
<summary><strong>Why is the window title prefixed with Axiox Media?</strong></summary>

The packaged build stamps the OS-language packer line:

- Chinese UI — `由安溯媒体自动打包，软件名：GitHub 部署台`
- Any other UI — `Packed via Axiox Media, software name: GitHub Deploy Desk`

The in-app heading stays as the short product name.
</details>

<details>
<summary><strong>Does Confirm deploy run npm / pip / docker for me?</strong></summary>

No. Source mode only downloads and extracts. The log may hint at `package.json` or `docker-compose.yml`. You run those tools yourself.
</details>

<details>
<summary><strong>Why did inspect fail with HTTP 403 / 429?</strong></summary>

Anonymous GitHub API traffic is limited. Paste a fine-grained or classic token with `repo` read access.
</details>

<details>
<summary><strong>Can I expose this on my LAN?</strong></summary>

The server binds loopback only. Do not republish port 8787 without adding your own auth.
</details>

<a id="license"></a>

## License

MIT. See [LICENSE](LICENSE). Files you download from other repositories keep their own licenses and installer terms.
