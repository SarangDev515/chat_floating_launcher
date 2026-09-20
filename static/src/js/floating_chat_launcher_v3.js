odoo.define('chat_floating_launcher.relocate_messaging_menu', function (require) {
    'use strict';

    setTimeout(function () {
        require('chat_floating_launcher.chat_request');
    }, 2000);
    var MessagingMenu = require('mail.systray.MessagingMenu');
    var SystrayMenu = require('web.SystrayMenu');

    SystrayMenu.include({
        start: function () {
            return this._super.apply(this, arguments).then(function () {
                var messagingWidget = _.find(this.widgets, function (widget) {
                    return widget instanceof MessagingMenu || widget.name === 'messaging_menu';
                });

                if (messagingWidget && messagingWidget.$el) {
                    messagingWidget.$el
                        .addClass('o_chat_floating_launcher')
                        .appendTo(document.body);
                }
            }.bind(this));
        },
    });
});
