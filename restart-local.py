"""Compatibility entry point. Start localhost without requiring process-control permissions."""
from pathlib import Path
import runpy

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).resolve().with_name('run-local.py')), run_name='__main__')
