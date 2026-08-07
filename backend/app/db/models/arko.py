from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.arko_base import ArkoBase

class ArkoPost(ArkoBase):
    __tablename__ = "arko_posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    excerpt = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    category = Column(String(100), nullable=True)
    author = Column(String(100), nullable=True)
    status = Column(String(50), default="published") # "draft" | "published"
    seo_config = Column(JSONB, nullable=True)
    published_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ArkoAdmin(ArkoBase):
    __tablename__ = "arko_admins"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    site_config = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ArkoUser(ArkoBase):
    __tablename__ = "arko_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    projects_3d = relationship("ArkoProject3D", back_populates="user")


class ArkoProject(ArkoBase):
    __tablename__ = "arko_projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    category = Column(String(100), nullable=True)
    image_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ArkoProject3D(ArkoBase):
    __tablename__ = "arko_projects_3d"

    id = Column(String(50), primary_key=True, index=True) # UUID
    name = Column(String(255), nullable=False)
    user_id = Column(Integer, ForeignKey("arko_users.id"), nullable=True)
    topology = Column(JSONB, nullable=False, default=dict)
    results = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("ArkoUser", back_populates="projects_3d")
