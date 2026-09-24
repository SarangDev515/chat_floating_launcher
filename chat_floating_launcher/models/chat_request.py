# -*- coding: utf-8 -*-

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tools.misc import html_escape


class ChatRequest(models.Model):
    _name = 'chat.request'
    _description = 'Discuss Chat Request'
    _order = 'create_date desc, id desc'

    name = fields.Char(string='Title', required=True)
    description = fields.Text(string='Description', required=True)
    channel_id = fields.Many2one('mail.channel', string='Conversation', required=True, ondelete='cascade', index=True)
    message_id = fields.Many2one('mail.message', string='Request Message', ondelete='cascade', index=True)
    requester_id = fields.Many2one('res.users', string='Requester', required=True, default=lambda self: self.env.user, ondelete='restrict')
    recipient_id = fields.Many2one('res.users', string='Recipient', required=True, ondelete='restrict')
    state = fields.Selection([
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ], string='Status', required=True, default='pending', index=True)
    decided_by = fields.Many2one('res.users', string='Decided By', readonly=True, ondelete='set null')
    decided_at = fields.Datetime(string='Decision Date', readonly=True)
    decision_reason = fields.Text(string='Decision Reason', readonly=True)

    _sql_constraints = [
        ('request_message_unique', 'unique(message_id)', 'A request can only have one chat message.'),
    ]

    @api.model
    def create_request(self, channel_id, title, description):
        """Create a request in a direct user-to-user Discuss conversation."""
        user = self.env.user
        if not user.chat_request_enabled:
            raise UserError(_('Chat requests are disabled for your user.'))

        channel = self.env['mail.channel'].browse(int(channel_id)).exists()
        if not channel or channel.channel_type != 'chat' or channel.public != 'private':
            raise UserError(_('Requests can only be created in direct user-to-user chats.'))

        if user.partner_id not in channel.channel_partner_ids:
            raise AccessError(_('You are not a member of this conversation.'))

        partners = channel.channel_partner_ids
        if len(partners) != 2:
            raise UserError(_('Requests are available only in direct user-to-user chats.'))

        recipient_partner = partners - user.partner_id
        recipient = recipient_partner.user_ids.filtered(lambda record: record.active)[:1]
        if not recipient:
            raise UserError(_('The other participant is not linked to an active user.'))

        title = (title or '').strip()
        description = (description or '').strip()
        if not title:
            raise ValidationError(_('A request title is required.'))
        if not description:
            raise ValidationError(_('A request description is required.'))

        request_record = self.create({
            'name': title,
            'description': description,
            'channel_id': channel.id,
            'requester_id': user.id,
            'recipient_id': recipient.id,
        })
        message = channel.message_post(
            body=request_record._render_body(),
            message_type='comment',
            subtype='mail.mt_comment',
            partner_ids=[recipient_partner.id],
        )
        request_record.write({'message_id': message.id})
        return {
            'request_id': request_record.id,
            'message_id': message.id,
            'state': request_record.state,
        }

    def action_decide(self, decision, reason=None):
        """Approve or reject a pending request for authorized recipients."""
        self.ensure_one()
        if not self.env.user.has_group('chat_floating_launcher.group_chat_request_accept_reject'):
            raise AccessError(_('You need the Chat Request: Accept/Reject group to decide requests.'))
        if self.recipient_id != self.env.user:
            raise AccessError(_('Only the request recipient can approve or reject this request.'))
        if decision not in ('approved', 'rejected'):
            raise ValidationError(_('Unsupported request decision.'))
        reason = (reason or '').strip()
        if not reason:
            raise ValidationError(_('A reason is required when accepting or rejecting a request.'))
        if self.state != 'pending':
            return self._decision_result()

        self.write({
            'state': decision,
            'decided_by': self.env.user.id,
            'decided_at': fields.Datetime.now(),
            'decision_reason': reason,
        })
        body = self._render_body()
        if self.message_id:
            self.message_id.write({'body': body})

        self.env['bus.bus'].sendone(
            (self._cr.dbname, 'mail.channel', self.channel_id.id),
            {
                'info': 'chat_request_update',
                'request_id': self.id,
                'message_id': self.message_id.id if self.message_id else False,
                'body': body,
                'state': self.state,
            },
        )
        return self._decision_result()

    def action_cancel(self):
        """Cancel a pending request for authorized requesters."""
        self.ensure_one()
        if not self.env.user.has_group('chat_floating_launcher.group_chat_request_cancel'):
            raise AccessError(_('You need the Chat Request: Cancel group to cancel requests.'))
        if self.requester_id != self.env.user:
            raise AccessError(_('Only the request sender can cancel this request.'))
        if self.state != 'pending':
            return self._decision_result()

        self.write({
            'state': 'cancelled',
            'decided_by': self.env.user.id,
            'decided_at': fields.Datetime.now(),
        })
        body = self._render_body()
        if self.message_id:
            self.message_id.write({'body': body})

        self.env['bus.bus'].sendone(
            (self._cr.dbname, 'mail.channel', self.channel_id.id),
            {
                'info': 'chat_request_update',
                'request_id': self.id,
                'message_id': self.message_id.id if self.message_id else False,
                'body': body,
                'state': self.state,
            },
        )
        return self._decision_result()

    def _decision_result(self):
        self.ensure_one()
        return {
            'request_id': self.id,
            'message_id': self.message_id.id if self.message_id else False,
            'state': self.state,
            'body': self._render_body(),
        }

    def _render_body(self):
        self.ensure_one()
        title = html_escape(self.name or '')
        description = html_escape(self.description or '').replace('\n', '<br/>')
        requester = html_escape(self.requester_id.name or '')
        requester_user_id = self.requester_id.id
        recipient_user_id = self.recipient_id.id
        requester_partner_id = self.requester_id.partner_id.id
        recipient_partner_id = self.recipient_id.partner_id.id
        if self.state == 'approved':
            status = '<span class="o_chat_request_status">Approved</span>'
        elif self.state == 'rejected':
            status = '<span class="o_chat_request_status">Rejected</span>'
        elif self.state == 'cancelled':
            status = '<span class="o_chat_request_status">Cancelled</span>'
        else:
            status = '<span class="o_chat_request_status">Pending approval</span>'

        reason = ''
        if self.decision_reason and self.state in ('approved', 'rejected'):
            safe_reason = html_escape(self.decision_reason).replace('\\n', '<br/>')
            reason = '<div class="o_chat_request_reason"><strong>Reason:</strong> %s</div>' % safe_reason

        actions = ''
        if self.state == 'pending':
            actions = (
                '<div class="o_chat_request_actions">'
                '<button type="button" class="btn btn-success btn-sm o_chat_request_approve" '
                'data-request-id="%s">Accept</button>'
                '<button type="button" class="btn btn-danger btn-sm o_chat_request_reject" '
                'data-request-id="%s">Reject</button>'
                '<button type="button" class="btn btn-secondary btn-sm o_chat_request_cancel" '
                'data-request-id="%s">Cancel</button>'
                '</div>'
            ) % (self.id, self.id, self.id)

        return (
            '<div class="o_chat_request o_chat_request_%s o_chat_request_id_%s '
            'o_chat_request_requester_%s o_chat_request_recipient_%s '
            'o_chat_request_requester_partner_%s o_chat_request_recipient_partner_%s">'
            '<div class="o_chat_request_header">'
            '<span class="fa fa-handshake-o mr-2" aria-hidden="true"></span>'
            '<strong>Request</strong>%s'
            '</div>'
            '<div class="o_chat_request_title">%s</div>'
            '<div class="o_chat_request_description">%s</div>'
            '<div class="o_chat_request_meta">Requested by %s</div>'
            '%s'
            '%s'
            '</div>'
        ) % (self.state, self.id, requester_user_id, recipient_user_id,
             requester_partner_id, recipient_partner_id, status, title, description, requester, reason, actions)
