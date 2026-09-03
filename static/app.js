const AXIOXMEDIA_BRAND = "Axiox Media";
const AIO_WATERMARK = "axioxmedia";
const $ = (id) => document.getElementById(id);

const I18N = {
  zh: {
    appTitle: "GitHub 部署台",
    appSubtitle: "先解析仓库并阅读 README，确认后再部署",
    formTitle: "投放一个仓库",
    urlLabel: "GitHub 链接",
    urlPlaceholder: "https://github.com/owner/repo",
    destLabel: "部署路径",
    folderLabel: "文件夹名称",
    browse: "浏览",
    tokenLabel: "GitHub Token（可选，提高 API 限额 / 私有仓库）",
    tokenPlaceholder: "ghp_… 可留空",
    inspectBtn: "解析仓库",
    confirmDeploy: "确认部署",
    previewTitle: "仓库与进度",
    repoEmptyTitle: "还没有仓库",
    repoEmptyHint: "左侧贴上 GitHub 地址后开始",
    waiting: "等待任务…",
    readmeTitle: "项目说明",
    readmeEmpty: "先在左侧粘贴链接并解析",
    modalTitle: "发现可直接安装的包",
    downloadSource: "下载源码",
    downloadInstall: "下载并安装",
    preferD: "已优先 D 盘",
    noD: "未检测到 D 盘",
    notWin: "非 Windows · 使用用户目录",
    pathHintD: "默认路径 {path}。可改盘符、改文件夹名后再部署。",
    pathHint: "检测到可写路径后会优先建议 D:\\Projects。若 D 盘不存在，则回落到用户目录。",
    latest: "最新版本 {tag}",
    noRelease: "暂无 Release",
    defaultBranch: "默认分支 {branch}",
    hasInstaller: "安装包 {n} 个",
    noInstaller: "无 MSI/EXE",
    unknownLang: "未知",
    noLicense: "未声明",
    noDesc: "暂无简介",
    inspectStart: "正在读取仓库、README 与最新 Release…",
    located: "已定位 {name}",
    noMsi: "未发现 MSI / EXE，改为下载源码。",
    startInstaller: "开始下载安装包…",
    startSource: "开始下载源码…",
    doneInstaller: "完成：{path}",
    doneSource: "源码已放到 {path}",
    noAsset: "没有可用的安装包，改为下载源码。",
    pickerWarn: "当前浏览器不支持目录选择器，请直接编辑路径文本。",
    pickerPicked: "已选择文件夹名称「{name}」。请确认左侧路径是否正确。",
    modalBody: "{name} 的 {tag} 提供了可执行安装包。直接安装会启动第三方程序，请确认来源可信。",
    readmeLoad: "正在加载 README（{lang}）…",
    readmeFail: "README 读取失败：{msg}",
    readmeNone: "该仓库根目录没有 README。",
    readmeFallback: "没有与系统语言匹配的 README，已显示英文/默认版。",
    langDefault: "默认",
  },
  en: {
    appTitle: "GitHub Deploy Desk",
    appSubtitle: "Inspect the repo and read the README, then confirm deploy",
    formTitle: "Drop a repository",
    urlLabel: "GitHub URL",
    urlPlaceholder: "https://github.com/owner/repo",
    destLabel: "Deploy path",
    folderLabel: "Folder name",
    browse: "Browse",
    tokenLabel: "GitHub token (optional, higher rate limit / private repos)",
    tokenPlaceholder: "ghp_… leave empty if public",
    inspectBtn: "Inspect repository",
    confirmDeploy: "Confirm deploy",
    previewTitle: "Repository & progress",
    repoEmptyTitle: "No repository yet",
    repoEmptyHint: "Paste a GitHub URL on the left to start",
    waiting: "Waiting for a job…",
    readmeTitle: "Project README",
    readmeEmpty: "Paste a URL on the left and inspect first",
    modalTitle: "Installer package found",
    downloadSource: "Download source",
    downloadInstall: "Download & install",
    preferD: "Preferring drive D:",
    noD: "Drive D: not found",
    notWin: "Not Windows · using home folder",
    pathHintD: "Default path {path}. Change the drive or folder name before deploying.",
    pathHint: "If drive D: exists it is preferred; otherwise the user folder is used.",
    latest: "Latest {tag}",
    noRelease: "No release",
    defaultBranch: "Default branch {branch}",
    hasInstaller: "{n} installer(s)",
    noInstaller: "No MSI/EXE",
    unknownLang: "Unknown",
    noLicense: "Unlicensed",
    noDesc: "No description",
    inspectStart: "Reading repository, README, and latest release…",
    located: "Located {name}",
    noMsi: "No MSI/EXE found. Downloading source instead.",
    startInstaller: "Downloading installer…",
    startSource: "Downloading source…",
    doneInstaller: "Done: {path}",
    doneSource: "Source extracted to {path}",
    noAsset: "No installer selected. Downloading source instead.",
    pickerWarn: "This browser cannot pick folders. Edit the path field instead.",
    pickerPicked: "Picked folder “{name}”. Confirm the path on the left.",
    modalBody: "{name} {tag} ships an executable installer. Running it launches third-party code — only continue if you trust the repo.",
    readmeLoad: "Loading README ({lang})…",
    readmeFail: "Failed to load README: {msg}",
    readmeNone: "No README in the repository root.",
    readmeFallback: "No README matches the system language. Showing English/default.",
    langDefault: "Default",
  },
};

const state = {
  inspected: null,
  busy: false,
  uiLang: "zh",
  defaults: null,
  logCleared: false,
  phase: "idle",
};

function showReadmePhase() {
  state.phase = "readme";
  $("readmeMount").appendChild($("readmeUnit"));
  $("phaseReadme").hidden = false;
  $("confirmDeploy").hidden = false;
  $("phaseProgress").hidden = true;
  $("readmeDock").hidden = true;
}

function showProgressPhase() {
  state.phase = "progress";
  $("dockMount").appendChild($("readmeUnit"));
  $("phaseReadme").hidden = true;
  $("confirmDeploy").hidden = true;
  $("phaseProgress").hidden = false;
  $("readmeDock").hidden = false;
}

function detectUiLang() {
  const saved = localStorage.getItem("deploy_desk_ui_lang");
  if (saved === "zh" || saved === "en") return saved;
  const loc = (navigator.language || "en").toLowerCase();
  return loc.startsWith("zh") ? "zh" : "en";
}

function t(key, vars) {
  const table = I18N[state.uiLang] || I18N.en;
  let text = table[key] || I18N.en[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, v);
    }
  }
  return text;
}

function applyI18n() {
  document.documentElement.lang = state.uiLang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-ui-lang]").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.uiLang === state.uiLang);
  });
  if (!state.inspected) renderRepoEmpty();
  else renderRepo(state.inspected);
  paintDefaults();
  if (state.phase === "idle" && $("readme").classList.contains("empty")) {
    $("readme").textContent = t("readmeEmpty");
  }
  if (!state.logCleared) {
    $("log").innerHTML = `<div class="info">${t("waiting")}</div>`;
  }
}

function systemLangs() {
  const raw = (navigator.language || "en").toLowerCase().replace("_", "-");
  const short = raw.split("-")[0];
  const extras = [];
  if (raw === "zh-cn" || raw === "zh-hans" || raw === "zh") extras.push("zh-cn", "zh", "cn", "zh-hans");
  if (raw === "zh-tw" || raw === "zh-hk" || raw === "zh-hant") extras.push("zh-tw", "zh-hk", "zh-hant", "zh");
  return [raw, short, ...extras];
}

function pickReadme(readmes) {
  if (!readmes || !readmes.length) return null;
  const preferred = systemLangs();
  for (const lang of preferred) {
    const hit = readmes.find((item) => item.lang === lang);
    if (hit) return { item: hit, fallback: false };
  }
  const en = readmes.find((item) => item.lang === "en" || item.lang === "en-us" || item.lang === "en-gb");
  if (en) return { item: en, fallback: true };
  const def = readmes.find((item) => item.lang === "default") || readmes[0];
  return { item: def, fallback: true };
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function repoRawBase() {
  const info = state.inspected;
  if (!info) return "";
  return `https://raw.githubusercontent.com/${info.owner}/${info.repo}/${info.default_branch}/`;
}

function resolveAssetUrl(url) {
  const src = (url || "").trim();
  if (!src) return "";
  if (/^(https?:|data:)/i.test(src)) {
    return src.replace(
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/([^/]+)\/(.+)$/i,
      "https://raw.githubusercontent.com/$1/$2/$3/$4",
    );
  }
  const base = repoRawBase();
  if (!base) return src;
  if (src.startsWith("/")) return base.replace(/\/$/, "") + src;
  return base + src.replace(/^\.\//, "");
}

function sanitizeHtml(html) {
  const parsed = new DOMParser().parseFromString(`<div class="md-root">${html}</div>`, "text/html");
  const root = parsed.body.firstElementChild;
  if (!root) return "";
  const allowed = new Set([
    "A", "IMG", "P", "BR", "HR", "H1", "H2", "H3", "H4", "H5", "H6",
    "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD",
    "CODE", "PRE", "STRONG", "EM", "B", "I", "BLOCKQUOTE",
    "DETAILS", "SUMMARY", "DIV", "SPAN", "PICTURE", "SOURCE", "SUB", "SUP", "KBD",
  ]);
  const allowedAttr = new Set(["href", "src", "alt", "title", "width", "height", "align", "colspan", "rowspan", "class"]);

  const scrub = (node) => {
    [...node.children].forEach((el) => {
      if (!allowed.has(el.tagName)) {
        const parent = el.parentNode;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        return;
      }
      [...el.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (!allowedAttr.has(name) && !name.startsWith("aria-")) {
          el.removeAttribute(attr.name);
          return;
        }
        if ((name === "href" || name === "src") && /^(javascript|vbscript|data:text)/i.test(attr.value)) {
          el.removeAttribute(attr.name);
        }
      });
      if (el.tagName === "IMG") {
        const src = resolveAssetUrl(el.getAttribute("src") || "");
        if (src) el.setAttribute("src", src);
        el.setAttribute("loading", "lazy");
        el.removeAttribute("onerror");
      }
      if (el.tagName === "A") {
        const href = el.getAttribute("href") || "";
        if (href && !href.startsWith("#")) {
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noreferrer noopener");
        }
      }
      scrub(el);
    });
  };
  scrub(root);
  return root.innerHTML;
}

function renderMarkdown(src) {
  const lines = String(src || "").replaceAll("\r\n", "\n").split("\n");
  const html = [];
  let inCode = false;
  let code = [];
  let listType = null;
  let htmlBuf = [];

  const closeList = () => {
    if (listType) {
      html.push(listType === "ol" ? "</ol>" : "</ul>");
      listType = null;
    }
  };

  const flushHtml = () => {
    if (!htmlBuf.length) return;
    html.push(htmlBuf.join("\n"));
    htmlBuf = [];
  };

  const inline = (s) => {
    let out = escapeHtml(s);
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, alt, url) => {
      return `<img src="${escapeHtml(resolveAssetUrl(url))}" alt="${alt}" loading="lazy">`;
    });
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
      const href = /^(https?:|mailto:|#)/i.test(url) ? url : resolveAssetUrl(url);
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${label}</a>`;
    });
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return out;
  };

  const isTableSep = (line) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  const isTableRow = (line) => /^\s*\|(.+)\|\s*$/.test(line);
  const splitCells = (line) => {
    let s = line.trim();
    if (s.startsWith("|")) s = s.slice(1);
    if (s.endsWith("|")) s = s.slice(0, -1);
    return s.split("|").map((cell) => cell.trim());
  };
  const renderTable = (block) => {
    if (block.length < 2) return false;
    const header = splitCells(block[0]);
    const bodyRows = block.slice(2).map(splitCells);
    const head = header.map((cell) => `<th>${inline(cell)}</th>`).join("");
    const body = bodyRows
      .map((row) => {
        const cells = header.map((_, i) => `<td>${inline(row[i] || "")}</td>`).join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
    html.push(`<div class="md-table"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
    return true;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const fence = raw.match(/^```/);
    if (fence) {
      flushHtml();
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(raw);
      continue;
    }
    if (/^\s*<\/?[a-zA-Z]/.test(raw)) {
      closeList();
      htmlBuf.push(raw);
      continue;
    }
    if (htmlBuf.length) {
      flushHtml();
    }
    if (!raw.trim()) {
      closeList();
      continue;
    }
    if (isTableRow(raw) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      closeList();
      const block = [raw, lines[i + 1]];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        block.push(lines[i]);
        i += 1;
      }
      i -= 1;
      renderTable(block);
      continue;
    }
    const heading = raw.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
      continue;
    }
    const ul = raw.match(/^[-*+]\s+(.*)$/);
    if (ul) {
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }
    const ol = raw.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${inline(raw)}</p>`);
  }
  flushHtml();
  if (inCode) html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  closeList();
  return sanitizeHtml(html.join("\n"));
}

function log(message, level = "info") {
  const box = $("log");
  if (!state.logCleared) {
    box.innerHTML = "";
    state.logCleared = true;
  }
  const line = document.createElement("div");
  line.className = level;
  line.textContent = `› ${message}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function setBusy(flag) {
  state.busy = flag;
  $("go").disabled = flag;
  $("confirmDeploy").disabled = flag;
}

function renderRepoEmpty() {
  $("repoCard").classList.add("empty");
  $("repoCard").innerHTML = `<div>${t("repoEmptyTitle")}</div><div style="font-size:12px">${t("repoEmptyHint")}</div>`;
}

function renderRepo(info) {
  const card = $("repoCard");
  card.classList.remove("empty");
  const release = info.release ? t("latest", { tag: info.release.tag }) : t("noRelease");
  const installer = info.has_installer
    ? t("hasInstaller", { n: info.installers.length })
    : t("noInstaller");
  card.innerHTML = `
    <div class="repo-head">
      <div>
        <h3>${escapeHtml(info.full_name)}</h3>
        <span>${escapeHtml(release)}</span>
      </div>
    </div>
    <p>${escapeHtml(info.description || t("noDesc"))}</p>
    <div class="stats">
      <span class="stat">★ ${info.stars}</span>
      <span class="stat">${escapeHtml(info.language || t("unknownLang"))}</span>
      <span class="stat">${escapeHtml(info.license || t("noLicense"))}</span>
      <span class="stat">${escapeHtml(t("defaultBranch", { branch: info.default_branch }))}</span>
      <span class="stat">${escapeHtml(installer)}</span>
    </div>
  `;
}

function prettySize(n) {
  if (!n) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

function fillReadmeSelect(readmes, selectedPath) {
  const sel = $("readmeLang");
  if (!readmes || !readmes.length) {
    sel.hidden = true;
    sel.innerHTML = "";
    return;
  }
  sel.hidden = false;
  sel.innerHTML = readmes
    .map((item) => {
      const label = item.lang === "default" ? `${t("langDefault")} (${item.name})` : `${item.label} · ${item.name}`;
      const on = item.path === selectedPath ? "selected" : "";
      return `<option value="${escapeHtml(item.path)}" ${on}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

async function loadReadme(info, path, fallbackNote) {
  const box = $("readme");
  box.classList.remove("empty");
  box.textContent = t("readmeLoad", { lang: path });
  try {
    const res = await fetch("/api/readme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: $("url").value.trim(),
        path,
        token: $("token").value.trim(),
        branch: info.default_branch,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || res.statusText);
    box.innerHTML = (fallbackNote ? `<p style="color:#e7c07a">${escapeHtml(fallbackNote)}</p>` : "") + renderMarkdown(data.markdown);
  } catch (err) {
    box.classList.add("empty");
    box.textContent = t("readmeFail", { msg: err.message || String(err) });
  }
}

function openModal(info) {
  $("modalText").textContent = t("modalBody", {
    name: info.full_name,
    tag: info.release?.tag || "Release",
  });
  $("assets").innerHTML = info.installers
    .map((asset, idx) => `
      <label class="asset">
        <input type="radio" name="asset" value="${idx}" ${idx === 0 ? "checked" : ""} />
        <div>
          <div>${escapeHtml(asset.name)}</div>
          <div style="color:#8b95a8;font-size:12px">${prettySize(asset.size)}</div>
        </div>
      </label>
    `)
    .join("");
  $("modal").classList.add("on");
}

function closeModal() {
  $("modal").classList.remove("on");
}

function selectedAsset() {
  const info = state.inspected;
  const idx = Number(document.querySelector('input[name="asset"]:checked')?.value || 0);
  return info?.installers?.[idx] || null;
}

async function inspect() {
  const res = await fetch("/api/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: $("url").value.trim(), token: $("token").value.trim() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Inspect failed");
  return data;
}

async function deploy(mode, asset) {
  setBusy(true);
  $("progress").classList.add("on");
  $("bar").style.width = "0%";
  log(mode === "installer" ? t("startInstaller") : t("startSource"));

  const res = await fetch("/api/deploy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: $("url").value.trim(),
      dest_root: $("dest").value.trim(),
      folder_name: $("folder").value.trim(),
      mode,
      asset_id: asset?.id || null,
      asset_name: asset?.name || "",
      download_url: asset?.download_url || "",
      token: $("token").value.trim(),
      run_installer: mode === "installer",
    }),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((x) => x.startsWith("data: "));
      if (!line) continue;
      const evt = JSON.parse(line.slice(6));
      if (evt.event === "log") log(evt.message, evt.level || "info");
      if (evt.event === "progress") $("bar").style.width = `${evt.percent || 0}%`;
      if (evt.event === "error") {
        log(evt.message, "error");
        setBusy(false);
      }
      if (evt.event === "done") {
        log(evt.mode === "installer" ? t("doneInstaller", { path: evt.path }) : t("doneSource", { path: evt.path }), "ok");
        $("bar").style.width = "100%";
        setBusy(false);
      }
    }
  }
  setBusy(false);
}

async function inspectOnly() {
  if (state.busy) return;
  try {
    setBusy(true);
    showReadmePhase();
    $("readme").classList.remove("empty");
    $("readme").textContent = t("inspectStart");
    const info = await inspect();
    state.inspected = info;
    if (!$("folder").value.trim()) $("folder").value = info.suggested_folder;
    renderRepo(info);

    const picked = pickReadme(info.readmes || []);
    fillReadmeSelect(info.readmes || [], picked?.item?.path);
    if (!picked) {
      $("readme").classList.add("empty");
      $("readme").textContent = t("readmeNone");
    } else {
      await loadReadme(info, picked.item.path, picked.fallback ? t("readmeFallback") : "");
    }
    $("confirmDeploy").hidden = false;
    setBusy(false);
  } catch (err) {
    $("readme").classList.add("empty");
    $("readme").textContent = err.message || String(err);
    $("confirmDeploy").hidden = true;
    setBusy(false);
  }
}

async function confirmDeployFlow() {
  if (state.busy || !state.inspected) return;
  const info = state.inspected;
  showProgressPhase();
  state.logCleared = false;
  $("log").innerHTML = `<div class="info">${t("waiting")}</div>`;
  log(t("located", { name: info.full_name }), "ok");
  if (info.has_installer) {
    openModal(info);
    return;
  }
  log(t("noMsi"));
  await deploy("source");
}

function paintDefaults() {
  const data = state.defaults;
  if (!data) return;
  if (data.prefer_d) $("platformChip").textContent = t("preferD");
  else if (data.is_windows) $("platformChip").textContent = t("noD");
  else $("platformChip").textContent = t("notWin");
  $("pathHint").textContent = data.prefer_d ? t("pathHintD", { path: data.dest_root }) : t("pathHint");
}

$("go").addEventListener("click", inspectOnly);
$("confirmDeploy").addEventListener("click", confirmDeployFlow);
$("url").addEventListener("keydown", (e) => {
  if (e.key === "Enter") inspectOnly();
});
$("chooseSource").addEventListener("click", async () => {
  closeModal();
  await deploy("source");
});
$("chooseInstall").addEventListener("click", async () => {
  const asset = selectedAsset();
  closeModal();
  if (!asset) {
    log(t("noAsset"), "warn");
    await deploy("source");
    return;
  }
  await deploy("installer", asset);
});
$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal")) closeModal();
});
$("pickDir").addEventListener("click", async () => {
  if (!window.showDirectoryPicker) {
    log(t("pickerWarn"), "warn");
    return;
  }
  try {
    const dir = await window.showDirectoryPicker({ mode: "readwrite" });
    $("dest").value = dir.name ? `${$("dest").value.split(/[\\/]/)[0] || "D:"}\\${dir.name}` : $("dest").value;
    log(t("pickerPicked", { name: dir.name }), "warn");
  } catch {
    /* cancelled */
  }
});
$("readmeLang").addEventListener("change", async () => {
  if (!state.inspected) return;
  await loadReadme(state.inspected, $("readmeLang").value, "");
});
$("uiLangSwitch").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-ui-lang]");
  if (!btn) return;
  state.uiLang = btn.dataset.uiLang;
  localStorage.setItem("deploy_desk_ui_lang", state.uiLang);
  applyI18n();
});

async function boot() {
  state.uiLang = detectUiLang();
  try {
    const res = await fetch("/api/defaults");
    state.defaults = await res.json();
    $("dest").value = state.defaults.dest_root;
  } catch {
    $("dest").value = "D:\\Projects";
  }
  applyI18n();
}

boot();
