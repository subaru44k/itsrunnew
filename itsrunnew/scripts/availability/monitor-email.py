"""Send one Gmail digest for state transitions. Credentials stay in environment."""
import json
import os
from pathlib import Path
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.utils import parseaddr


def address(value, name):
    if not value or "\r" in value or "\n" in value or parseaddr(value)[1] != value or "@" not in value:
        raise ValueError(f"{name} must contain one email address")
    return value


def send(directory, env=os.environ, smtp_factory=smtplib.SMTP_SSL, test=False):
    directory = Path(directory)
    events = json.loads((directory / 'events.json').read_text())
    if not isinstance(events, list):
        raise ValueError('Invalid monitor events')
    if not events and not test:
        print('No monitoring transitions; no email sent.')
        return False
    sender = address(env.get('AVAILABILITY_SMTP_USER'), 'AVAILABILITY_SMTP_USER')
    recipient = address(env.get('AVAILABILITY_ALERT_TO'), 'AVAILABILITY_ALERT_TO')
    password = env.get('AVAILABILITY_SMTP_APP_PASSWORD')
    if not password:
        raise ValueError('AVAILABILITY_SMTP_APP_PASSWORD is required')
    message = EmailMessage()
    message['From'] = sender
    message['To'] = recipient
    prefix = '接続テスト / ' if test else ''
    message['Subject'] = f'[ItsRun] availability監視: {prefix}{len(events)}件の状態変化'
    body = (directory / 'notification.txt').read_text()
    message.set_content(('これは手動実行で指定された通知の接続テストです。\n\n' if test else '') + body)
    with smtp_factory('smtp.gmail.com', 465, context=ssl.create_default_context(), timeout=30) as client:
        client.login(sender, password)
        rejected = client.send_message(message)
        if rejected:
            raise RuntimeError('Gmail rejected the notification recipient')
    print(f'Sent monitoring digest ({len(events)} state changes).')
    return True


if __name__ == '__main__':
    try:
        send(sys.argv[1], test='--test' in sys.argv[2:])
    except Exception as error:
        # SMTP exceptions can contain server text and addresses; never echo the
        # response or credentials into public Actions logs.
        print(f'Monitor email failed ({type(error).__name__}); check Gmail/Secrets configuration.', file=sys.stderr)
        sys.exit(1)
