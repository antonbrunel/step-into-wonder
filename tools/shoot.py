#!/usr/bin/env python3
"""Capture l'intro en temps réel via CDP : un run continu, screenshots datés.
Usage: shoot.py <url> <outprefix> <t_ms,...> [throttle_kbps] [mouse=x,y,t_ms]"""
import asyncio, base64, json, subprocess, sys, time, urllib.request

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 9333

async def main():
    url, prefix = sys.argv[1], sys.argv[2]
    throttle, mouse = 0, None
    for arg in sys.argv[4:]:
        if arg.startswith("mouse="):
            mx, my, mt = (int(v) for v in arg[6:].split(","))
            mouse = (mt, mx, my)
        else:
            throttle = int(arg)
    actions = [(t, "shot") for t in (int(x) for x in sys.argv[3].split(","))]
    if mouse:
        actions.append((mouse[0], "mouse"))
    actions.sort()

    proc = subprocess.Popen(
        [CHROME, "--headless=new", "--disable-gpu", f"--remote-debugging-port={PORT}",
         "--remote-allow-origins=*", "--no-first-run", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws_url = None
        for _ in range(50):
            try:
                tabs = json.load(urllib.request.urlopen(f"http://localhost:{PORT}/json/list"))
                pages = [t for t in tabs if t.get("type") == "page"]
                if pages:
                    ws_url = pages[0]["webSocketDebuggerUrl"]
                    break
            except Exception:
                pass
            time.sleep(0.2)
        if not ws_url:
            sys.exit("CDP introuvable")

        import websockets
        async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
            mid = 0
            async def cmd(method, params=None):
                nonlocal mid
                mid += 1
                await ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get("id") == mid:
                        return msg.get("result", {})

            await cmd("Page.enable")
            await cmd("Emulation.setDeviceMetricsOverride",
                      {"width": 1440, "height": 810, "deviceScaleFactor": 1, "mobile": False})
            if throttle:
                await cmd("Network.enable")
                bps = throttle * 1024 // 8
                await cmd("Network.emulateNetworkConditions",
                          {"offline": False, "latency": 40,
                           "downloadThroughput": bps, "uploadThroughput": bps})
            t_nav = time.monotonic()
            await cmd("Page.navigate", {"url": url})
            for t, kind in actions:
                delay = t / 1000 - (time.monotonic() - t_nav)
                if delay > 0:
                    await asyncio.sleep(delay)
                if kind == "mouse":
                    await cmd("Input.dispatchMouseEvent",
                              {"type": "mouseMoved", "x": mouse[1], "y": mouse[2]})
                    print(f"✓ souris ({mouse[1]},{mouse[2]}) t={t}ms")
                else:
                    shot = await cmd("Page.captureScreenshot", {"format": "png"})
                    with open(f"{prefix}{t}.png", "wb") as f:
                        f.write(base64.b64decode(shot["data"]))
                    print(f"✓ t={t}ms")
    finally:
        proc.terminate()

asyncio.run(main())
