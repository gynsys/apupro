from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base
import uuid

def generate_uuid():
    return str(uuid.uuid4())

class BackupLog(Base):
    __tablename__ = "backup_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False, index=True)
    user_email = Column(String, nullable=False)
    budget_id = Column(String, nullable=False)
    budget_name = Column(String, nullable=False)
    action = Column(String, nullable=False)  # 'export' or 'import'
    status = Column(String, nullable=False)  # 'success' or 'failed'
    error_message = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)