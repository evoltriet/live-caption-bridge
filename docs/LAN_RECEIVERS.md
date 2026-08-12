# Local receiver setup

Local receivers provide read-only captions to nearby browsers, phones, tablets, or browser-capable glasses. Sharing is off by default and never creates a public internet endpoint.

## Security model

- The loopback display server remains private to the host at `127.0.0.1:43117`.
- The operator explicitly selects a private IPv4 interface and starts a second service on port `43118`.
- A new 128-bit token is placed after `#token=` in the QR URL. URL fragments are not included in the initial HTTP request.
- The receiver sends the token as its first WebSocket message. It receives no captions before successful authentication.
- Up to 50 authenticated clients are allowed. Receivers cannot publish messages or control the host.
- Stop-sharing and session-end close connections and invalidate the token.

Traffic is authenticated but not encrypted. Use only a trusted venue network. Anyone who can see or photograph the QR code can join until the operator stops sharing, so keep the QR on the operator display and rotate it by restarting sharing if exposed.

## Operator steps

1. Connect the host and receiver devices to the same trusted venue network. Prefer a dedicated AV VLAN or private travel router rather than guest Wi-Fi with client isolation.
2. Start the caption session.
3. In **Nearby read-only receivers**, select the correct private network interface.
4. Select **Start local sharing** and acknowledge the unencrypted-LAN warning.
5. Let intended viewers scan the QR code. Confirm the connected-client count changes.
6. Viewers select `Bilingual`, `English`, `Tiếng Việt`, or `Glance`. Glance also lets them choose the displayed language.
7. Select **Stop sharing** after the speech or immediately if the code is exposed.

If a phone cannot connect, verify that it is on the same subnet, guest client isolation is disabled, Windows Firewall allows the app on the selected private network, and port `43118` is not in use. Do not expose or forward the port through the venue router.

## Portable-client contract

Native mobile and smart-glass clients should use `@live-caption-bridge/caption-protocol` and `@live-caption-bridge/caption-client`. They must preserve version checking, first-message authentication, read-only behavior, and explicit user profile selection. Device-specific native apps and cloud relay remain backlog items.
