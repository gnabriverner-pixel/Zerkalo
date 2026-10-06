"""Research-only transport injection; DCS source, prompts and canon remain unchanged."""
import os
import runpy
import sys
from urllib.parse import urlparse
sys.path.insert(0, os.getcwd())
from telegram_v2.albert import routerai

proxy = urlparse(os.environ.get("FIRST_SALES_PROXY_URL", ""))
if proxy.scheme != "http" or proxy.hostname != "127.0.0.1" or proxy.path not in ("", "/"):
    raise RuntimeError("bounded_proxy_required")
routerai.URL = os.environ["FIRST_SALES_PROXY_URL"].rstrip("/") + "/api/v1"
runpy.run_module("integration.dcs_service", run_name="__main__")
