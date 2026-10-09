"""Held-out synthetic evaluation examples; separate from the matching corpus."""
import re

import pytest
from sklearn.metrics import classification_report, f1_score, recall_score

from app.config import Settings
from services.routing.classifier import RequestClassifier


EVALUATION = {
    "coding": (
        "Repair my Python dictionary comprehension.",
        "Implement pagination in a React table.",
        "Find the bug in this code for parsing dates.",
        "Refactor this SQL query to avoid nested joins.",
        "Debug an exception in my JavaScript promise chain.",
        "Write unit tests for the password validator.",
        "How do I fix this Rust lifetime compiler failure?",
        "Add a CSS media query for mobile screens.",
        "Create a TypeScript interface for the API response.",
        "Implement a regex for matching postal codes.",
        "Explain this code: def count(items): return len(items)",
        "Help me resolve this HTML rendering bug.",
        "Write a program implementing a queue data structure.",
        "Review this endpoint implementation for errors.",
        "Create a shell script that renames images.",
    ),
    "reasoning": (
        "Prove the square of an odd integer is odd.",
        "Solve a quadratic equation using factorization.",
        "Calculate the probability of rolling doubles.",
        "Find the integral of the sine function.",
        "Calculate the derivative of x cubed.",
        "Deduce the culprit from these witness statements.",
        "Evaluate the impact of doubling our service prices.",
        "Compare and contrast two strategies given limited resources.",
        "Which architectural decision minimizes failure risk?",
        "Formulate a plan to optimize costs under these constraints.",
        "Use logic to test whether this inference is valid.",
        "Explain the proof of the Pythagorean theorem.",
        "Analyze the trade-offs of renting versus buying.",
        "Check whether the evidence supports this hypothesis.",
        "Work out the expected value of these outcomes.",
    ),
    "general": (
        "Explain the function of leaves in plants.",
        "Summarize this memo about school policies.",
        "Tell me about the history of space exploration.",
        "Give an overview of coral reef ecology.",
        "Describe how solar panels produce electricity.",
        "Briefly explain the history of paper money.",
        "Explain how the kidneys filter blood.",
        "Give a summary of the attached fictional story.",
        "Tell me about the migration of monarch butterflies.",
        "Describe the culture of ancient Greece.",
        "Explain what happens during a lunar eclipse.",
        "Give an overview of the different ocean currents.",
        "Summarize the plot of a detective novel.",
        "Describe the role of public libraries.",
        "Tell me about clouds and weather patterns.",
    ),
    "simple": (
        "Where can I go to get coffee?", "Return the library book on Friday.",
        "Send greetings from Paris.", "What does 'serene' mean?",
        "Write a birthday wish for my sister.", "Translate thank you into Spanish.",
        "Who wrote Macbeth?", "Suggest a name for my puppy.",
        "Give me a synonym for tired.", "Make this email sound friendly.",
        "Correct the spelling of 'recieve'.", "Hello there!",
        "Thanks, that helped.", "Tell me a joke about penguins.",
        "Name three vegetables.",
    ),
}


def baseline_task(text):
    # Frozen pre-change keyword baseline, evaluated on one user turn.
    coding = r"\b(def|class|import|function|const|let|var|return|async|await|select|from|where|python|javascript|typescript|react|html|css|c\+\+|java|rust|go|sql|leetcode|debug|refactor|algorithm|code|bug|syntax|api|json|endpoint|schema|regex|pointer|dataframe)\b|```"
    reasoning = r"\b(prove|proof|math|theorem|equation|solve|calculus|integral|derivative|algebra|step-by-step|step by step|multi-step|logic|deduce|hypothesis|evaluate the impact|trade-offs|tradeoffs|compare and contrast|architectural decision|formulate)\b"
    general = r"\b(summarize|summary|overview|general knowledge|briefly|tell me about|history of)\b"
    for label, pattern in (("coding", coding), ("reasoning", reasoning), ("general", general)):
        if re.search(pattern, text, re.I):
            return label
    return "simple"


def test_held_out_classifier_improves_baseline():
    classifier = RequestClassifier()
    expected, previous, current = [], [], []
    for label, examples in EVALUATION.items():
        for text in examples:
            expected.append(label)
            previous.append(baseline_task(text))
            current.append(classifier.classify(text, [{"role": "user", "content": text}]).task_type)
    print("\nBefore:\n", classification_report(expected, previous, zero_division=0))
    print("After:\n", classification_report(expected, current, zero_division=0))
    assert f1_score(expected, current, average="macro") > f1_score(expected, previous, average="macro")
    labels = ["coding", "reasoning"]
    assert all(new >= old for new, old in zip(
        recall_score(expected, current, labels=labels, average=None),
        recall_score(expected, previous, labels=labels, average=None),
    ))


def test_original_task_and_forwarded_tokens_are_separate():
    classifier = RequestClassifier(lambda text: len(text.split()))
    original = [{"role": "system", "content": "You write Python code."},
                {"role": "user", "content": "Prove this theorem."}]
    forwarded = [{"role": "system", "content": "You write Python code."},
                 {"role": "user", "content": "this theorem."}]
    result = classifier.classify("ignored duplicated canonical prompt", forwarded, original_messages=original)
    assert result.task_type == "reasoning"
    assert result.estimated_input_tokens == 6
    assert result.context_size == 6


@pytest.mark.parametrize("latest, expected", [("Why?", "coding"), ("Tell me about birds.", "general")])
def test_latest_user_and_followup_context(latest, expected):
    messages = [{"role": "user", "content": "Debug my Python script."},
                {"role": "assistant", "content": "Solve an equation."},
                {"role": "user", "content": latest}]
    assert RequestClassifier().classify("", messages).task_type == expected


def test_urgency_uses_words_and_task_complexity():
    classifier = RequestClassifier(lambda text: len(text.split()))
    for text, urgent in [("Explain breakfast traditions.", False), ("Explain quickly how planets form.", True)]:
        result = classifier.classify(text, [{"role": "user", "content": text}])
        assert result.latency_sensitive == urgent
    result = classifier.classify("", [{"role": "user", "content": "Solve the equation."}])
    assert result.complexity == "high"


def test_strategy_settings_validation():
    assert Settings(_env_file=None).compression_strategy == "conservative_tfidf"
    assert Settings(_env_file=None, compression_strategy="basic").compression_strategy == "basic"
    with pytest.raises(ValueError):
        Settings(_env_file=None, compression_strategy="invalid")


@pytest.mark.parametrize("text, expected", [
    ("Prove the complexity of this algorithm.", "reasoning"),
    ("Solve the equation using this code: ```python\nx = 2\n```", "coding"),
    ("Summarize the history of Go.", "general"),
    ("Where should I go after I return from class?", "simple"),
])
def test_mixed_tasks_and_misleading_keywords(text, expected):
    assert RequestClassifier().classify("", [{"role": "user", "content": text}]).task_type == expected


def test_system_instructions_do_not_override_latest_task():
    messages = [{"role": "system", "content": "Write Python code and solve equations."},
                {"role": "user", "content": "Hello there!"}]
    assert RequestClassifier().classify("", messages).task_type == "simple"
