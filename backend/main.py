from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
from database import engine, get_db, Base, SessionLocal
from models import User, Text, Analysis, SavedText, SpellingError, WaterPhrase, Recommendation
from schemes import *
from auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_user
)
from nlp.analyzers import analyze_text
from datetime import datetime
import json

Base.metadata.create_all(bind=engine)

app = FastAPI(title="CHISTOVIK API")

def _ensure_admin_user():
    """
    Создаём администратора по умолчанию, если его нет.
    Данные для входа:
      Email: admin@example.com
      Пароль: admin
    """
    db = SessionLocal()
    try:
        admin_email = "admin@example.com"
        admin = db.query(User).filter(User.email == admin_email).first()
        if admin:
            # Поддерживаем роль админа, если пользователя уже создавали раньше
            if admin.role != "admin":
                admin.role = "admin"
                db.commit()
            return
        admin_user = User(
            name="Admin",
            email=admin_email,
            password_hash=get_password_hash("admin"),
            role="admin",
        )
        db.add(admin_user)
        db.commit()
    finally:
        db.close()

_ensure_admin_user()

def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user

@app.post("/api/register", response_model=UserOut)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_pwd = get_password_hash(user.password)
    new_user = User(name=user.name, email=user.email, password_hash=hashed_pwd)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user

@app.get("/api/admin/users", response_model=List[UserOut])
def admin_list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.registered_at.desc()).all()

@app.get("/api/admin/texts")
def admin_list_texts(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    items = (
        db.query(SavedText, User)
        .join(User, SavedText.user_id == User.id)
        .order_by(SavedText.saved_at.desc())
        .all()
    )
    return [
        {
            "id": saved.id,
            "title": saved.title,
            "content": saved.content,
            "saved_at": saved.saved_at,
            "userId": user.id,
            "userName": user.name,
            "userEmail": user.email,
        }
        for (saved, user) in items
    ]

@app.post("/api/analyze")
def analyze(req: AnalysisRequest):
    result = analyze_text(req.text, req.functions)

    result["summary"] = {
        "spelling": {"count": len(result.get("spelling_errors", []))},
        "water": {"count": len(result.get("water_phrases", []))},
        "longSentences": {"count": len(result.get("long_sentences", []))},
        "style": {"label": (result.get("style") or {}).get("label") or (result.get("style") or {}).get("style")},
        "tone": {"label": (result.get("tone") or {}).get("tone")},
        "syntax": {"issuesCount": len(result.get("syntax_issues", []))}
    }
    return result

@app.post("/api/save")
def save_text(req: SaveTextWithAnalysisRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    saved = SavedText(user_id=user.id, title=req.title, content=req.content)
    db.add(saved)
    db.commit()
    db.refresh(saved)

    if req.analysis:
        text_db = Text(user_id=user.id, content=req.content)
        db.add(text_db)
        db.commit()
        db.refresh(text_db)

        water_phrases = req.analysis.get("water_phrases") or []
        analysis_db = Analysis(
            text_id=text_db.id,
            readability_score=req.analysis.get("readability_score") or 0,
            style_label=((req.analysis.get("style") or {}).get("style")) or "neutral",
            water_percentage=len(water_phrases) / max(1, len(req.content.split())) * 100
        )
        db.add(analysis_db)
        db.commit()
        db.refresh(analysis_db)

        for err in (req.analysis.get("spelling_errors") or []):
            db.add(SpellingError(
                analysis_id=analysis_db.id,
                word=err.get("word") or "",
                position=int(err.get("position") or 0),
                suggestions=json.dumps(err.get("suggestions") or [], ensure_ascii=False),
                description=err.get("description") or ""
            ))

        for wp in water_phrases:
            db.add(WaterPhrase(
                analysis_id=analysis_db.id,
                phrase=wp.get("phrase") or "",
                position=int(wp.get("position") or 0),
                recommendation=wp.get("recommendation") or ""
            ))

        for rec in (req.analysis.get("recommendations") or []):
            db.add(Recommendation(
                analysis_id=analysis_db.id,
                type=rec.get("type") or "generic",
                description=rec.get("description") or "",
                suggested_change=rec.get("suggested_change") or "",
                position=int(rec.get("position") or -1),
            ))

        db.commit()
    return {"id": saved.id, "title": saved.title, "saved_at": saved.saved_at}

@app.get("/api/history", response_model=List[HistoryItem])
def get_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(SavedText).filter(SavedText.user_id == user.id)\
             .order_by(SavedText.saved_at.desc()).all()
    return items

@app.delete("/api/history/{item_id}")
def delete_history(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(SavedText).filter(SavedText.id == item_id, SavedText.user_id == user.id).first()
    if not item:
        raise HTTPException(status_code=404)
    db.delete(item)
    db.commit()
    return {"ok": True}