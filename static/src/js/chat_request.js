import { Message } from "@mail/core/common/message";
import { registerComposerAction } from "@mail/core/common/composer_actions";

import { Component, markup, onMounted, onPatched, onWillDestroy, useState } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { _t } from "@web/core/l10n/translation";
import { session } from "@web/session";
import { user } from "@web/core/user";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";


export class ChatRequestDialog extends Component {
    static components = { Dialog };
    static props = ["close", "onConfirm", "title?"];
    static defaultProps = { title: _t("New Chat Request") };
    static template = "chat_floating_launcher_19.ChatRequestDialog";

    setup() {
        this.state = useState({ title: "", description: "" });
    }

    get canSubmit() {
        return Boolean(this.state.title.trim() && this.state.description.trim());
    }

    async confirm() {
        if (!this.canSubmit) {
            return;
        }
        await this.props.onConfirm({
            title: this.state.title.trim(),
            description: this.state.description.trim(),
        });
        this.props.close();
    }
}

export class ChatRequestDecisionDialog extends Component {
    static components = { Dialog };
    static props = ["close", "decision", "onConfirm"];
    static template = "chat_floating_launcher_19.ChatRequestDecisionDialog";

    setup() {
        this.state = useState({ reason: "" });
    }

    get heading() {
        return this.props.decision === "approved" ? _t("Accept Chat Request") : _t("Reject Chat Request");
    }

    get canSubmit() {
        return Boolean(this.state.reason.trim());
    }

    async confirm() {
        if (!this.canSubmit) {
            return;
        }
        await this.props.onConfirm(this.state.reason.trim());
        this.props.close();
    }
}

registerComposerAction("chat-request", {
    condition: ({ composer }) =>
        Boolean(
            session.chat_request_enabled &&
            composer.targetThread?.model === "discuss.channel" &&
            composer.targetThread?.channel_type === "chat"
        ),
    icon: "fa fa-handshake-o",
    name: _t("New Chat Request"),
    onSelected: ({ composer, owner }) => {
        const dialog = owner.env.services.dialog;
        const orm = owner.env.services.orm;
        const notification = owner.env.services.notification;
        dialog.add(ChatRequestDialog, {
            onConfirm: async ({ title, description }) => {
                await orm.call("chat.request", "create_request", [
                    composer.targetThread.id,
                    title,
                    description,
                ]);
                notification.add(_t("Chat request sent."), { type: "success" });
            },
        });
    },
    sequence: 15,
});

function getRequestButton(target) {
    return target?.closest?.("button[data-request-id], a[data-request-id], .o_chat_request_approve, .o_chat_request_reject, .o_chat_request_cancel");
}

function getRequestId(button) {
    const requestId = Number(button?.dataset?.requestId);
    if (requestId) {
        return requestId;
    }
    const requestCard = button?.closest?.(".o_chat_request");
    const requestClass = Array.from(requestCard?.classList || []).find((name) => name.startsWith("o_chat_request_id_"));
    return Number(requestClass?.slice("o_chat_request_id_".length));
}

function isRequestMessage(message) {
    return Boolean(message?.body?.includes?.("o_chat_request_id_"));
}

patch(Message.prototype, {
    setup() {
        super.setup(...arguments);
        this.chatRequestBus = useService("bus_service");
        this.chatRequestOrm = useService("orm");
        this.chatRequestDialog = useService("dialog");
        this.chatRequestNotification = useService("notification");
        this.chatRequestOnClick = (ev) => this.onChatRequestClick(ev);
        this.chatRequestOnBusUpdate = (payload) => {
            if (payload.message_id === this.props.message.id) {
                this.props.message.update({ body: markup(payload.body) });
                this.updateChatRequestActionVisibility();
            }
        };
        onMounted(() => {
            if (!isRequestMessage(this.props.message)) {
                return;
            }
            this.chatRequestBus.subscribe("chat_request_update", this.chatRequestOnBusUpdate);
            this.root.el?.addEventListener("click", this.chatRequestOnClick);
            this.updateChatRequestActionVisibility();
        });
        onPatched(() => this.updateChatRequestActionVisibility());
        onWillDestroy(() => {
            this.chatRequestBus.unsubscribe("chat_request_update", this.chatRequestOnBusUpdate);
            this.root.el?.removeEventListener("click", this.chatRequestOnClick);
        });
    },

    updateChatRequestActionVisibility() {
        if (!this.root.el) {
            return;
        }
        const requestCard = this.root.el.matches?.(".o_chat_request")
            ? this.root.el
            : this.root.el.querySelector(".o_chat_request");
        if (!requestCard) {
            return;
        }
        const isRequester = requestCard.classList.contains(`o_chat_request_requester_${user.userId}`);
        const isRecipient = requestCard.classList.contains(`o_chat_request_recipient_${user.userId}`);
        for (const button of requestCard.querySelectorAll(".o_chat_request_approve, .o_chat_request_reject")) {
            button.classList.toggle("d-none", !(session.chat_request_can_decide && isRecipient));
        }
        for (const button of requestCard.querySelectorAll(".o_chat_request_cancel")) {
            button.classList.toggle("d-none", !(session.chat_request_can_cancel && isRequester));
        }
    },

    onChatRequestClick(ev) {
        const button = getRequestButton(ev.target);
        if (!button) {
            return;
        }
        ev.preventDefault();
        ev.stopPropagation();
        const requestId = getRequestId(button);
        if (!requestId) {
            return;
        }
        if (button.classList.contains("o_chat_request_cancel")) {
            this.cancelChatRequest(requestId);
        } else if (button.classList.contains("o_chat_request_approve")) {
            this.decideChatRequest(requestId, "approved");
        } else if (button.classList.contains("o_chat_request_reject")) {
            this.decideChatRequest(requestId, "rejected");
        }
    },

    decideChatRequest(requestId, decision) {
        if (!session.chat_request_can_decide) {
            this.chatRequestNotification.add(_t("You are not allowed to decide this request."), { type: "warning" });
            return;
        }
        this.chatRequestDialog.add(ChatRequestDecisionDialog, {
            decision,
            onConfirm: async (reason) => {
                const result = await this.chatRequestOrm.call(
                    "chat.request",
                    "action_decide",
                    [[requestId], decision, reason]
                );
                this.props.message.update({ body: markup(result.body) });
                this.chatRequestNotification.add(
                    decision === "approved" ? _t("Chat request accepted.") : _t("Chat request rejected."),
                    { type: "success" }
                );
            },
        });
    },

    async cancelChatRequest(requestId) {
        if (!session.chat_request_can_cancel) {
            this.chatRequestNotification.add(_t("You are not allowed to cancel this request."), { type: "warning" });
            return;
        }
        const result = await this.chatRequestOrm.call("chat.request", "action_cancel", [[requestId]]);
        this.props.message.update({ body: markup(result.body) });
        this.chatRequestNotification.add(_t("Chat request cancelled."), { type: "success" });
    },
});
