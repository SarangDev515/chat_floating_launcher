# Floating Chat Launcher

Odoo 13 addon that moves the existing Discuss messaging menu from the top navigation bar to a fixed message button in the bottom-right corner.

## Behavior

- Removes the Discuss message icon from the top bar by relocating the original widget.
- Shows the same message icon as a circular bottom-right launcher.
- Preserves unread counters, conversation previews, filters, new-message action, and standard Discuss behavior.
- Uses responsive positioning on small screens.
- Does not modify Odoo core files.

## Installation

1. Restart the Odoo 13 server.
2. Open Apps, enable developer mode, and click **Update Apps List**.
3. Install **Floating Chat Launcher**.
4. Hard-refresh the browser with `Ctrl+Shift+R`.

The addon is located at `D:\odoo-13.0\extra_addons\chat_floating_launcher`.
