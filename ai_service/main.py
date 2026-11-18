import os
import json
from datetime import date
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Try importing SDKs - if missing during development, we'll return mock data
try:
    from groq import Groq
    from openai import OpenAI
    SDK_AVAILABLE = True
except ImportError:
    SDK_AVAILABLE = False

load_dotenv()

app = FastAPI(title="BudgetEase AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PLACEHOLDERS = {"", "mock_key", "your_groq_api_key_here", "your_openai_api_key_here"}


def has_key(name: str) -> bool:
    return SDK_AVAILABLE and os.environ.get(name, "") not in PLACEHOLDERS


groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY", "mock_key")) if SDK_AVAILABLE else None
openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", "mock_key")) if SDK_AVAILABLE else None

EXTRACT_MODEL = "llama-3.1-8b-instant"
ADVISOR_MODEL = os.environ.get("ADVISOR_MODEL", "llama-3.3-70b-versatile")

DEFAULT_CATEGORIES = [
    "Housing & Rent", "Groceries", "Transport", "Utilities", "Insurance", "Health",
    "Debt Repayments", "Education", "Dining Out", "Subscriptions", "Entertainment",
    "Shopping", "Personal Care", "Other",
]


class CategorizeRequest(BaseModel):
    natural_language_input: str = Field(max_length=300)
    categories: Optional[list[str]] = None
    currency: Optional[str] = None
    today: Optional[str] = None


class ParseReceiptRequest(BaseModel):
    storage_url: str
    categories: Optional[list[str]] = None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=1500)


class AdviseRequest(BaseModel):
    question: str = Field(max_length=400)
    snapshot: dict
    history: list[ChatMessage] = []


def strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
    return text.strip()


@app.post("/categorize")
async def categorize_transaction(req: CategorizeRequest):
    categories = req.categories or DEFAULT_CATEGORIES
    today = req.today or date.today().isoformat()

    if not has_key("GROQ_API_KEY"):
        # Mock response so the UI works without keys
        return {"amount": 45.0, "merchant": "Sample merchant", "category": categories[0], "isRecurring": False, "date": today}

    prompt = f"""Extract one expense from this text: "{req.natural_language_input}"

Today is {today}. The user's currency is {req.currency or 'unknown'}; amounts are already in that currency, so never convert them.
Available categories: {', '.join(categories)}

Rules:
- "amount": the number only (e.g. "R1,200" -> 1200, "$45.50" -> 45.5).
- "merchant": a short, clean name for the expense (e.g. "Uber to airport", "Woolworths groceries").
- "category": MUST be exactly one of the available categories. Use "Other" if nothing fits and it is available.
- "isRecurring": true only if the text says it repeats (monthly, every month, subscription, rent, debit order).
- "date": YYYY-MM-DD. Resolve words like "yesterday" or "last Friday" relative to today. Use today if no date is mentioned.

Respond ONLY with JSON: {{"amount": number, "merchant": string, "category": string, "isRecurring": boolean, "date": string}}"""

    try:
        completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a precise financial data extraction API. You output ONLY valid JSON."},
                {"role": "user", "content": prompt},
            ],
            model=EXTRACT_MODEL,
            temperature=0,
            response_format={"type": "json_object"},
        )
        result = json.loads(completion.choices[0].message.content)
        if result.get("category") not in categories:
            result["category"] = "Other" if "Other" in categories else categories[0]
        return result
    except Exception as e:
        print(f"[Groq Error]: {e}")
        raise HTTPException(status_code=500, detail="Failed to categorize transaction")


@app.post("/parse-receipt")
async def parse_receipt(req: ParseReceiptRequest):
    categories = req.categories or DEFAULT_CATEGORIES

    if not has_key("OPENAI_API_KEY"):
        return {"amount": 125.50, "merchant": "Sample store", "category": categories[0], "date": date.today().isoformat()}

    instructions = (
        "Read this receipt. Extract the final total paid, the store or merchant name, and the purchase date. "
        f"Pick the best category from exactly this list: {', '.join(categories)}. "
        'Reply ONLY with JSON: {"amount": number, "merchant": string, "category": string, "date": "YYYY-MM-DD" or null}'
    )
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": instructions},
                    {"type": "image_url", "image_url": {"url": req.storage_url}},
                ],
            }],
            max_tokens=300,
        )
        result = json.loads(strip_fences(response.choices[0].message.content))
        if result.get("category") not in categories:
            result["category"] = "Other" if "Other" in categories else categories[0]
        return result
    except Exception as e:
        print(f"[OpenAI Error]: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse receipt")


ADVISOR_SYSTEM = """You are BudgetEase's friendly money coach. You help everyday people with their personal budget.

How to answer:
- Use plain, warm, everyday language. No jargon (never say "portfolio", "capital", "allocation", "directive").
- Base every answer on the numbers in the user's data below. Quote real amounts with the user's currency.
- Be specific and practical: name categories, amounts, and a concrete next step.
- Keep it short: 2 to 5 sentences, or a short list if the question needs steps.
- For "can I afford X" questions: compare X with what's left over after spending and bills, mention goals it would affect, and give a clear yes / not yet / yes-if answer.
- If the data is missing something you need (e.g. no income recorded), say what to add.
- You give general guidance, not regulated financial advice. Never recommend specific investment products.

The user's data (JSON, amounts in their currency):
"""


@app.post("/advise")
async def advise(req: AdviseRequest):
    if not has_key("GROQ_API_KEY"):
        snap = req.snapshot
        return {"answer": (
            f"This month you've earned {snap.get('income', 0)} and spent {snap.get('spending', 0)} "
            f"({snap.get('currency', '')}). Connect a Groq API key to the AI service for personalised answers."
        )}

    snapshot_json = json.dumps(req.snapshot, ensure_ascii=False)[:12000]
    messages = [{"role": "system", "content": ADVISOR_SYSTEM + snapshot_json}]
    messages += [{"role": m.role, "content": m.content} for m in req.history[-8:]]
    messages.append({"role": "user", "content": req.question})

    try:
        completion = groq_client.chat.completions.create(
            messages=messages,
            model=ADVISOR_MODEL,
            temperature=0.4,
            max_tokens=500,
        )
        return {"answer": completion.choices[0].message.content.strip()}
    except Exception as e:
        print(f"[Groq Advisor Error]: {e}")
        raise HTTPException(status_code=500, detail="Advisor unavailable")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
