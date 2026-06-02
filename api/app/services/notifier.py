"""
Security Notifier — Console logs for login/register attempts.
In production, this would call a WhatsApp/SMS API.
"""

from app.core.config import settings

NOTIFICATION_NUMBERS = ["918949553581", "918209756996"]

def notify_attempt(action: str, details: str):
    """
    Simulates sending a notification to the owner.
    Since there is no server-side SMS/WhatsApp gateway configured,
    this currently logs to the console/system logs.
    """
    message = f"🚨 SECURITY ALERT: {action} attempt - {details}"
    print(f"\n[NOTIFY] Sending to {NOTIFICATION_NUMBERS}:")
    print(f"--- {message} ---\n")

    # TODO: Integration with Twilio/Interakt/UltraMsg would happen here:
    # for num in NOTIFICATION_NUMBERS:
    #     send_whatsapp(num, message)
