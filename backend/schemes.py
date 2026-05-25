from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Optional, Any, Dict
from datetime import datetime

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str
    registered_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class AnalysisRequest(BaseModel):
    text: str
    functions: List[str] = ['spelling', 'water', 'long_sentences', 'style', 'tone', 'syntax']

class RewriteRequest(BaseModel):
    text: str
    style: str = "formal"

class RewriteResponse(BaseModel):
    rewritten: str
    style: str

class ApplyFixesRequest(BaseModel):
    text: str
    functions: List[str] = ["spelling"]
    analysis: Optional[Dict[str, Any]] = None  # устарело: анализ всегда выполняется на сервере

class ApplyFixesResponse(BaseModel):
    fixed_text: str
    applied_count: int
    applied: List[Dict[str, Any]] = []
    engine: str = "dict-v3"

class SaveTextRequest(BaseModel):
    title: str
    content: str

class SaveTextWithAnalysisRequest(SaveTextRequest):
    analysis: Optional[Dict[str, Any]] = None

class HistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    saved_at: datetime
