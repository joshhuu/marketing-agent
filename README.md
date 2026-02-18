# Multi-Agent Marketing Content Generation System

An intelligent B2B sales/marketing automation system powered by LangGraph and Google Gemini.

## Overview

This system takes natural language input and automatically:
1. **Classifies** the task
2. **Finds** the best prospects from your database
3. **Decides** which channel to use (LinkedIn/Email/Call)
4. **Generates** personalized content

## Architecture

```
User Input (natural language)
    ↓
Input Parser → extracts context fields
    ↓
Classifier (Agent 1) → categorizes the task
    ↓
Strategy → determines tone & urgency
    ↓
ICP Matcher (Agent 2) → finds top prospects
    ↓
Platform Decision (Agent 3) → selects best channel
    ↓
Content Generator (Agent 4) → creates personalized messages
```

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Environment Variables

Create a `.env` file in the project root:

```env
GOOGLE_API_KEY=your_google_api_key_here
DATABASE_URL=postgresql://postgres:password@localhost:5432/mas_db
LOG_LEVEL=INFO
```

### 3. Ensure Database is Running

Make sure your PostgreSQL database is running and seeded with data:

```bash
python seed_final.py
```

## Usage

### Run with Default Test Prompt

```bash
python main.py
```

### Run with Custom Prompt

```bash
python main.py "I'm selling cybersecurity software to CTOs at tech companies in San Francisco"
```

### Example Prompts

1. **Lead Generation**:
   ```
   I'm selling cybersecurity software to CTOs at tech companies in San Francisco
   ```

2. **Re-engagement**:
   ```
   Need to re-engage HR directors in UK who didn't respond to our last email about payroll automation
   ```

3. **Product Launch**:
   ```
   Promoting our new AI analytics feature to data analysts at Fortune 500 companies
   ```

## Output

The system generates:

- **Classification**: Task category and confidence score
- **Strategy**: Tone, CTA type, and urgency level
- **Top Prospects**: 10-15 best-fit prospects from database
- **Channel Selection**: Optimal channel with reasoning
- **Content**: Personalized messages for all 3 channels:
  - LinkedIn message (150-200 words)
  - Email (subject + body)
  - Call script (opener, objections, close)

## Project Structure

```
marketing-agent/
├── main.py                    # Entry point
├── graph.py                   # LangGraph workflow
├── state.py                   # State schema
├── config.py                  # Configuration
├── database.py                # SQLAlchemy models
├── nodes/                     # Agent nodes
│   ├── input_parser.py
│   ├── classifier.py
│   ├── strategy.py
│   ├── icp_matcher.py
│   ├── platform_decision.py
│   └── content_generator.py
├── prompts/                   # LLM prompts
│   ├── classifier_prompt.py
│   ├── strategy_prompt.py
│   ├── icp_prompt.py
│   ├── platform_prompt.py
│   └── content_prompt.py
└── utils/                     # Utilities
    ├── llm.py
    └── db_queries.py
```

## Configuration

### Temperature Settings

Different agents use different temperature settings for optimal performance:

- **Input Parser**: 0.3 (structured extraction)
- **Classifier**: 0.2 (deterministic)
- **Strategy**: 0.5 (balanced)
- **ICP Matcher**: 0.3 (analytical)
- **Platform Decision**: 0.4 (data-driven)
- **Content Generator**: 0.7 (creative)

### Database Schema

The system expects these tables:
- `prospects`: Contact information and ICP scoring
- `products`: Product/service details
- `engagement_history`: Past interaction data
- `classifications`: Audit trail

## Troubleshooting

### Common Issues

1. **"No module named 'langchain_google_genai'"**
   - Run: `pip install langchain-google-genai`

2. **"GOOGLE_API_KEY not found"**
   - Set the environment variable: `export GOOGLE_API_KEY=your_key`
   - Or create a `.env` file

3. **Database connection errors**
   - Verify PostgreSQL is running
   - Check DATABASE_URL in config
   - Ensure database is seeded

4. **No prospects found**
   - Check database has data
   - Verify seed_final.py was run successfully
   - Check query filters in icp_matcher.py

## License

MIT
