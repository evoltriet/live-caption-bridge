# Presentation overlay and OBS setup

## Choose the output path

- Use **Open fullscreen** when the projector should show captions only.
- Use **Show overlay** when PowerPoint, browser video, or VLC runs on the caption laptop's Windows desktop.
- Use OBS when combining captions with cameras, livestreams, external visual sources, or exclusive-fullscreen media.

## Native click-through overlay

1. Put the presentation/video on the intended output display in windowed or borderless mode.
2. In Live Caption Bridge, select that display.
3. Choose `Bilingual`, `English`, `Vietnamese`, or `Glance`.
4. Choose top/center/bottom placement, width, text scale, background treatment, and surface opacity.
5. Select **Show overlay**. The overlay is always-on-top, non-focusable, and click-through.
6. Operate the visual normally and verify that mouse and keyboard input reach it.
7. Keep the operator console reachable on another display; select **Close overlay** to remove it.

Windows applications using exclusive fullscreen can cover desktop overlays. Configure PowerPoint to present in a window, use borderless playback, or switch to OBS. Rehearse the exact PowerPoint version, video player, display adapter, and projector.

## OBS browser source at 1920×1080

1. Start Live Caption Bridge.
2. In OBS, add **Browser** as a source.
3. Set URL to `http://127.0.0.1:43117/overlay?mode=obs`.
4. Set width to **1920**, height to **1080**, and custom frame rate to **30 FPS**.
5. Leave **Shutdown source when not visible** off so scene changes do not discard state.
6. Leave **Refresh browser when scene becomes active** off; use **Refresh cache** only during recovery.
7. Put the caption source above the camera/slides sources.

The route has a transparent page background and lower-third caption surfaces. OBS supports transparent browser pages; see its [Browser Source guide](https://obsproject.com/kb/browser-source).

## Projector output

Set the OBS base/output canvas to the display resolution. Right-click the program scene, choose **Fullscreen Projector (Program)**, and select the venue screen. See OBS [Power of Projectors](https://obsproject.com/kb/power-of-projectors).

## Recovery rehearsal

- Switch PowerPoint slides and interact with video while the native overlay is open.
- Test top, center, and bottom placement at 720p, 1080p, and 4K.
- Enter and leave exclusive fullscreen so the operator recognizes when OBS is required.
- Change OBS scenes, hide/show the browser source, and refresh its cache.
- Disconnect/reconnect the external display and restore the selected output.
- Run the exact OBS collection plus captions for two hours while monitoring dropped frames, rendering lag, CPU/GPU use, temperature, and memory.

The combined workload must retain at least 20% sustained compute headroom with no thermal throttling or OBS instability.
