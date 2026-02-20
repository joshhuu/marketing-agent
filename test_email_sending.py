"""
Test script to verify email sending functionality
This bypasses validation to test SMTP connectivity directly
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import (
    MAILEROO_SMTP_HOST,
    MAILEROO_SMTP_PORT,
    MAILEROO_SMTP_USERNAME,
    MAILEROO_SMTP_PASSWORD,
    MAILEROO_FROM_EMAIL,
    MAILEROO_FROM_NAME,
    MAILEROO_USE_TLS,
    HARDCODED_TEST_EMAILS
)

def test_email_sending():
    """Test sending a simple email to verify SMTP configuration"""
    print("=" * 80)
    print("EMAIL SENDING TEST")
    print("=" * 80)
    
    # Check credentials
    if not all([MAILEROO_SMTP_USERNAME, MAILEROO_SMTP_PASSWORD]):
        print("❌ SMTP credentials not configured in .env file")
        return False
    
    print(f"SMTP Host: {MAILEROO_SMTP_HOST}")
    print(f"SMTP Port: {MAILEROO_SMTP_PORT}")
    print(f"SMTP User: {MAILEROO_SMTP_USERNAME}")
    print(f"From Email: {MAILEROO_FROM_EMAIL}")
    print(f"From Name: {MAILEROO_FROM_NAME}")
    print(f"Use TLS: {MAILEROO_USE_TLS}")
    print(f"Test Recipients: {', '.join(HARDCODED_TEST_EMAILS)}")
    print()
    
    try:
        # Connect to SMTP server
        print(f"Connecting to SMTP server...")
        if MAILEROO_USE_TLS:
            server = smtplib.SMTP(MAILEROO_SMTP_HOST, MAILEROO_SMTP_PORT, timeout=30)
            print("Starting TLS...")
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(MAILEROO_SMTP_HOST, MAILEROO_SMTP_PORT, timeout=30)
        
        print("Logging in...")
        server.login(MAILEROO_SMTP_USERNAME, MAILEROO_SMTP_PASSWORD)
        print("✅ SMTP authentication successful!")
        print()
        
        # Send test email to each recipient
        success_count = 0
        for recipient in HARDCODED_TEST_EMAILS:
            try:
                print(f"Sending test email to {recipient}...")
                
                msg = MIMEMultipart('alternative')
                msg['From'] = f"{MAILEROO_FROM_NAME} <{MAILEROO_FROM_EMAIL}>"
                msg['To'] = recipient
                msg['Subject'] = "🧪 Test Email from Marketing Agent"
                
                body = f"""
Hello!

This is a test email from the Marketing Agent system to verify email sending functionality.

If you received this email, the SMTP configuration is working correctly! ✅

Technical Details:
- SMTP Host: {MAILEROO_SMTP_HOST}
- From: {MAILEROO_FROM_EMAIL}
- Recipient: {recipient}

---
Marketing Agent Test System
"""
                
                msg.attach(MIMEText(body, 'plain'))
                server.send_message(msg)
                print(f"  ✅ Sent successfully to {recipient}")
                success_count += 1
                
            except Exception as e:
                print(f"  ❌ Failed to send to {recipient}: {e}")
        
        server.quit()
        print()
        print("=" * 80)
        print(f"TEST COMPLETE: {success_count}/{len(HARDCODED_TEST_EMAILS)} emails sent successfully")
        print("=" * 80)
        
        return success_count == len(HARDCODED_TEST_EMAILS)
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ SMTP Authentication Failed: {e}")
        print("   Check your MAILEROO_SMTP_USERNAME and MAILEROO_SMTP_PASSWORD in .env")
        return False
    except smtplib.SMTPException as e:
        print(f"❌ SMTP Error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_email_sending()
    exit(0 if success else 1)
