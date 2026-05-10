from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any, Dict
from datetime import datetime

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str

    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class AnalysisRequest(BaseModel):
    text: str
    functions: List[str] = ['spelling', 'water', 'long_sentences', 'style', 'tone', 'syntax']

class SaveTextRequest(BaseModel):
    title: str
    content: str

class SaveTextWithAnalysisRequest(SaveTextRequest):
    analysis: Optional[Dict[str, Any]] = None

class HistoryItem(BaseModel):
    id: int
    title: str
    content: str
    saved_at: datetime
    class Config:
        orm_mode = True