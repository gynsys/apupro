
import sys
from unittest.mock import MagicMock
sys.modules['psycopg2'] = MagicMock()
try:
    from app.main import app
    print('SUCCESS')
except Exception as e:
    import traceback
    traceback.print_exc()

