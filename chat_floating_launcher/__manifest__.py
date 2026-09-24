# -*- coding: utf-8 -*-
{
    'name': 'Floating Chat Launcher',
    'summary': 'Move the Discuss chat icon from the top bar to the bottom-right corner.',
    'description': """
        Relocates Odoo Discuss's existing messaging menu to a fixed bottom-right
        launcher while preserving unread counters, conversation previews, and
        the standard chat actions.
    """,
    'version': '13.0.1.0.5',
    'category': 'Discuss',
    'author': 'SARANG T',
    'license': 'LGPL-3',
    'images': ['static/description/icon.png'],  # <-- ADD THIS LINE
    'depends': ['mail'],
    'data': [
        'security/chat_request_groups.xml',
        'security/ir.model.access.csv',
        'views/assets.xml',
        'views/res_users_views.xml',
    ],
    'qweb': [
        'static/src/xml/chat_request.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
