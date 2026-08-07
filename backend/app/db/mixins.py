from sqlalchemy import Column, String
from sqlalchemy.ext.declarative import declared_attr

class TenantMixin:
    """
    Mixin to add tenant support to models.
    """
    @declared_attr
    def tenant_id(cls):
        # Using String for UUID or other tenant identifier
        # nullable=True temporarily to allow migration of existing data, 
        # but should be False in production for strict isolation.
        return Column(String, index=True, nullable=True)
