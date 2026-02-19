"""
Test the agent with a specific prompt and analyze output
Prompt: "Target CTOs at financial companies in London with our cybersecurity compliance platform. Urgent, Q1 deadlines approaching."
"""
import requests
import json
import time

# Server endpoint
BASE_URL = "http://127.0.0.1:8000"

# Parse the natural language prompt into structured fields
campaign_data = {
    "time": "Urgent, Q1 2026 deadlines approaching",
    "location": "London",
    "business_behavior": "Selling cybersecurity compliance platform to financial companies",
    "intent": "Generate urgent leads before Q1 deadlines",
    "target_audience": "CTOs at financial companies"
}

print("="*80)
print("TESTING AGENT WITH CAMPAIGN:")
print("="*80)
print(json.dumps(campaign_data, indent=2))
print("\n" + "="*80)
print("EXECUTING CAMPAIGN...")
print("="*80 + "\n")

headers = {
    "Content-Type": "application/json",
    "X-User-Role": "marketer"
}

# Start campaign execution with SSE streaming
try:
    response = requests.post(
        f"{BASE_URL}/campaigns/execute",
        json=campaign_data,
        headers=headers,
        stream=True,
        timeout=300
    )
    
    session_id = response.headers.get("X-Session-ID")
    print(f"Session ID: {session_id}\n")
    
    # Track progress
    events_received = []
    approval_needed = False
    
    # Read SSE stream
    for line in response.iter_lines(decode_unicode=True):
        if line:
            if line.startswith("data: "):
                data_str = line[6:]  # Remove "data: " prefix
                try:
                    event = json.loads(data_str)
                    events_received.append(event)
                    
                    # Print event
                    event_type = event.get("type", "unknown")
                    
                    if event_type == "node_start":
                        node = event.get("node", "")
                        print(f"🔵 Starting: {node}")
                    
                    elif event_type == "node_complete":
                        node = event.get("node", "")
                        print(f"✅ Completed: {node}")
                    
                    elif event_type == "approval_required":
                        approval_needed = True
                        print(f"\n⏸️  APPROVAL REQUIRED")
                        print(f"   Prospects found: {event.get('prospect_count', 0)}")
                        print(f"   Archetype: {event.get('archetype', 'N/A')}")
                        print(f"   Category: {event.get('category', 'N/A')}\n")
                    
                    elif event_type == "error":
                        print(f"❌ ERROR: {event.get('message', 'Unknown error')}")
                    
                    elif event_type == "state_update":
                        # Print key state updates
                        state = event.get("state", {})
                        if "category" in state:
                            print(f"   📊 Category: {state['category']} (confidence: {state.get('confidence', 0):.2f})")
                        if "target_archetype" in state:
                            print(f"   🎯 Archetype: {state['target_archetype']}")
                        if "selected_channel" in state:
                            print(f"   📢 Channel: {state['selected_channel']}")
                    
                except json.JSONDecodeError:
                    pass
    
    print("\n" + "="*80)
    
    # If approval required, approve it
    if approval_needed and session_id:
        print("AUTO-APPROVING CAMPAIGN...\n")
        time.sleep(1)
        
        approval_response = requests.post(
            f"{BASE_URL}/campaigns/approve",
            json={
                "session_id": session_id,
                "approved": True,
                "selected_prospect_ids": None,
                "notes": "Auto-approved for testing"
            },
            headers=headers
        )
        
        print(f"✅ Approval sent: {approval_response.json()}\n")
        
        # Wait for completion (campaign continues after approval)
        print("Waiting for campaign to complete...")
        time.sleep(5)
        
        # Get final results
        print("\n" + "="*80)
        print("FETCHING FINAL RESULTS...")
        print("="*80 + "\n")
        
        history_response = requests.get(
            f"{BASE_URL}/history/executions?limit=1",
            headers=headers
        )
        
        if history_response.status_code == 200:
            executions = history_response.json()
            if executions:
                latest = executions[0]
                print(f"Session: {latest['session_id']}")
                print(f"Status: {latest['status']}")
                print(f"Category: {latest.get('category', 'N/A')}")
                print(f"Prospects: {latest.get('prospect_count', 0)}")
                print(f"Channel: {latest.get('selected_channel', 'N/A')}")
                print(f"\nContent Generated:")
                print(f"  LinkedIn: {len(latest.get('linkedin_message', ''))} chars")
                print(f"  Email: {latest.get('email_message', {}).get('subject', 'N/A')}")
                print(f"  Call Script: {'✓' if latest.get('call_script') else '✗'}")
    
    print("\n" + "="*80)
    print("CAMPAIGN EXECUTION COMPLETE")
    print("="*80)
    
except requests.exceptions.RequestException as e:
    print(f"\n❌ REQUEST ERROR: {e}")
except Exception as e:
    print(f"\n❌ UNEXPECTED ERROR: {e}")
    import traceback
    traceback.print_exc()
