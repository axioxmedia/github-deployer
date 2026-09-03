"""Axiox Media packer watermark and window-title helpers."""

from __future__ import annotations

import locale
import os
import sys

AIO_BRAND = "Axiox Media"
AXIOXMEDIA_MARK = "axioxmedia"
AXIOX_PACKER_ZH = "由安溯媒体自动打包，软件名："
AXIOX_PACKER_EN = "Packed via Axiox Media, software name: "
AIO_SOFTWARE_NAME_ZH = "GitHub 部署台"
AIO_SOFTWARE_NAME_EN = "GitHub Deploy Desk"


def axiox_os_is_chinese() -> bool:
    if os.name == "nt":
        try:
            import ctypes

            lang_id = ctypes.windll.kernel32.GetUserDefaultUILanguage()
            if (lang_id & 0xFF) == 0x04:
                return True
        except Exception:
            pass
    candidates = [
        os.environ.get("LANG", ""),
        os.environ.get("LANGUAGE", ""),
        locale.getlocale()[0] or "",
    ]
    try:
        candidates.append(locale.getdefaultlocale()[0] or "")
    except Exception:
        pass
    blob = " ".join(candidates).lower()
    return "zh" in blob or "chinese" in blob


def axiox_window_title(name_zh: str | None = None, name_en: str | None = None) -> str:
    chinese = axiox_os_is_chinese()
    product = name_zh if chinese else name_en
    product = product or (AIO_SOFTWARE_NAME_ZH if chinese else AIO_SOFTWARE_NAME_EN)
    prefix = AXIOX_PACKER_ZH if chinese else AXIOX_PACKER_EN
    return f"{prefix}{product}"


def aio_watermark() -> dict[str, str]:
    return {
        "brand": AIO_BRAND,
        "mark": AXIOXMEDIA_MARK,
        "title": axiox_window_title(),
        "frozen": str(getattr(sys, "frozen", False)),
    }
