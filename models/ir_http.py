from odoo import models


class IrHttp(models.AbstractModel):
    _inherit = 'ir.http'

    def session_info(self):
        result = super().session_info()
        user = self.env.user
        result['chat_request_enabled'] = bool(user.chat_request_enabled)
        result['chat_request_can_decide'] = bool(
            user.has_group('chat_floating_launcher_19.group_chat_request_accept_reject')
        )
        result['chat_request_can_cancel'] = bool(
            user.has_group('chat_floating_launcher_19.group_chat_request_cancel')
        )
        return result
