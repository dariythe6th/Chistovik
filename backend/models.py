from sqlalchemy import Column, Integer, String, Text as SQLText, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String, default="user")
    registered_at = Column(DateTime, default=datetime.datetime.utcnow)

    texts = relationship("Text", back_populates="user")
    saved_texts = relationship("SavedText", back_populates="user")

class Text(Base):
    __tablename__ = "texts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    content = Column(SQLText)
    language = Column(String, default="ru")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="texts")
    analyses = relationship("Analysis", back_populates="text")

class Analysis(Base):
    __tablename__ = "analyses"
    id = Column(Integer, primary_key=True, index=True)
    text_id = Column(Integer, ForeignKey("texts.id"))
    analysed_at = Column(DateTime, default=datetime.datetime.utcnow)
    readability_score = Column(Float)
    style_label = Column(String)
    water_percentage = Column(Float)

    text = relationship("Text", back_populates="analyses")
    spelling_errors = relationship("SpellingError", back_populates="analysis")
    readability_details = relationship("ReadabilityDetail", uselist=False, back_populates="analysis")
    style_classification = relationship("StyleClassification", uselist=False, back_populates="analysis")
    water_phrases = relationship("WaterPhrase", back_populates="analysis")
    recommendations = relationship("Recommendation", back_populates="analysis")

class SpellingError(Base):
    __tablename__ = "spelling_errors"
    id = Column(Integer, primary_key=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"))
    word = Column(String)
    position = Column(Integer)
    suggestions = Column(SQLText)  # JSON list as text
    description = Column(SQLText)

    analysis = relationship("Analysis", back_populates="spelling_errors")

class ReadabilityDetail(Base):
    __tablename__ = "readability_details"
    id = Column(Integer, primary_key=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"))
    flesch_score = Column(Float)
    coleman_liau_index = Column(Float)

    analysis = relationship("Analysis", back_populates="readability_details")

class StyleClassification(Base):
    __tablename__ = "style_classifications"
    id = Column(Integer, primary_key=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"))
    style = Column(String)
    confidence = Column(Float)

    analysis = relationship("Analysis", back_populates="style_classification")

class WaterPhrase(Base):
    __tablename__ = "water_phrases"
    id = Column(Integer, primary_key=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"))
    phrase = Column(String)
    position = Column(Integer)
    recommendation = Column(String)

    analysis = relationship("Analysis", back_populates="water_phrases")

class Recommendation(Base):
    __tablename__ = "recommendations"
    id = Column(Integer, primary_key=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"))
    type = Column(String)
    description = Column(SQLText)
    suggested_change = Column(SQLText)
    position = Column(Integer)

    analysis = relationship("Analysis", back_populates="recommendations")

class SavedText(Base):
    __tablename__ = "saved_texts"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    content = Column(SQLText)
    saved_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="saved_texts")