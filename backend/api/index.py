import sys
import os

# Add the parent backend directory to the python path so it can find main.py and database.py
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
