#!/usr/bin/env python3
"""
HÕIMU Gateway Daemon Entrypoint
Delegates directly to pi.app.daemon
"""

import sys
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(BASE_DIR)
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

from pi.app.daemon import main

if __name__ == "__main__":
    main()
