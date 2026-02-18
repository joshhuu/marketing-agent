# GEMINI API SETUP GUIDE

## Why Gemini is a Good Choice

✅ **Free tier** — 15 requests per minute, 1500 per day (plenty for development)  
✅ **Fast** — comparable to Claude/GPT-4  
✅ **Good at structured outputs** — handles JSON well  
✅ **Easy LangChain integration** — `langchain-google-genai` package  

---

## Setup Steps

### 1. Get Your Gemini API Key

1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key (starts with `AIza...`)

---

### 2. Install Required Packages

```bash
pip install langchain-google-genai langchain langgraph sqlalchemy psycopg2-binary python-dotenv
```

**Package breakdown:**
- `langchain-google-genai` — Gemini integration
- `langchain` — Core LangChain library
- `langgraph` — Graph orchestration
- `sqlalchemy` — Database ORM
- `psycopg2-binary` — PostgreSQL driver
- `python-dotenv` — Load environment variables from .env file

---

### 3. Create `.env` File

In your project root (`marketing-agent/`), create a `.env` file:

```bash
# .env
GOOGLE_API_KEY=AIzaSy...your_key_here
DB_URL=postgresql://postgres:password@localhost:5432/mas_db
```

**Important:** Add `.env` to your `.gitignore` so you don't commit your API key!

```bash
echo ".env" >> .gitignore
```

---

### 4. Update Your `config.py`

```python
import os
from dotenv import load_dotenv

load_dotenv()

# API Keys
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Database
DB_URL = os.getenv("DB_URL", "postgresql://postgres:password@localhost:5432/mas_db")

# Model Settings
MODEL_NAME = "gemini-1.5-pro"
DEFAULT_TEMPERATURE = 0.7

# Temperature per agent (some need more creativity, some need precision)
AGENT_TEMPS = {
    "input_parser": 0.3,      # Need precision for field extraction
    "classifier": 0.2,        # Need consistent categorization
    "strategy": 0.5,          # Some creativity for strategy
    "icp_matcher": 0.0,       # Pure database query, no creativity needed
    "platform_decision": 0.4, # Logical reasoning
    "content_generator": 0.8  # High creativity for writing content
}
```

---

### 5. Test Your Gemini Connection

Create a test file `test_gemini.py`:

```python
import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

# Initialize Gemini
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-pro",
    temperature=0.7,
    google_api_key=os.getenv("GOOGLE_API_KEY")
)

# Test prompt
response = llm.invoke("Say 'Hello! Gemini is working!' and nothing else.")
print(response.content)
```

Run it:
```bash
python test_gemini.py
```

Expected output:
```
Hello! Gemini is working!
```

If you see this, Gemini is connected! ✅

---

## Gemini vs Claude vs GPT-4 — What You Should Know

### **Gemini 1.5 Pro Strengths:**
- ✅ **Large context window** — 2 million tokens (way more than Claude/GPT-4)
- ✅ **Fast** — similar speed to GPT-4
- ✅ **Good at structured output** — handles JSON well
- ✅ **Free tier is generous** — 15 RPM is enough for development

### **Gemini 1.5 Pro Limitations:**
- ⚠️ **Slightly less creative writing** than Claude for marketing copy
- ⚠️ **Function calling** is less mature than OpenAI's (but you're using JSON prompting, so this doesn't matter)

### **For Your Project:**
Gemini 1.5 Pro is **perfect** because:
- Your agents need structured outputs (JSON) — Gemini handles this well
- You're not doing creative fiction writing — you're doing B2B sales content
- The free tier covers your entire development/testing phase
- LangChain integration is solid

---

## Rate Limits (Free Tier)

| Limit | Value |
|-------|-------|
| Requests per minute | 15 |
| Requests per day | 1500 |
| Tokens per minute | 32,000 |

**Your system makes ~6 LLM calls per run:**
1. Input parser
2. Classifier
3. Strategy
4. Platform decision (with reasoning)
5. Content generation (might be 2-3 calls for all channels)

So you can run the full pipeline ~150-200 times per day on the free tier.

---

## If You Hit Rate Limits

### Option 1: Add Retry Logic
```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def call_llm(prompt):
    return llm.invoke(prompt)
```

### Option 2: Upgrade to Paid
Gemini pricing is cheap:
- **$0.075 per 1M input tokens**
- **$0.30 per 1M output tokens**

Running your pipeline 1000 times would cost ~$0.50

---

## Common Gemini Issues & Fixes

### Issue: "API key not valid"
**Fix:** Make sure your `.env` file is in the project root and you're running `load_dotenv()`

### Issue: "Rate limit exceeded"
**Fix:** Wait 60 seconds or add exponential backoff retry logic

### Issue: "Model not found"
**Fix:** Use exactly `"gemini-1.5-pro"` (not `gemini-pro` or `gemini-1.5-pro-latest`)

### Issue: Gemini returns non-JSON text
**Fix:** In your prompts, be very explicit:
```python
prompt = """
Extract these fields as JSON. Return ONLY the JSON object with no explanation.
Do not include markdown code blocks or any text outside the JSON.

{
  "field1": "value",
  "field2": "value"
}
"""
```

---

## Next Steps

1. ✅ Get your API key from https://aistudio.google.com/app/apikey
2. ✅ Install packages: `pip install langchain-google-genai langchain langgraph sqlalchemy psycopg2-binary python-dotenv`
3. ✅ Create `.env` file with `GOOGLE_API_KEY=...`
4. ✅ Run `python test_gemini.py` to verify connection
5. ✅ Use the updated `COPILOT_PROMPT.md` to generate your multi-agent system

---

## Useful Links

- Gemini API Docs: https://ai.google.dev/gemini-api/docs
- LangChain Gemini Integration: https://python.langchain.com/docs/integrations/chat/google_generative_ai
- Get API Key: https://aistudio.google.com/app/apikey
- Pricing: https://ai.google.dev/pricing

---

**You're all set! Gemini is a great choice for this project.** 🚀
