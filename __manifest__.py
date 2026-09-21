{
    'name': 'Floating Chat Launcher 19',
    'summary': 'Free Odoo 19 floating Discuss launcher with direct chat requests and decision workflows.',
    'description': """
Floating Chat Launcher 19
=========================
Moves the Odoo 19 Discuss messaging menu to a responsive bottom-right launcher
without modifying Odoo core files. Adds direct-chat request cards with recipient
approval, rejection, and requester cancellation.
""",
    'version': '19.0.1.0.0',
    'category': 'Discuss',
    'author': 'SARANG T',
    'license': 'LGPL-3',
    'depends': ['mail'],
    'data': [
        'security/chat_request_groups.xml',
        'security/ir.model.access.csv',
        'views/res_users_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'chat_floating_launcher_19/static/src/xml/chat_request.xml',
            'chat_floating_launcher_19/static/src/js/chat_request.js',
            'chat_floating_launcher_19/static/src/scss/floating_chat_launcher.scss',
            'chat_floating_launcher_19/static/src/scss/chat_request.scss',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
}
