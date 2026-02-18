import json
from types import SimpleNamespace

import sys
import os
import pytest

# Ensure project root is on sys.path so tests can import `graph`
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import graph


def make_state():
    return {
        "user_input": "Interested in pricing and integrations",
        "task_type": "",
        "platform": "",
        "tone": "",
        "cta": "",
        "urgency_level": "",
        "audience_archetype": "",
        "time": "2026-02-17T12:00:00Z",
        "location": "US",
        "business_behavior": "trial_signup",
        "user_intent": "learn_pricing",
        "final_response": "",
        "feedback_score": None,
        "classification_confidence": None,
    }


def test_classifier_valid_json(monkeypatch):
    resp_text = '{"category":"sales","confidence":0.85,"time":"2026-02-17T12:00:00Z","location":"US","business_behavior":"trial_signup","user_intent":"learn_pricing"}'
    monkeypatch.setattr(graph.client.models, "generate_content", lambda model, contents: SimpleNamespace(text=resp_text))

    state = make_state()
    result = graph.classify_node(state)

    assert result["task_type"] == "sales"
    assert result["classification_confidence"] is not None
    assert result["classification_confidence"] >= 0.8


def test_classifier_malformed_fallback(monkeypatch):
    # LLM returns malformed text; classifier should fallback to 'general'
    resp_text = 'I think this is probably sales but not sure.'
    monkeypatch.setattr(graph.client.models, "generate_content", lambda model, contents: SimpleNamespace(text=resp_text))

    state = make_state()
    result = graph.classify_node(state)

    assert result["task_type"] == "general"
    assert result["classification_confidence"] == 0.0
