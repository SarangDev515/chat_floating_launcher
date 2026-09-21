# Floating Chat Launcher 19

Odoo 19 port of the floating Discuss launcher and direct chat-request workflow.

## Download Odoo 19 addon

- [Download the v19.0.1.0.0 release ZIP](https://github.com/SarangDev515/chat_floating_launcher/archive/refs/tags/v19.0.1.0.0.zip)
- [Open the GitHub release page](https://github.com/SarangDev515/chat_floating_launcher/releases/tag/v19.0.1.0.0)
- [Browse the odoo-19 source branch](https://github.com/SarangDev515/chat_floating_launcher/tree/odoo-19)

- [Browse the Odoo 13 branch](https://github.com/SarangDev515/chat_floating_launcher/tree/odoo-13)


## Features

- Moves the standard Discuss systray menu to a responsive bottom-right launcher.
- Preserves Odoo Discuss chats, channels, notifications, counters, search, and actions.
- Adds a request action to direct-chat composers.
- Request cards support recipient Accept/Reject and requester Cancel actions.
- Decisions require a reason and are sent to the conversation through Odoo's bus.
- Uses Odoo 19 Owl assets and `discuss.channel`; no Odoo core files are modified.

## Installation

1. Add this folder to the Odoo 19 `addons_path`.
2. Restart Odoo.
3. Enable developer mode and update the Apps list.
4. Install **Floating Chat Launcher 19**.
5. Hard-refresh the browser after installing or upgrading.

The two decision groups are available under the Usability category. Users can enable
or disable request creation from their user preferences.
