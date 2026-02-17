import os
from dotenv import load_dotenv
from typing import TypedDict

from google import genai
from langgraph.graph import StateGraph, END

# -----------------------
# 1. Load Environment
# -----------------------

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    raise ValueError("GOOGLE_API_KEY not found in environment variables.")

# Create GenAI client (NEW SDK)
client = genai.Client(api_key=api_key)

MODEL_NAME = "gemini-2.5-flash"


# -----------------------
# 2. Define Graph State
# -----------------------

class GraphState(TypedDict):
    user_input: str
    task_type: str
    final_response: str


# -----------------------
# 3. Classifier Node
# -----------------------

def classify_node(state: GraphState) -> GraphState:
    user_text = state["user_input"]

    prompt = f"""
    Classify the user request into one of these categories:
    - marketing
    - sales
    - general

    User request: {user_text}

    Only return the category name.
    """

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )

    category = response.text.strip().lower()

    # Safety fallback: ensure category is one of the allowed values
    allowed = ["marketing", "sales", "general"]
    if category not in allowed:
        category = "general"

    return {
        **state,
        "task_type": category
    }


# -----------------------
# 4. Content Generator Node
# -----------------------

def content_node(state: GraphState) -> GraphState:
    task_type = state["task_type"]
    user_text = state["user_input"]

    prompt = f"""
    You are a {task_type} assistant.

    Write a short helpful response for:
    {user_text}
    """

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )

    return {
        **state,
        "final_response": response.text.strip()
    }


# -----------------------
# 5. Build Graph
# -----------------------

def build_graph():
    builder = StateGraph(GraphState)

    builder.add_node("classifier", classify_node)
    builder.add_node("content", content_node)

    builder.set_entry_point("classifier")
    builder.add_edge("classifier", "content")
    builder.add_edge("content", END)

    return builder.compile()


# -----------------------
# 6. Compiled Graph Instance
# -----------------------

app_graph = build_graph()
