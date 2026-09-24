# -*- coding: utf-8 -*-

from odoo import models
from odoo.http import request


class Http(models.AbstractModel):
    _inherit = 'ir.http'

    def session_info(self):
        result = super(Http, self).session_info()
        user = request.env.user
        result['chat_request_enabled'] = bool(request.session.uid and user.chat_request_enabled)
        result['chat_request_can_decide'] = bool(
            request.session.uid and user.has_group('chat_floating_launcher.group_chat_request_accept_reject')
        )
        result['chat_request_can_cancel'] = bool(
            request.session.uid and user.has_group('chat_floating_launcher.group_chat_request_cancel')
        )
        return result
