# Venue AV setup and troubleshooting

## Pack list

- Dedicated Windows 11 laptop with charger
- Class-compliant USB interface with a true line input, gain control, and input meter
- Balanced XLR and TRS cables appropriate for the interface
- USB cable plus a spare; powered USB hub only if previously tested
- HDMI cable and the needed USB-C/DisplayPort adapters, each pretested
- DI box or transformer isolation option for ground-loop problems
- Ethernet cable and rehearsed phone hotspot
- Headphones for silent monitoring
- Backup cable from the wireless-microphone receiver when the venue permits it
- Printed one-page fallback and venue contact information
- Optional trusted AV router/network for local receiver testing; never rely on an untested guest WLAN

## Ask the DJ or venue

Request a **mic-only, post-fader auxiliary output**. Music, audience mics, room mics, and effects returns should be excluded. A matrix or recording output is acceptable only if it can provide that clean mix.

Connect the mixer output to an interface **line input**, not an instrument input. Start with interface gain low. Disable phantom power toward the mixer. Use balanced connections and transformer isolation when hum indicates a ground loop.

Never route the PA through the laptop or interface. The mixer continues to feed the PA independently.

## Five-minute startup

1. Connect the projector/TV and set Windows to extend the desktop.
2. Connect the USB interface, then select it in the app.
3. Have the DJ speak at ceremony level and set the meter mainly in the green, with no **CLIP** warning.
4. Choose caption-only fullscreen, the native click-through overlay, or the rehearsed OBS scene for the event visual workflow.
5. If using the native overlay, put PowerPoint/video in windowed or borderless mode and confirm the overlay does not intercept input.
6. Start captions and verify one English and one Vietnamese test utterance.
7. If local receivers are approved, start sharing only on the trusted private interface and pair a test phone.
8. Confirm AC power, network, hotspot readiness, and sleep/notification/update suppression.

The app prevents display sleep only while captions are active. Before the event, also enable Focus Assist, disable scheduled restarts, close sync tools, and select a non-sleeping Windows power profile.

## Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| No level | Wrong interface/input or muted aux | Confirm the selected Windows input, aux master, channel send, and cable |
| Level only during music | Wrong mixer bus | Request a mic-only auxiliary mix |
| Constant clipping | Mixer/interface level mismatch | Lower aux output or interface gain; confirm line rather than mic input |
| Very low/noisy signal | Input set to line with a mic-level feed, or unbalanced adapter | Match levels and use the correct balanced connection |
| 50/60 Hz hum | Ground loop | Run laptop on AC as planned, add transformer isolation, and avoid unsafe ground-lift adapters |
| Captions stop after USB movement | Device disconnect | Pause, reseat/replace cable, reselect the interface, then resume |
| Wrong language on short phrases | Language-ID uncertainty | Select English or Vietnamese manually for that speaker |
| Captions lag | Network, overloaded laptop, or noisy mix | Switch network, close other workloads, simplify OBS, and clean the aux mix |
| Native overlay disappears | Visual entered exclusive fullscreen | Return to windowed/borderless mode or use OBS |
| Receiver QR does not connect | Client isolation, wrong interface, firewall, or different subnet | Use the selected trusted network, remove guest isolation, and verify private-network firewall access to port 43118 |

If the selected device disappears, the app pauses. It never silently changes to the laptop microphone.
