# -*- coding: utf-8 -*-

from odoo import fields, models


class Users(models.Model):
    _inherit = 'res.users'

    chat_request_enabled = fields.Boolean(
        string='Enable Chat Requests',
        default=True,
        help='Allow this user to create request cards in direct Discuss conversations.',
    )
