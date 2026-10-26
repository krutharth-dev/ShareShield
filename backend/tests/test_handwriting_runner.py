"""The result channel stays valid even when dependencies print diagnostics."""
import json
import os
from pathlib import Path
import subprocess
import sys

import pytest


@pytest.mark.parametrize('fail', [False, True])
def test_dependency_output_never_reaches_result_pipe(tmp_path, fail):
    package = tmp_path / 'backend'
    package.mkdir()
    (package / '__init__.py').write_text('')
    (package / 'engine.py').write_text(
        "import os\nprint('import diagnostic', flush=True)\nos.write(1, b'native diagnostic\\n')\n"
        "MAX_BYTES = 100\ndef validate_bytes(data): pass\n")
    (package / 'local_handwriting_worker.py').write_text(
        "import os\ndef recognize(data, ext):\n"
        "    print('private recognized text', flush=True)\n"
        "    os.write(2, b'private error detail\\n')\n" +
        ("    raise ValueError('private failure')\n" if fail else "    return []\n"))
    runner = Path(__file__).resolve().parents[1] / 'handwriting_runner.py'
    result = subprocess.run([sys.executable, str(runner), '.png'], input=b'fixture',
                            capture_output=True, env={**os.environ, 'PYTHONPATH':str(tmp_path)},
                            cwd=tmp_path, timeout=10)
    assert result.stderr == b''
    if fail:
        assert result.returncode == 1
        assert result.stdout == b''
    else:
        assert result.returncode == 0
        assert json.loads(result.stdout) == {'findings': []}
