"""
Test script for Multi-Agent Marketing System API
Demonstrates campaign execution with human-in-the-loop approval
"""
import requests
import json
import time
import threading
from typing import Optional

# Configuration
API_BASE_URL = "http://localhost:8000"
ROLE_MARKETER = "marketer"
ROLE_ADMIN = "admin"


class CampaignTestClient:
    """Client for testing the marketing campaign API"""
    
    def __init__(self, base_url: str = API_BASE_URL, role: str = ROLE_MARKETER):
        self.base_url = base_url
        self.role = role
        self.session_id: Optional[str] = None
        self.prospects_found = 0
    
    def check_health(self):
        """Check API health"""
        print("\n🔍 Checking API health...")
        response = requests.get(f"{self.base_url}/health")
        if response.status_code == 200:
            print("✅ API is healthy")
            print(f"   {response.json()}")
            return True
        else:
            print("❌ API health check failed")
            return False
    
    def execute_campaign(self, campaign_data: dict):
        """Execute campaign with SSE streaming"""
        print(f"\n🚀 Starting campaign execution as '{self.role}'...")
        print(f"   Campaign: {campaign_data['intent']}")
        print(f"   Target: {campaign_data['target_audience']} in {campaign_data['location']}")
        
        url = f"{self.base_url}/campaigns/execute"
        headers = {
            "Content-Type": "application/json",
            "X-User-Role": self.role
        }
        
        try:
            response = requests.post(url, headers=headers, json=campaign_data, stream=True, timeout=600)
            
            if response.status_code != 200:
                print(f"❌ Error: {response.status_code}")
                print(f"   {response.text}")
                return
            
            # Extract session ID from headers
            print(f"\n📡 Streaming events...")
            print("-" * 70)
            
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    if decoded_line.startswith('data: '):
                        event_data = json.loads(decoded_line[6:])
                        self._handle_event(event_data)
            
            print("-" * 70)
            print("✅ Campaign execution stream completed")
            
        except requests.exceptions.Timeout:
            print("⏰ Request timeout - this is normal for long-running campaigns")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    def _handle_event(self, event: dict):
        """Handle individual SSE event"""
        stage = event.get('stage', 'unknown')
        status = event.get('status', '')
        timestamp = event.get('timestamp', '')
        
        # Format timestamp
        time_str = timestamp.split('T')[1][:8] if 'T' in timestamp else ''
        
        print(f"[{time_str}] {stage.upper():20s} | {status}")
        
        # Handle specific stages
        if stage == 'approval_required':
            self.session_id = event.get('session_id')
            self.prospects_found = event.get('prospect_count', 0)
            print(f"\n{'=' * 70}")
            print(f"🔔 HUMAN APPROVAL REQUIRED")
            print(f"{'=' * 70}")
            print(f"   Session ID: {self.session_id}")
            print(f"   Prospects Found: {self.prospects_found}")
            print(f"   Action Required: Send approval via /campaigns/approve endpoint")
            print(f"{'=' * 70}\n")
        
        elif stage == 'icp_matcher' and event.get('data'):
            data = event['data']
            print(f"   Archetype: {data.get('target_archetype')}")
            print(f"   Prospects: {data.get('prospect_count')}")
            if data.get('top_prospects'):
                print(f"   Top 3: {', '.join([p['name'] for p in data['top_prospects'][:3]])}")
        
        elif stage == 'classifier' and event.get('data'):
            data = event['data']
            print(f"   Category: {data.get('category')}")
            print(f"   Confidence: {data.get('confidence', 0):.0%}")
        
        elif stage == 'strategy' and event.get('data'):
            data = event['data']
            print(f"   Tone: {data.get('tone')} | CTA: {data.get('cta_type')} | Urgency: {data.get('urgency_level')}")
        
        elif stage == 'platform_decision' and event.get('data'):
            data = event['data']
            print(f"   Channel: {data.get('selected_channel', '').upper()}")
            print(f"   Reasoning: {data.get('channel_reasoning')}")
        
        elif stage == 'complete' and event.get('final_state'):
            state = event['final_state']
            print(f"\n{'=' * 70}")
            print(f"🎉 CAMPAIGN COMPLETED SUCCESSFULLY")
            print(f"{'=' * 70}")
            print(f"   Category: {state.get('category')}")
            print(f"   Archetype: {state.get('target_archetype')}")
            print(f"   Channel: {state.get('selected_channel', '').upper()}")
            print(f"   Prospects: {state.get('prospect_count')}")
            print(f"{'=' * 70}\n")
    
    def approve_campaign(self, approved: bool = True, selected_prospect_ids: Optional[list] = None):
        """Approve or reject campaign execution"""
        if not self.session_id:
            print("❌ No session ID available. Execute a campaign first.")
            return
        
        print(f"\n{'✅' if approved else '❌'} Sending {'approval' if approved else 'rejection'}...")
        
        url = f"{self.base_url}/campaigns/approve"
        headers = {
            "Content-Type": "application/json",
            "X-User-Role": self.role
        }
        data = {
            "session_id": self.session_id,
            "approved": approved,
            "selected_prospect_ids": selected_prospect_ids,
            "notes": f"{'Approved' if approved else 'Rejected'} via test script"
        }
        
        try:
            response = requests.post(url, headers=headers, json=data)
            if response.status_code == 200:
                result = response.json()
                print(f"✅ {result['message']}")
            else:
                print(f"❌ Error: {response.status_code}")
                print(f"   {response.text}")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    def get_execution_history(self, limit: int = 5):
        """Retrieve execution history"""
        print(f"\n📊 Fetching execution history (last {limit})...")
        
        url = f"{self.base_url}/history/executions?limit={limit}"
        headers = {"X-User-Role": self.role}
        
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                executions = response.json()
                print(f"✅ Found {len(executions)} executions")
                print("-" * 100)
                for i, exec in enumerate(executions, 1):
                    print(f"{i}. [{exec['created_at']}] {exec['category']} ({exec['confidence']:.0%})")
                    print(f"   Location: {exec['location']} | Tone: {exec['tone']} | CTA: {exec['cta_type']}")
                print("-" * 100)
            else:
                print(f"❌ Error: {response.status_code}")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    def get_prospect_history(self, min_score: float = 0.7, limit: int = 10):
        """Retrieve prospect history"""
        print(f"\n👥 Fetching prospects (min score: {min_score})...")
        
        url = f"{self.base_url}/history/prospects?min_priority_score={min_score}&limit={limit}"
        headers = {"X-User-Role": self.role}
        
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                prospects = response.json()
                print(f"✅ Found {len(prospects)} prospects")
                print("-" * 100)
                for i, p in enumerate(prospects, 1):
                    print(f"{i}. {p['name']} | {p['job_title']} @ {p['company_name']}")
                    print(f"   Priority: {p['priority_score']:.2f} | ICP: {p['icp_score']:.2f} | Contacted: {p['times_contacted']}x")
                print("-" * 100)
            else:
                print(f"❌ Error: {response.status_code}")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    def test_rbac_admin_only(self):
        """Test admin-only endpoint access"""
        print(f"\n🔒 Testing admin-only endpoint access (current role: {self.role})...")
        
        url = f"{self.base_url}/logs/system?lines=10"
        headers = {"X-User-Role": self.role}
        
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                print(f"✅ Access granted (you are {self.role})")
                print(f"   {response.json()}")
            elif response.status_code == 403:
                print(f"❌ Access denied (expected for role: {self.role})")
                print(f"   {response.json()['detail']}")
            else:
                print(f"⚠️  Unexpected status: {response.status_code}")
        except Exception as e:
            print(f"❌ Error: {e}")


def run_full_workflow_test():
    """Run complete workflow test with human-in-the-loop"""
    print("=" * 70)
    print("MULTI-AGENT MARKETING SYSTEM API TEST".center(70))
    print("=" * 70)
    
    # Initialize client
    client = CampaignTestClient(role=ROLE_MARKETER)
    
    # Step 1: Health check
    if not client.check_health():
        print("\n⚠️  API is not available. Make sure the server is running:")
        print("   python server.py")
        return
    
    # Step 2: Test RBAC
    client.test_rbac_admin_only()
    
    # Step 3: Test execution history
    client.get_execution_history(limit=3)
    
    # Step 4: Test prospect history
    client.get_prospect_history(min_score=0.5, limit=5)
    
    # Step 5: Execute campaign with approval workflow
    campaign_data = {
        "time": "ASAP",
        "location": "UK",
        "business_behavior": "Selling HR payroll software to mid-sized companies",
        "intent": "Generate new B2B leads for product launch",
        "target_audience": "HR managers dealing with manual payroll issues"
    }
    
    # Auto-approval thread: monitors for session_id and approves automatically
    approval_sent = threading.Event()
    
    def auto_approve():
        """Monitor for session_id and send approval"""
        max_wait = 60  # Wait up to 60 seconds for session_id
        elapsed = 0
        while elapsed < max_wait and not approval_sent.is_set():
            if client.session_id:
                time.sleep(0.5)  # Small delay to ensure session is created
                print(f"\n🤖 Auto-approving session {client.session_id}...")
                client.approve_campaign(approved=True)
                approval_sent.set()
                return
            time.sleep(0.5)
            elapsed += 0.5
        
        if not approval_sent.is_set():
            print("\n⚠️  Timeout waiting for session_id")
    
    # Start approval monitor thread
    approval_thread = threading.Thread(target=auto_approve, daemon=True)
    approval_thread.start()
    
    # Execute campaign in main thread (blocking)
    client.execute_campaign(campaign_data)
    
    # Wait a moment for approval thread to complete
    time.sleep(1)
    
    # Step 6: Check updated history
    time.sleep(2)
    client.get_execution_history(limit=3)
    
    print("\n" + "=" * 70)
    print("TEST COMPLETED".center(70))
    print("=" * 70)


def test_marketer_vs_admin():
    """Test RBAC differences between Marketer and Admin"""
    print("\n" + "=" * 70)
    print("RBAC TEST: Marketer vs Admin".center(70))
    print("=" * 70)
    
    # Test as Marketer
    print("\n--- Testing as MARKETER ---")
    marketer = CampaignTestClient(role=ROLE_MARKETER)
    marketer.check_health()
    marketer.test_rbac_admin_only()  # Should fail
    
    # Test as Admin
    print("\n--- Testing as ADMIN ---")
    admin = CampaignTestClient(role=ROLE_ADMIN)
    admin.check_health()
    admin.test_rbac_admin_only()  # Should succeed
    
    print("\n" + "=" * 70)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "rbac":
            test_marketer_vs_admin()
        elif sys.argv[1] == "history":
            client = CampaignTestClient()
            client.check_health()
            client.get_execution_history(limit=10)
            client.get_prospect_history(limit=10)
        else:
            print("Usage: python test_server.py [rbac|history]")
    else:
        # Run full workflow test
        run_full_workflow_test()
