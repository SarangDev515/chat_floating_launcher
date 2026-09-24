odoo.define('chat_floating_launcher.chat_request', function (require) {
    'use strict';


    var BasicComposer = require('mail.composer.Basic');
    var ExtendedComposer = require('mail.composer.Extended');
    var MailManager = require('mail.Manager');
    var ThreadWidget = require('mail.widget.Thread');
    var core = require('web.core');
    var Dialog = require('web.Dialog');
    var rpc = require('web.rpc');
    var session = require('web.session');

    var _t = core._t;

    ThreadWidget.include({
        render: function () {
            var thread = arguments[0];
            var result = this._super.apply(this, arguments);
            var messages = this._messages || [];
            var self = this;
            _.each(messages, function (message) {
                var messageElement = self.$('.o_thread_message[data-message-id="' + message.getID() + '"]');
                if (!messageElement.length || typeof message.isMyselfAuthor !== 'function') {
                    return;
                }
                var isMine = message.isMyselfAuthor();
                messageElement
                    .toggleClass('o_thread_message_mine', isMine)
                    .toggleClass('o_thread_message_incoming', !isMine);
                self._decorateChatMessage(messageElement, message, thread);
            });
            return result;
        },

        _decorateChatMessage: function (messageElement, message, thread) {
            var content = messageElement.find('.o_thread_message_content').first();
            if (!content.length) {
                return;
            }

            content.find('.o_chat_message_meta').remove();
            messageElement.find('.o_mail_info .o_mail_timestamp').remove();

            var meta = $('<span class="o_chat_message_meta"/>');
            $('<span class="o_chat_message_time"/>')
                .text(message.getDate().format('h:mm A'))
                .appendTo(meta);

            if (message.isMyselfAuthor()) {
                var hasSeen = thread.hasSomeoneSeen && thread.hasSomeoneSeen(message);
                var hasFetched = thread.hasSomeoneFetched && thread.hasSomeoneFetched(message);
                var tickClass = hasSeen ? 'o_chat_message_ticks_seen' :
                    (hasFetched ? 'o_chat_message_ticks_delivered' : 'o_chat_message_ticks_sent');
                var ticks = messageElement.find('.o_mail_thread_message_seen_icon').first();
                if (ticks.length) {
                    ticks.detach()
                        .addClass('o_chat_message_ticks ' + tickClass)
                        .appendTo(meta);
                } else {
                    ticks = $('<span class="o_chat_message_ticks ' + tickClass + '"/>');
                    $('<i class="fa fa-check"/>').appendTo(ticks);
                    if (hasSeen || hasFetched) {
                        $('<i class="fa fa-check"/>').appendTo(ticks);
                    }
                    ticks.appendTo(meta);
                }
            }
            meta.appendTo(content);
        },
    });

    function canCreateRequest(composer) {
        return !!session.chat_request_enabled &&
            composer.options.thread &&
            composer.options.thread.getType() === 'dm_chat';
    }

    var RequestDialog = Dialog.extend({
        template: 'chat_floating_launcher.RequestDialog',

        init: function (parent, thread) {
            this._thread = thread;
            this._super(parent, {
                title: _t('New Request'),
                size: 'medium',
                dialogClass: 'o_chat_request_modal',
                buttons: [{
                    text: _t('Send Request'),
                    classes: 'btn-primary',
                    close: false,
                    click: this._onSubmit.bind(this),
                }, {
                    text: _t('Cancel'),
                    close: true,
                }],
            });
        },

        start: function () {
            this._$title = this.$('.o_chat_request_title_input');
            this._$description = this.$('.o_chat_request_description_input');
            return this._super.apply(this, arguments);
        },

        _onSubmit: function () {
            var title = (this._$title.val() || '').trim();
            var description = (this._$description.val() || '').trim();
            if (!title || !description) {
                this.do_warn(_t('Missing information'), _t('Enter both a title and a description.'));
                return Promise.resolve();
            }

            var self = this;
            return rpc.query({
                model: 'chat.request',
                method: 'create_request',
                args: [this._thread.getID(), title, description],
            }).then(function () {
                self.do_notify(_t('Request sent'), _t('The request was sent to the recipient.'));
                self.close();
            });
        },
    });

    var DecisionDialog = Dialog.extend({
        template: 'chat_floating_launcher.DecisionDialog',

        init: function (parent, requestID, decision) {
            this._requestID = requestID;
            this._decision = decision;
            this._super(parent, {
                title: decision === 'approved' ? _t('Accept Request') : _t('Reject Request'),
                size: 'medium',
                dialogClass: 'o_chat_request_modal',
                buttons: [{
                    text: decision === 'approved' ? _t('Confirm Accept') : _t('Confirm Reject'),
                    classes: decision === 'approved' ? 'btn-success' : 'btn-danger',
                    close: false,
                    click: this._onSubmit.bind(this),
                }, {
                    text: _t('Cancel'),
                    close: true,
                }],
            });
        },

        start: function () {
            this._$reason = this.$('.o_chat_request_decision_reason_input');
            return this._super.apply(this, arguments);
        },

        _onSubmit: function () {
            var reason = (this._$reason.val() || '').trim();
            if (!reason) {
                this.do_warn(_t('Missing reason'), _t('Enter a reason before confirming this decision.'));
                return Promise.resolve();
            }

            var self = this;
            return rpc.query({
                model: 'chat.request',
                method: 'action_decide',
                args: [[this._requestID], this._decision, reason],
            }).then(function (result) {
                self.close();
                applyDecisionToClient(result);
            }).guardedCatch(function () {
                self.$footer.find('button').prop('disabled', false);
            });
        },
    });

    var composerEvents = _.extend({}, BasicComposer.prototype.events, {
        'click .o_composer_request_button': '_onRequestButtonClick',
    });

    BasicComposer.include({
        events: composerEvents,

        start: function () {
            var result = this._super.apply(this, arguments);
            this._ensureChatRequestButton();
            this._updateChatRequestButton();
            return result;
        },

        setThread: function (thread) {
            var result = this._super.apply(this, arguments);
            this._ensureChatRequestButton();
            this._updateChatRequestButton();
            return result;
        },

        canCreateChatRequest: function () {
            return canCreateRequest(this);
        },

        _ensureChatRequestButton: function () {
            if (!this.$('.o_composer_request_button').length) {
                this.$('.o_chatter_composer_tools').append(
                    '<button tabindex="6" class="btn btn-secondary fa fa-handshake-o o_composer_request_button" type="button" title="New Request" aria-label="New Request"/>'
                );
            }
        },

        _updateChatRequestButton: function () {
            this.$('.o_composer_request_button').toggleClass('d-none', !canCreateRequest(this));
        },

        _onRequestButtonClick: function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            new RequestDialog(this, this.options.thread).open();
        },
    });

    ExtendedComposer.include({
        events: _.extend({}, ExtendedComposer.prototype.events, {
            'click .o_composer_request_button': '_onRequestButtonClick',
        }),
    });

    function applyDecisionToClient(result) {
        if (!result || !result.message_id) {
            return;
        }
        var mailService = core.bus && core.bus._services && core.bus._services.mail_service;
        var message = mailService && mailService.getMessage(result.message_id);
        if (message) {
            message._body = result.body;
            mailService.getMailBus().trigger('update_message', message);
        }
        var selector = '.o_chat_request_id_' + result.request_id;
        var card = $(selector).first();
        if (card.length) {
            card.replaceWith(result.body);
            ensureRequestActions(document);
            restrictRequestActions(document);
        }
    }

    function cardUserID(card, prefix) {
        var classes = (card.attr('class') || '').split(/\s+/);
        var matchingClass = _.find(classes, function (className) {
            return className.indexOf(prefix) === 0;
        });
        return matchingClass ? parseInt(matchingClass.slice(prefix.length), 10) : false;
    }

    function alignThreadMessages(root) {
        var mailService = core.bus && core.bus._services && core.bus._services.mail_service;
        if (!mailService || !mailService.getMessage) {
            return;
        }
        $(root).find('.o_thread_message[data-message-id]').each(function () {
            var messageElement = $(this);
            var messageID = parseInt(messageElement.attr('data-message-id'), 10);
            var message = mailService.getMessage(messageID);
            if (!message || typeof message.isMyselfAuthor !== 'function') {
                return;
            }
            var isMine = message.isMyselfAuthor();
            messageElement
                .toggleClass('o_thread_message_mine', isMine)
                .toggleClass('o_thread_message_incoming', !isMine);
        });
    }

    function ensureRequestActions(root) {
        alignThreadMessages(root);
        $(root).find('.o_chat_request_pending').each(function () {
            var card = $(this);
            if (card.find('.o_chat_request_actions').length && card.find('.o_chat_request_actions button').length) {
                return;
            }
            var requestID = cardUserID(card, 'o_chat_request_id_');
            if (!requestID) {
                return;
            }
            var actions = $(
                '<div class="o_chat_request_actions">'
                + '<button type="button" class="btn btn-success btn-sm o_chat_request_approve">Accept</button>'
                + '<button type="button" class="btn btn-danger btn-sm o_chat_request_reject">Reject</button>'
                + '<button type="button" class="btn btn-secondary btn-sm o_chat_request_cancel">Cancel</button>'
                + '</div>'
            );
            actions.find('button').attr('data-request-id', requestID);
            card.find('.o_chat_request_actions').remove();
            card.append(actions);
        });
    }

    function restrictRequestActions(root) {
        var currentUserID = parseInt(session.uid, 10);
        var currentPartnerID = parseInt(session.partner_id, 10);
        if (!currentUserID && !currentPartnerID) {
            return;
        }
        $(root).find('.o_chat_request').each(function () {
            var card = $(this);
            var recipientUserID = cardUserID(card, 'o_chat_request_recipient_');
            var requesterUserID = cardUserID(card, 'o_chat_request_requester_');
            var recipientPartnerID = cardUserID(card, 'o_chat_request_recipient_partner_');
            var requesterPartnerID = cardUserID(card, 'o_chat_request_requester_partner_');
            var isRecipient = recipientUserID === currentUserID || recipientPartnerID === currentPartnerID;
            var isRequester = requesterUserID === currentUserID || requesterPartnerID === currentPartnerID;
            var canDecide = session.chat_request_can_decide === true;
            var canCancel = session.chat_request_can_cancel === true;
            if (!isRecipient || !canDecide) {
                card.find('.o_chat_request_approve, .o_chat_request_reject').remove();
            }
            if (!isRequester || !canCancel) {
                card.find('.o_chat_request_cancel').remove();
            }
            if (!isRecipient && !isRequester) {
                card.find('.o_chat_request_actions').remove();
            }
        });
    }

    $(document).off('click.chat_request', '.o_chat_request_approve, .o_chat_request_reject, .o_chat_request_cancel');
    $(document).on('click.chat_request', '.o_chat_request_approve, .o_chat_request_reject, .o_chat_request_cancel', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var button = $(this);
        var card = button.closest('.o_chat_request');
        var requestID = cardUserID(card, 'o_chat_request_id_');
        var isCancel = button.hasClass('o_chat_request_cancel');
        var decision = button.hasClass('o_chat_request_approve') ? 'approved' : 'rejected';
        if (!isCancel) {
            new DecisionDialog(null, requestID, decision).open();
            return;
        }

        card.find('button').prop('disabled', true);
        rpc.query({
            model: 'chat.request',
            method: 'action_cancel',
            args: [[requestID]],
        }).then(function (result) {
            applyDecisionToClient(result);
        }).guardedCatch(function () {
            card.find('button').prop('disabled', false);
        });
    });

    // Apply recipient-only visibility after Discuss renders or rerenders a message.
    var observer = new MutationObserver(function () {
        ensureRequestActions(document);
        restrictRequestActions(document);
    });
    $(function () {
        ensureRequestActions(document);
        restrictRequestActions(document);
        // Normal-user sessions can finish restoring session_info after Discuss renders.
        // Retry without removing actions while the identity is still unavailable.
        [250, 750, 1500].forEach(function (delay) {
            window.setTimeout(function () {
                ensureRequestActions(document);
                restrictRequestActions(document);
            }, delay);
        });
        if (document.body) {
            observer.observe(document.body, {childList: true, subtree: true});
        }
    });

    // Handle the custom channel bus event sent when the recipient decides.
    MailManager.include({
        _handleChannelNotification: function (params) {
            if (params.data && params.data.info === 'chat_request_update') {
                var message = this.getMessage(params.data.message_id);
                if (message) {
                    message._body = params.data.body;
                    this._mailBus.trigger('update_message', message);
                }
                return;
            }
            return this._super.apply(this, arguments);
        },
    });

    return RequestDialog;
});
