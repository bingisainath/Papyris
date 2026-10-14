# backend/app/services/email_service.py

import smtplib
from html import escape
from email.utils import formataddr, formatdate, make_msgid
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

from app.config.settings import settings

logger = logging.getLogger(__name__)

class EmailService:
    """Service for sending emails"""
    
    def __init__(self):
        # Read from app settings, which load backend/.env (os.getenv would miss values in .env)
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.FROM_EMAIL or settings.SMTP_USER
        self.from_name = settings.FROM_NAME
        self.reply_to = settings.REPLY_TO
        self.environment = settings.ENV

    @property
    def configured(self) -> bool:
        return bool(self.smtp_user and self.smtp_password)
        
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send an email over SMTP, or (no SMTP configured, not production) write it to the log."""
        if not self.configured:
            if self.environment == "production":
                logger.error("Email not sent: SMTP_USER / SMTP_PASSWORD are not configured (%s)", subject)
                return False
            # Local development only: show the email (sign-up code, reset link) in the log
            logger.warning(
                "EMAIL NOT SENT (no SMTP configured)\nTo: %s\nSubject: %s\n\n%s",
                to_email, subject, text_content or "(no text content)",
            )
            return True
        
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = formataddr((self.from_name, self.from_email))
            msg['To'] = to_email
            if self.reply_to:
                msg['Reply-To'] = self.reply_to
            # Spam filters expect these; the Message-ID uses the sending domain
            msg['Date'] = formatdate(localtime=False)
            msg['Message-ID'] = make_msgid(domain=self.from_email.rsplit('@', 1)[-1] or None)

            # Add text part (fallback)
            if text_content:
                text_part = MIMEText(text_content, 'plain')
                msg.attach(text_part)

            # Add HTML part
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)

            # Send email
            # Port 465 is TLS from the first byte; 587 (and others) upgrade with STARTTLS
            if self.smtp_port == 465:
                connection = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=20)
            else:
                connection = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=20)
            with connection as server:
                if self.smtp_port != 465:
                    server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)

            logger.info("Email sent: %s", subject)
            return True

        except Exception:
            logger.exception("Failed to send email: %s", subject)
            return False

    def send_password_reset_email(
        self,
        to_email: str,
        username: str,
        reset_link: str
    ) -> bool:
        """The link to choose a new password (valid for 1 hour, once)."""
        subject = "Reset your ShareEven password"
        link = escape(reset_link, quote=True)
        body = f"""
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:{INK}">Reset your password</h1>
          <p style="margin:0 0 12px">Hi {escape(username)},</p>
          <p style="margin:0 0 24px">We received a request to reset the password for your ShareEven account. Choose a new one with the button below.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr>
            <td style="border-radius:10px;background:{PURPLE}">
              <a href="{link}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">Reset password</a>
            </td>
          </tr></table>
          {_note("This link expires in 1 hour and works once.")}
          <p style="margin:24px 0 0;color:{MUTED};font-size:14px">If you didn't ask for this, you can ignore this email. Your password won't change.</p>
          <p style="margin:16px 0 0;color:{MUTED};font-size:13px">Button not working? Paste this link into your browser:<br>
            <a href="{link}" style="color:{PURPLE};word-break:break-all">{link}</a></p>
        """
        text_content = (
            f"Hi {username},\n\n"
            "We received a request to reset the password for your ShareEven account.\n"
            f"Choose a new one here: {reset_link}\n\n"
            "This link expires in 1 hour and works once.\n"
            "If you didn't ask for this, you can ignore this email. Your password won't change.\n"
        )
        return self.send_email(to_email, subject, _layout(subject, body), text_content)

    def send_verification_code(self, to_email: str, username: str, code: str) -> bool:
        """The 6-digit code that confirms a new account's email address."""
        subject = f"{code} is your ShareEven code"
        body = f"""
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:{INK}">Confirm your email</h1>
          <p style="margin:0 0 20px">Hi {escape(username)}, use this code to finish creating your account:</p>
          <p style="margin:0 0 24px;padding:16px 0;text-align:center;background:{PURPLE_TINT};border-radius:12px;
                    font-size:32px;font-weight:700;letter-spacing:8px;color:{INK};font-family:Menlo,Consolas,monospace">{escape(code)}</p>
          {_note("The code expires in 10 minutes.")}
          <p style="margin:24px 0 0;color:{MUTED};font-size:14px">If you didn't create an account, you can ignore this email.</p>
        """
        text_content = (
            f"Hi {username},\n\nYour ShareEven verification code is {code}.\n"
            "It expires in 10 minutes. If you didn't create an account, you can ignore this email."
        )
        return self.send_email(to_email, subject, _layout(subject, body), text_content)


# ------------------------------------------------------------------ the look (inline styles: email
# clients drop <style> blocks and most CSS; tables keep the layout in Outlook)

PURPLE = "#543f7d"  # the app's primary-700
PURPLE_TINT = "#f4f1fa"
INK = "#1e293b"
MUTED = "#64748b"


def _note(text: str) -> str:
    """A small purple-edged note (instead of an emoji)."""
    return (f'<p style="margin:0;padding:12px 14px;background:{PURPLE_TINT};border-left:4px solid {PURPLE};'
            f'border-radius:8px;color:{PURPLE};font-size:14px;font-weight:600">{escape(text)}</p>')


def _layout(title: str, body: str) -> str:
    """The ShareEven frame: the purple S mark and name on top, the card, a quiet footer."""
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)}</title></head>
<body style="margin:0;padding:0;background:#f6f6f8">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f8"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
      <tr><td style="padding:0 4px 20px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td width="40" height="40" align="center" valign="middle" style="width:40px;height:40px;background:{PURPLE};border-radius:12px;
              color:#ffffff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700">S</td>
          <td style="padding-left:10px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:19px;font-weight:700;color:{INK}">ShareEven</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;
                     font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#334155">
        {body}
      </td></tr>
      <tr><td style="padding:20px 4px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#94a3b8">
        You're getting this because of a request on your ShareEven account. Questions? Reply to this email or write to
        <a href="mailto:support@shareeven.com" style="color:#94a3b8">support@shareeven.com</a>.<br>
        &copy; 2026 ShareEven
      </td></tr>
    </table>
  </td></tr></table>
</body></html>"""


email_service = EmailService()