# GITHUB COPILOT PROMPT — Multi-Agent Content Generation System

## CONTEXT
I'm building a Multi-Agent System (MAS) for intelligent B2B sales/marketing automation. The system takes natural language input from a user (e.g., "I want to reach HR managers in the UK selling payroll software") and automatically:
1. Classifies the task
2. Finds the best prospects from a database
3. Decides which channel to use (LinkedIn/Email/Call)
4. Generates personalized content

I have a PostgreSQL database already seeded with:
- `prospects` table (500 rows) — contacts with ICP scoring
- `products` table (20 rows) — what we're selling
- `engagement_history` table (2000 rows) — past interaction performance
- `classifications` table (50 rows) — audit trail

Database connection string: `postgresql://postgres:password@localhost:5432/mas_db`

## ARCHITECTURE REQUIREMENTS

### Technology Stack
- **Framework**: LangGraph (for agent orchestration)
- **LLM**: Google Gemini (gemini-1.5-pro) via LangChain
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Python Version**: 3.10+

### Agent Flow (LangGraph StateGraph)
```
User Input (natural language)
    ↓
Input Parser Node → extracts: time, location, business_behavior, user_intent
    ↓
Agent 1: Classification Node → outputs: category, confidence
    ↓
Strategy Node → outputs: tone, cta_type, urgency_level
    ↓
Agent 2: ICP Matching Node → queries prospects table → outputs: top_prospects (list of IDs), target_archetype
    ↓
Agent 3: Platform Decision Node → queries engagement_history → outputs: selected_channel (linkedin/email/call)
    ↓
Agent 4: Content Generation Node → reads products table → outputs: linkedin_message, email_message, call_script
    ↓
END
```

### State Schema
The state object that flows through the graph should contain:
```python
{
    # Input Parser outputs
    "user_prompt": str,
    "time": str,
    "location": str,
    "business_behavior": str,
    "user_intent": str,
    
    # Agent 1 outputs
    "category": str,
    "confidence": float,
    
    # Strategy outputs
    "tone": str,
    "cta_type": str,
    "urgency_level": str,
    
    # Agent 2 outputs
    "top_prospects": list[dict],  # top 10-15 prospects
    "target_archetype": str,
    
    # Agent 3 outputs
    "selected_channel": str,
    "channel_reasoning": str,
    
    # Agent 4 outputs
    "linkedin_message": str,
    "email_message": dict,  # {subject, body}
    "call_script": dict     # {opener, objections, close}
}
```

## FILE STRUCTURE

Create the following files:

```
marketing-agent/
├── main.py                    # Entry point - run the graph
├── graph.py                   # LangGraph setup - builds the StateGraph
├── state.py                   # TypedDict state schema
├── config.py                  # DB connection, API keys, settings
├── database.py                # SQLAlchemy models + DB session
├── nodes/
│   ├── __init__.py
│   ├── input_parser.py        # Parses natural language → 4 fields
│   ├── classifier.py          # Agent 1: classifies task category
│   ├── strategy.py            # Determines tone/urgency/CTA
│   ├── icp_matcher.py         # Agent 2: queries prospects table
│   ├── platform_decision.py   # Agent 3: picks best channel
│   └── content_generator.py   # Agent 4: generates messages
├── prompts/
│   ├── __init__.py
│   ├── classifier_prompt.py
│   ├── strategy_prompt.py
│   ├── icp_prompt.py
│   ├── platform_prompt.py
│   └── content_prompt.py
└── utils/
    ├── __init__.py
    ├── llm.py                 # LLM wrapper (Gemini 1.5 Pro)
    └── db_queries.py          # Helper functions for DB queries
```

## DETAILED REQUIREMENTS BY FILE

### 1. `config.py`
```python
# Store all configuration
- Database URL
- Google API key (from env var GOOGLE_API_KEY)
- Model name: "gemini-1.5-pro"
- Temperature settings per agent
```

### 2. `database.py`
```python
# SQLAlchemy models matching the seeded schema
- Prospect model (table: prospects)
- Product model (table: products)  
- EngagementHistory model (table: engagement_history)
- Classification model (table: classifications)
- get_db_session() function
```

### 3. `state.py`
```python
# TypedDict for the graph state
from typing import TypedDict, List, Optional

class AgentState(TypedDict):
    user_prompt: str
    time: Optional[str]
    location: Optional[str]
    business_behavior: Optional[str]
    user_intent: Optional[str]
    category: Optional[str]
    confidence: Optional[float]
    tone: Optional[str]
    cta_type: Optional[str]
    urgency_level: Optional[str]
    top_prospects: Optional[List[dict]]
    target_archetype: Optional[str]
    selected_channel: Optional[str]
    channel_reasoning: Optional[str]
    linkedin_message: Optional[str]
    email_message: Optional[dict]
    call_script: Optional[dict]
```

### 4. `utils/llm.py`
```python
# Wrapper for LLM calls using LangChain
from langchain_google_genai import ChatGoogleGenerativeAI

def get_llm(temperature=0.7):
    """Returns configured Gemini 1.5 Pro instance"""
    return ChatGoogleGenerativeAI(
        model="gemini-1.5-pro",
        temperature=temperature,
        google_api_key=os.getenv("GOOGLE_API_KEY")
    )
```

### 5. `nodes/input_parser.py`
```python
def parse_input(state: AgentState) -> AgentState:
    """
    Takes state["user_prompt"] (natural language)
    Calls LLM to extract: time, location, business_behavior, user_intent
    Returns updated state with these 4 fields filled
    
    Example:
    Input: "I'm Josh, selling HR software in UK"
    Output: {
        "time": "current",
        "location": "UK",
        "business_behavior": "HR software sales",
        "user_intent": "generate leads"
    }
    """
```

### 6. `nodes/classifier.py`
```python
def classify_task(state: AgentState) -> AgentState:
    """
    Agent 1: Classification
    Takes: time, location, business_behavior, user_intent
    Returns: category (str), confidence (float 0-1)
    
    Categories: B2B_lead_gen, B2B_reengagement, product_launch, 
                event_promotion, partnership_outreach, etc.
    
    Should also log to classifications table in DB
    """
```

### 7. `nodes/strategy.py`
```python
def generate_strategy(state: AgentState) -> AgentState:
    """
    Strategy Node
    Takes: category
    Returns: tone (formal/persuasive/conversational), 
             cta_type (book_demo/start_trial/download),
             urgency_level (high/medium/low)
    """
```

### 8. `nodes/icp_matcher.py`
```python
def match_icp(state: AgentState) -> AgentState:
    """
    Agent 2: ICP Matching
    
    Query prospects table WHERE:
    - Industry/department matches business_behavior
    - Location matches if specified
    - Order by priority_score DESC
    - Return top 10-15 prospects
    
    Extract common archetype from top results
    
    Returns: top_prospects (list of dicts), target_archetype (str)
    """
```

### 9. `nodes/platform_decision.py`
```python
def decide_platform(state: AgentState) -> AgentState:
    """
    Agent 3: Platform Decision
    
    Query engagement_history joined with prospects WHERE:
    - prospects.icp_archetype = state["target_archetype"]
    
    Calculate per channel:
    - open_rate = AVG(was_opened) * 100
    - reply_rate = AVG(was_replied) * 100
    
    Use LLM to reason over:
    - Channel performance data
    - urgency_level
    - Time of day (from state["time"])
    
    Returns: selected_channel (linkedin/email/call), channel_reasoning (str)
    """
```

### 10. `nodes/content_generator.py`
```python
def generate_content(state: AgentState) -> AgentState:
    """
    Agent 4: Content Generation
    
    Query products table to get:
    - key_benefits, value_proposition, cta_primary, cta_secondary
    
    Use LLM with state context to generate:
    - linkedin_message (str) — 150-200 words, professional tone
    - email_message (dict) — {subject: str, body: str}
    - call_script (dict) — {opener: str, objections: list, close: str}
    
    Generate ALL 3 formats regardless of selected_channel
    (allows fallback if primary channel fails)
    """
```

### 11. `graph.py`
```python
from langgraph.graph import StateGraph, END

def build_graph():
    """
    Constructs the LangGraph StateGraph
    
    Flow:
    START 
      → input_parser 
      → classifier 
      → strategy 
      → icp_matcher 
      → platform_decision 
      → content_generator 
      → END
    
    Returns: compiled graph ready to invoke
    """
    graph = StateGraph(AgentState)
    
    # Add nodes
    graph.add_node("input_parser", parse_input)
    graph.add_node("classifier", classify_task)
    graph.add_node("strategy", generate_strategy)
    graph.add_node("icp_matcher", match_icp)
    graph.add_node("platform_decision", decide_platform)
    graph.add_node("content_generator", generate_content)
    
    # Add edges (sequential flow)
    graph.add_edge("input_parser", "classifier")
    graph.add_edge("classifier", "strategy")
    graph.add_edge("strategy", "icp_matcher")
    graph.add_edge("icp_matcher", "platform_decision")
    graph.add_edge("platform_decision", "content_generator")
    graph.add_edge("content_generator", END)
    
    # Set entry point
    graph.set_entry_point("input_parser")
    
    return graph.compile()
```

### 12. `main.py`
```python
def main():
    """
    Entry point
    
    1. Load graph
    2. Get user input (or use test prompt)
    3. Run graph.invoke({"user_prompt": prompt})
    4. Print results in readable format
    """
    
    # Test prompt
    test_prompt = "I'm Josh from Xyndrix, selling HR payroll software in UK. Want to reach HR managers at mid-sized companies dealing with manual payroll headaches."
    
    graph = build_graph()
    result = graph.invoke({"user_prompt": test_prompt})
    
    # Pretty print results
    print("\n" + "="*70)
    print("CLASSIFICATION")
    print("="*70)
    print(f"Category: {result['category']}")
    print(f"Confidence: {result['confidence']:.2%}")
    
    print("\n" + "="*70)
    print("STRATEGY")
    print("="*70)
    print(f"Tone: {result['tone']}")
    print(f"CTA: {result['cta_type']}")
    print(f"Urgency: {result['urgency_level']}")
    
    print("\n" + "="*70)
    print(f"TARGET PROSPECTS ({len(result['top_prospects'])} found)")
    print("="*70)
    for p in result['top_prospects'][:5]:
        print(f"  - {p['name']} | {p['job_title']} | {p['company_name']}")
    
    print("\n" + "="*70)
    print("CHANNEL DECISION")
    print("="*70)
    print(f"Selected: {result['selected_channel'].upper()}")
    print(f"Reasoning: {result['channel_reasoning']}")
    
    print("\n" + "="*70)
    print(f"{result['selected_channel'].upper()} CONTENT")
    print("="*70)
    if result['selected_channel'] == 'email':
        print(f"Subject: {result['email_message']['subject']}")
        print(f"\n{result['email_message']['body']}")
    elif result['selected_channel'] == 'linkedin':
        print(result['linkedin_message'])
    else:
        print(f"Opener: {result['call_script']['opener']}")
        print(f"\nObjections: {', '.join(result['call_script']['objections'])}")
        print(f"\nClose: {result['call_script']['close']}")
```

## CRITICAL REQUIREMENTS

1. **All LLM calls must request JSON output** — use structured output parsing
2. **All database queries must use SQLAlchemy ORM** — no raw SQL strings
3. **Add error handling** — wrap LLM calls in try/except, handle DB connection failures
4. **Add logging** — use Python logging module to track node execution
5. **Prompt engineering**:
   - Input parser: "Extract ONLY these 4 fields as JSON, infer missing fields intelligently"
   - Classifier: "Return category and confidence as JSON with NO explanation"
   - Content generator: "Write in {tone} tone, include {cta_type}, max 200 words"
6. **Database query optimization**:
   - ICP matcher: Use `.limit(15)` and index on priority_score
   - Platform decision: Use aggregation functions, not row-by-row processing
7. **State immutability** — each node returns a NEW dict with updates, doesn't mutate input

## TESTING

After implementation, test with these prompts:

1. "I'm selling cybersecurity software to CTOs at tech companies in San Francisco"
2. "Need to re-engage HR directors in UK who didn't respond to our last email about payroll automation"
3. "Promoting our new AI analytics feature to data analysts at Fortune 500 companies"

Expected: Each should classify correctly, find relevant prospects, pick appropriate channel, generate quality content.

## DELIVERABLES

Generate all files listed above with:
- Complete implementations (not stubs)
- Type hints on all functions
- Docstrings explaining what each function does
- Error handling for LLM and DB failures
- Console logging for debugging

Start with `config.py`, `database.py`, and `state.py` first, then build nodes, then wire up the graph.
