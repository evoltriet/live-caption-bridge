# OBS setup

OBS is optional. Use the app's direct fullscreen button for a projector that shows only captions. Use OBS when captions must sit over a camera, slides, or a livestream.

## 1920×1080 browser source

1. Start Wedding Live Captions.
2. In OBS, add **Browser** as a source.
3. Set URL to `http://127.0.0.1:43117/overlay?mode=obs`.
4. Set width to **1920**, height to **1080**, and custom frame rate to **30 FPS**.
5. Leave **Shutdown source when not visible** off so scene changes do not discard state.
6. Leave **Refresh browser when scene becomes active** off; use **Refresh cache** only during recovery.
7. Put the caption source above the camera/slides sources.

The route itself has a transparent page background and dark gradients behind each caption lane. OBS's browser source supports transparent web pages; see the official [Browser Source guide](https://obsproject.com/kb/browser-source).

## Projector output

Set OBS base/output canvas to the display resolution. Right-click the program scene and choose **Fullscreen Projector (Program)**, then select the venue screen. OBS documents program, scene, and source projector outputs in [Power of Projectors](https://obsproject.com/kb/power-of-projectors).

## Recovery rehearsal

- Change scenes repeatedly while someone speaks.
- Hide/show the browser source and confirm it reconnects.
- Use **Refresh cache of current page** and confirm captions return.
- Disconnect/reconnect the external display and restore the fullscreen projector.
- Run OBS plus captions for two hours while monitoring dropped frames, rendering lag, CPU/GPU use, temperature, and memory.

The combined workload must retain at least 20% sustained compute headroom and show no thermal throttling or OBS instability.
