from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("arko_admins.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="system")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Optional: Relationship back to user if needed (assuming User is defined elsewhere)
    # user = relationship("ArkoUser", back_populates="notifications")
