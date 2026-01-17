# backend/app/services/email_service.py

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class EmailService:
    """Service for sending emails"""
    
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.from_email = os.getenv("FROM_EMAIL", self.smtp_user)
        self.from_name = os.getenv("FROM_NAME", "Papyris")
        self.environment = os.getenv("ENV", "local")
        
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send an email (dev mode prints to console, prod sends real email)"""
        
        # In development, just print to console
        if self.environment == "local" or self.environment == "development":
            logger.info(f"\n{'='*80}")
            logger.info(f"📧 EMAIL (DEV MODE - NOT ACTUALLY SENT)")
            logger.info(f"{'='*80}")
            logger.info(f"To: {to_email}")
            logger.info(f"Subject: {subject}")
            logger.info(f"\n{text_content or 'No text content'}")
            logger.info(f"{'='*80}\n")
            return True
        
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email

            # Add text part (fallback)
            if text_content:
                text_part = MIMEText(text_content, 'plain')
                msg.attach(text_part)

            # Add HTML part
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)

            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)

            logger.info(f"✅ Email sent to {to_email}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to send email to {to_email}: {e}")
            return False

    def send_password_reset_email(
        self,
        to_email: str,
        username: str,
        reset_link: str
    ) -> bool:
        """Send password reset email with beautiful Papyris branding"""
        
        subject = "Reset Your Papyris Password"
        
        # HTML email template with Papyris purple/indigo theme
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    background-color: #f8fafc;
                }}
                .container {{
                    max-width: 600px;
                    margin: 40px auto;
                    background-color: white;
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 4px 20px rgba(126, 34, 206, 0.08);
                }}
                .header {{
                    background: linear-gradient(135deg, #7e22ce 0%, #4338ca 100%);
                    padding: 40px 20px;
                    text-align: center;
                }}
                .header h1 {{
                    color: white;
                    margin: 0;
                    font-size: 28px;
                    font-weight: 600;
                }}
                .content {{
                    padding: 40px 30px;
                }}
                .content h2 {{
                    color: #1e293b;
                    font-size: 24px;
                    margin-top: 0;
                    margin-bottom: 20px;
                }}
                .content p {{
                    color: #64748b;
                    font-size: 16px;
                    margin-bottom: 20px;
                }}
                .button {{
                    display: inline-block;
                    padding: 16px 40px;
                    background: linear-gradient(135deg, #7e22ce 0%, #4338ca 100%);
                    color: white !important;
                    text-decoration: none;
                    border-radius: 12px;
                    font-weight: 600;
                    font-size: 16px;
                    margin: 20px 0;
                }}
                .footer {{
                    padding: 30px;
                    background-color: #f8fafc;
                    text-align: center;
                    font-size: 14px;
                    color: #94a3b8;
                }}
                .warning {{
                    background-color: #fff7ed;
                    border-left: 4px solid #f59e0b;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 8px;
                }}
                .warning p {{
                    margin: 0;
                    color: #92400e;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔐 Papyris</h1>
                </div>
                <div class="content">
                    <h2>Reset Your Password</h2>
                    <p>Hi {username},</p>
                    <p>We received a request to reset your password for your Papyris account.</p>
                    <p>Click the button below to create a new password:</p>
                    <div style="text-align: center;">
                        <a href="{reset_link}" class="button">Reset Password</a>
                    </div>
                    <div class="warning">
                        <p><strong>⏰ This link expires in 1 hour</strong></p>
                    </div>
                    <p>If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.</p>
                    <p>For security reasons, this link will only work once.</p>
                </div>
                <div class="footer">
                    <p>If the button doesn't work, copy and paste this link:</p>
                    <p style="word-break: break-all; color: #7e22ce;">{reset_link}</p>
                    <p style="margin-top: 20px;">© 2024 Papyris. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text version
        text_content = f"""
        Reset Your Papyris Password
        
        Hi {username},
        
        We received a request to reset your password for your Papyris account.
        
        Click the link below to create a new password:
        {reset_link}
        
        This link expires in 1 hour.
        
        If you didn't request this password reset, you can safely ignore this email.
        
        © 2024 Papyris
        """
        
        return self.send_email(to_email, subject, html_content, text_content)


# Create singleton instance
email_service = EmailService()