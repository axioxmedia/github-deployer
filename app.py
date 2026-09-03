"""GitHub 一键部署台 — local helper for cloning or installing GitHub releases."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from axioxmedia import AIO_BRAND, aio_watermark, axiox_window_title

def app_root() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent


ROOT = app_root()
STATIC = ROOT / "static"
INSTALLER_EXTS = {".msi", ".exe", ".msix", ".appx"}
GITHUB_RE = re.compile(
    r"github\.com[:/](?P<owner>[A-Za-z0-9_.-]+)/(?P<repo>[A-Za-z0-9_.-]+?)(?:\.git)?(?:/|$)",
    re.IGNORECASE,
)

app = FastAPI(title="GitHub 部署台", version="1.0.0")
app.mount("/assets", StaticFiles(directory=STATIC), name="assets")


class InspectRequest(BaseModel):
    url: str
    token: str = ""


class ReadmeRequest(BaseModel):
    url: str
    path: str
    token: str = ""
    branch: str = ""


README_FILE = re.compile(
    r"^(readme)(?:[._-]([A-Za-z]{2}(?:[-_][A-Za-z]{2,8})?))?(?:\.(md|markdown|rst|txt))?$",
    re.IGNORECASE,
)
README_LABELS = {
    "default": "Default",
    "en": "English",
    "en-us": "English",
    "en-gb": "English",
    "zh": "简体中文",
    "zh-cn": "简体中文",
    "zh-hans": "简体中文",
    "cn": "简体中文",
    "zh-tw": "繁體中文",
    "zh-hk": "繁體中文",
    "zh-hant": "繁體中文",
    "ja": "日本語",
    "jp": "日本語",
    "ko": "한국어",
    "kr": "한국어",
    "de": "Deutsch",
    "fr": "Français",
    "es": "Español",
    "ru": "Русский",
    "pt": "Português",
    "pt-br": "Português (Brasil)",
    "vi": "Tiếng Việt",
    "th": "ไทย",
    "id": "Indonesia",
    "ar": "العربية",
}


def readme_lang(filename: str) -> str | None:
    match = README_FILE.match(Path(filename).name)
    if not match:
        return None
    tag = (match.group(2) or "default").lower().replace("_", "-")
    return tag


def list_readme_files(http: httpx.Client, owner: str, repo: str, branch: str, token: str) -> list[dict[str, str]]:
    found: list[dict[str, str]] = []
    seen: set[str] = set()
    for folder in ("", "docs"):
        url = f"https://api.github.com/repos/{owner}/{repo}/contents"
        if folder:
            url += f"/{folder}"
        url += f"?ref={branch}"
        res = http.get(url, headers=headers(token))
        if res.status_code != 200:
            continue
        items = res.json()
        if not isinstance(items, list):
            continue
        for item in items:
            if item.get("type") != "file":
                continue
            path = item.get("path") or item.get("name") or ""
            lang = readme_lang(Path(path).name)
            if not lang or path in seen:
                continue
            seen.add(path)
            found.append(
                {
                    "path": path,
                    "name": Path(path).name,
                    "lang": lang,
                    "label": README_LABELS.get(lang, lang),
                    "sha": item.get("sha") or "",
                }
            )
    order = {"zh-cn": 0, "zh": 1, "zh-tw": 2, "en": 3, "default": 4}
    found.sort(key=lambda x: (order.get(x["lang"], 50), x["path"]))
    return found


class DeployRequest(BaseModel):
    url: str
    dest_root: str
    folder_name: str
    mode: str = Field(pattern="^(source|installer)$")
    asset_id: int | None = None
    asset_name: str = ""
    download_url: str = ""
    token: str = ""
    run_installer: bool = True


def parse_github(url: str) -> tuple[str, str]:
    text = (url or "").strip()
    if not text:
        raise HTTPException(400, "请先粘贴 GitHub 仓库链接")
    match = GITHUB_RE.search(text)
    if match:
        repo = match.group("repo").removesuffix(".git")
        return match.group("owner"), repo
    parsed = urlparse(text if "://" in text else f"https://{text}")
    parts = [p for p in parsed.path.split("/") if p]
    if parsed.netloc.endswith("github.com") and len(parts) >= 2:
        return parts[0], parts[1].removesuffix(".git")
    raise HTTPException(400, "无法识别该链接，请使用 https://github.com/用户/仓库")


def headers(token: str = "") -> dict[str, str]:
    h = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "GitHub-Deploy-Studio/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token.strip():
        h["Authorization"] = f"Bearer {token.strip()}"
    return h


def default_root() -> str:
    if os.name == "nt":
        d = Path("D:/")
        if d.exists():
            return str(Path("D:/Projects"))
        return str(Path.home() / "Projects")
    # 在非 Windows 上仍给出 D 盘风格的建议，实际回落到家目录
    for candidate in ("/mnt/d/Projects", "/media/d/Projects"):
        if Path(candidate).parent.exists():
            return candidate
    return str(Path.home() / "Projects")


def safe_folder(name: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", (name or "").strip())
    cleaned = cleaned.strip(" .")
    return cleaned or "project"


def client() -> httpx.Client:
    return httpx.Client(timeout=httpx.Timeout(45.0, connect=15.0), follow_redirects=True)


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC / "index.html")


@app.get("/api/defaults")
def api_defaults() -> dict[str, Any]:
    root = default_root()
    return {
        "dest_root": root,
        "prefer_d": os.name == "nt" and Path("D:/").exists(),
        "platform": sys.platform,
        "is_windows": os.name == "nt",
        "aio_brand": AIO_BRAND,
        "axiox_title": axiox_window_title(),
        "axioxmedia": aio_watermark(),
    }


@app.post("/api/inspect")
def api_inspect(req: InspectRequest) -> dict[str, Any]:
    owner, repo = parse_github(req.url)
    with client() as http:
        repo_res = http.get(f"https://api.github.com/repos/{owner}/{repo}", headers=headers(req.token))
        if repo_res.status_code == 404:
            raise HTTPException(404, f"仓库不存在或为私有：{owner}/{repo}")
        if repo_res.status_code == 403:
            raise HTTPException(429, "GitHub API 频率受限，请填写 Token 后再试")
        if repo_res.status_code >= 400:
            raise HTTPException(repo_res.status_code, f"GitHub 返回 {repo_res.status_code}")
        info = repo_res.json()

        release = None
        rel_res = http.get(
            f"https://api.github.com/repos/{owner}/{repo}/releases/latest",
            headers=headers(req.token),
        )
        if rel_res.status_code == 200:
            release = rel_res.json()

        branch = info.get("default_branch") or "main"
        readmes = list_readme_files(http, owner, repo, branch, req.token)

    installers: list[dict[str, Any]] = []
    if release:
        for asset in release.get("assets") or []:
            name = asset.get("name") or ""
            ext = Path(name).suffix.lower()
            if ext in INSTALLER_EXTS:
                installers.append(
                    {
                        "id": asset.get("id"),
                        "name": name,
                        "size": asset.get("size") or 0,
                        "content_type": asset.get("content_type") or "",
                        "download_url": asset.get("browser_download_url") or "",
                        "updated_at": asset.get("updated_at") or "",
                    }
                )

    return {
        "owner": owner,
        "repo": repo,
        "full_name": info.get("full_name"),
        "description": info.get("description") or "",
        "stars": info.get("stargazers_count") or 0,
        "forks": info.get("forks_count") or 0,
        "language": info.get("language") or "",
        "license": (info.get("license") or {}).get("spdx_id") or "",
        "default_branch": info.get("default_branch") or "main",
        "html_url": info.get("html_url"),
        "clone_url": info.get("clone_url"),
        "private": bool(info.get("private")),
        "suggested_folder": safe_folder(repo),
        "release": None
        if not release
        else {
            "tag": release.get("tag_name"),
            "name": release.get("name") or release.get("tag_name"),
            "published_at": release.get("published_at"),
        },
        "installers": installers,
        "has_installer": bool(installers),
        "readmes": readmes,
    }


@app.post("/api/readme")
def api_readme(req: ReadmeRequest) -> dict[str, Any]:
    owner, repo = parse_github(req.url)
    raw_path = (req.path or "").replace("\\", "/").lstrip("/")
    if ".." in raw_path.split("/") or not readme_lang(Path(raw_path).name):
        raise HTTPException(400, "只能读取 README 文件")
    branch = req.branch.strip() or "main"
    api_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{raw_path}?ref={branch}"
    with client() as http:
        res = http.get(
            api_url,
            headers={**headers(req.token), "Accept": "application/vnd.github.raw"},
        )
        if res.status_code == 404:
            raise HTTPException(404, f"未找到 {raw_path}")
        if res.status_code >= 400:
            raise HTTPException(res.status_code, f"无法读取 README：HTTP {res.status_code}")
        text = res.text
    return {
        "path": raw_path,
        "lang": readme_lang(Path(raw_path).name) or "default",
        "markdown": text,
    }


def sse(event: str, **data: Any) -> str:
    payload = {"event": event, **data}
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def human_size(n: int) -> str:
    size = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024
    return f"{n} B"


def download_file(http: httpx.Client, url: str, dest: Path, hdrs: dict[str, str]) -> Iterator[str]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with http.stream("GET", url, headers=hdrs) as res:
        if res.status_code >= 400:
            raise HTTPException(res.status_code, f"下载失败：HTTP {res.status_code}")
        total = int(res.headers.get("Content-Length") or 0)
        done = 0
        with dest.open("wb") as fh:
            for chunk in res.iter_bytes(1024 * 256):
                fh.write(chunk)
                done += len(chunk)
                pct = int(done * 100 / total) if total else 0
                yield sse("progress", percent=pct, done=done, total=total, label=dest.name)


def extract_zip(zip_path: Path, target: Path) -> Path:
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        root_prefix = ""
        if names:
            first = names[0].split("/")[0]
            if all(item == first or item.startswith(first + "/") for item in names):
                root_prefix = first + "/"
        for member in zf.infolist():
            name = member.filename
            if root_prefix and name.startswith(root_prefix):
                rel = name[len(root_prefix) :]
            else:
                rel = name
            if not rel or member.is_dir():
                continue
            out = target / rel
            if not str(out.resolve()).startswith(str(target.resolve())):
                continue
            out.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(member) as src, out.open("wb") as dst:
                shutil.copyfileobj(src, dst)
    zip_path.unlink(missing_ok=True)
    return target


def launch_installer(path: Path) -> str:
    if os.name != "nt":
        return "当前系统不是 Windows，已下载安装包但不会自动执行。"
    try:
        if path.suffix.lower() == ".msi":
            subprocess.Popen(["msiexec", "/i", str(path)], close_fds=True)
            return f"已调用 msiexec 安装 {path.name}"
        os.startfile(str(path))  # type: ignore[attr-defined]
        return f"已启动安装程序 {path.name}"
    except OSError as exc:
        return f"无法启动安装程序：{exc}"


def detect_stack(target: Path) -> list[str]:
    hints: list[str] = []
    mapping = [
        ("package.json", "检测到 Node 项目，可在目录内执行 npm install / bun install"),
        ("pnpm-lock.yaml", "检测到 pnpm lock"),
        ("bun.lockb", "检测到 Bun 项目"),
        ("pyproject.toml", "检测到 Python 项目（pyproject）"),
        ("requirements.txt", "检测到 Python 依赖 requirements.txt"),
        ("Pipfile", "检测到 Pipenv 项目"),
        ("Cargo.toml", "检测到 Rust / Cargo 项目"),
        ("go.mod", "检测到 Go 模块"),
        ("docker-compose.yml", "检测到 Docker Compose"),
        ("deploy/docker-compose.yml", "检测到 deploy/docker-compose.yml"),
        ("Dockerfile", "检测到 Dockerfile"),
        ("CMakeLists.txt", "检测到 CMake 项目"),
    ]
    for rel, msg in mapping:
        if (target / rel).exists():
            hints.append(msg)
    return hints


@app.post("/api/deploy")
def api_deploy(req: DeployRequest) -> StreamingResponse:
    owner, repo = parse_github(req.url)
    folder = safe_folder(req.folder_name or repo)
    dest_root = Path(req.dest_root.strip() or default_root()).expanduser()
    target = dest_root / folder

    def stream() -> Iterator[str]:
        yield sse("log", level="info", message=f"解析仓库 {owner}/{repo}")
        yield sse("log", level="info", message=f"目标目录 {target}")

        if target.exists() and any(target.iterdir()):
            yield sse("error", message=f"目录已存在且非空：{target}。请换一个文件夹名称。")
            return

        dest_root.mkdir(parents=True, exist_ok=True)
        hdrs = headers(req.token)

        try:
            with client() as http:
                if req.mode == "installer":
                    url = req.download_url.strip()
                    if not url and req.asset_id:
                        yield sse("log", level="info", message="正在获取安装包下载地址…")
                        meta = http.get(
                            f"https://api.github.com/repos/{owner}/{repo}/releases/assets/{req.asset_id}",
                            headers=hdrs,
                        )
                        if meta.status_code >= 400:
                            yield sse("error", message=f"无法获取安装包：HTTP {meta.status_code}")
                            return
                        url = meta.json().get("browser_download_url") or ""
                    if not url:
                        yield sse("error", message="未选择安装包")
                        return

                    filename = req.asset_name.strip() or f"{repo}-setup"
                    filename = Path(filename).name
                    if Path(filename).suffix.lower() not in INSTALLER_EXTS:
                        filename += ".exe"
                    downloads = dest_root / "_installers" / repo
                    dest_file = downloads / filename
                    yield sse("log", level="info", message=f"下载安装包到 {dest_file}")
                    yield from download_file(http, url, dest_file, {"User-Agent": hdrs["User-Agent"]})
                    yield sse("log", level="ok", message=f"安装包已保存（{human_size(dest_file.stat().st_size)}）")
                    if req.run_installer:
                        yield sse("log", level="warn", message="即将启动第三方安装程序，请确认来源可信。")
                        note = launch_installer(dest_file)
                        yield sse("log", level="ok", message=note)
                    yield sse(
                        "done",
                        mode="installer",
                        path=str(dest_file),
                        folder=str(dest_file.parent),
                    )
                    return

                # source mode
                repo_res = http.get(f"https://api.github.com/repos/{owner}/{repo}", headers=hdrs)
                if repo_res.status_code >= 400:
                    yield sse("error", message=f"无法读取仓库信息：HTTP {repo_res.status_code}")
                    return
                branch = repo_res.json().get("default_branch") or "main"
                zip_url = f"https://codeload.github.com/{owner}/{repo}/zip/refs/heads/{branch}"
                zip_path = dest_root / f"{folder}.src.zip"
                yield sse("log", level="info", message=f"下载源码包（分支 {branch}）")
                yield from download_file(http, zip_url, zip_path, {"User-Agent": hdrs["User-Agent"]})
                yield sse("log", level="info", message="正在解压并去掉 GitHub 自动套的一层目录…")
                extract_zip(zip_path, target)
                hints = detect_stack(target)
                for hint in hints:
                    yield sse("log", level="ok", message=hint)
                if not hints:
                    yield sse("log", level="info", message="未识别到常见构建清单，源码已原样放下。")
                yield sse("done", mode="source", path=str(target), folder=str(target), hints=hints)
        except HTTPException as exc:
            yield sse("error", message=str(exc.detail))
        except httpx.HTTPError as exc:
            yield sse("error", message=f"网络错误：{exc}")
        except OSError as exc:
            yield sse("error", message=f"文件系统错误：{exc}")
        except zipfile.BadZipFile:
            yield sse("error", message="下载的源码包不是有效 zip，请检查网络后重试")

    return StreamingResponse(stream(), media_type="text/event-stream")


def runtime_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


LOG_FILE = runtime_dir() / "deploy_desk.log"


def write_log(message: str) -> None:
    try:
        with LOG_FILE.open("a", encoding="utf-8") as fh:
            fh.write(message.rstrip() + "\n")
    except OSError:
        pass


def show_error(message: str) -> None:
    write_log(message)
    if os.name == "nt":
        try:
            import ctypes

            ctypes.windll.user32.MessageBoxW(0, message, "GitHub Deploy Desk", 0x10)
            return
        except Exception:
            pass
    print(message, file=sys.stderr)


def _free_port(preferred: int = 8787) -> int:
    import socket

    for port in (preferred, 8788, 8789, 8790, 0):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(("127.0.0.1", port))
            chosen = int(sock.getsockname()[1])
        except OSError:
            chosen = -1
        finally:
            sock.close()
        if chosen > 0:
            return chosen
    raise RuntimeError("没有可用的本地端口")


def ensure_stdio() -> None:
    """Windowed PyInstaller sets stdout/stderr to None; uvicorn logging needs them."""
    if sys.stdout is None:
        sys.stdout = LOG_FILE.open("a", encoding="utf-8")
    if sys.stderr is None:
        sys.stderr = LOG_FILE.open("a", encoding="utf-8")


def run_server(host: str, port: int, reload: bool = False) -> None:
    import uvicorn

    ensure_stdio()
    if reload:
        uvicorn.run(app, host=host, port=port, reload=True, log_level="warning", log_config=None)
        return

    config = uvicorn.Config(
        app,
        host=host,
        port=port,
        log_level="warning",
        log_config=None,
        lifespan="on",
        access_log=False,
    )
    server = uvicorn.Server(config)
    server.install_signal_handlers = False
    server.run()


def wait_ready(url: str, server_error: list[str], timeout: float = 30.0) -> None:
    import time

    deadline = time.time() + timeout
    while time.time() < deadline:
        if server_error:
            raise RuntimeError(server_error[0])
        try:
            with httpx.Client(timeout=0.8, trust_env=False) as http:
                if http.get(url).status_code < 500:
                    return
        except httpx.HTTPError:
            time.sleep(0.2)
    extra = f"\n服务线程错误：{server_error[0]}" if server_error else ""
    raise RuntimeError(f"本地服务启动超时：{url}{extra}\n日志：{LOG_FILE}")


def run_desktop() -> None:
    import threading
    import traceback
    import webbrowser

    write_log(f"start frozen={getattr(sys, 'frozen', False)} meipass={getattr(sys, '_MEIPASS', '')}")
    write_log(f"static={STATIC} exists={STATIC.exists()}")

    port = _free_port()
    url = f"http://127.0.0.1:{port}"
    write_log(f"bind {url}")
    server_error: list[str] = []

    def _serve() -> None:
        try:
            run_server("127.0.0.1", port, reload=False)
        except Exception:
            server_error.append(traceback.format_exc())
            write_log(server_error[-1])

    thread = threading.Thread(target=_serve, name="uvicorn", daemon=True)
    thread.start()
    wait_ready(f"{url}/api/defaults", server_error)

    try:
        import webview

        window = webview.create_window(
            title=axiox_window_title(),
            url=url,
            width=1440,
            height=900,
            min_size=(960, 680),
            background_color="#0b0d12",
        )

        def paint_chrome(_=None) -> None:
            if os.name != "nt":
                return
            try:
                import ctypes

                hwnd = int(window.native.Handle.ToInt32())
                value = ctypes.c_int(1)
                for attr in (20, 19):
                    ctypes.windll.dwmapi.DwmSetWindowAttribute(
                        hwnd, attr, ctypes.byref(value), ctypes.sizeof(value)
                    )
            except Exception as exc:
                write_log(f"dark titlebar skipped: {exc}")

        try:
            window.events.shown += paint_chrome
        except Exception:
            pass
        webview.start()
        return
    except Exception:
        write_log(traceback.format_exc())
        webbrowser.open(url)
        while thread.is_alive():
            thread.join(timeout=0.5)


if __name__ == "__main__":
    import multiprocessing
    import traceback

    multiprocessing.freeze_support()
    ensure_stdio()
    try:
        desktop = "--web" not in sys.argv and os.environ.get("DEPLOY_DESK_WEB") != "1"
        if desktop:
            run_desktop()
        else:
            run_server("127.0.0.1", _free_port(8787), reload=not getattr(sys, "frozen", False))
    except Exception:
        show_error("启动失败：\n\n" + traceback.format_exc() + f"\n\n日志文件：{LOG_FILE}")
        raise
