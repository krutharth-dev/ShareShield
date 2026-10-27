"""Keep dependency diagnostics out of the private JSON result channel."""
import json
import os
import sys
from dataclasses import asdict


def main():
    # Reserve the pipe before imports: some libraries print during import or
    # inference, including native code that bypasses redirect_stdout.
    result_fd = os.dup(sys.stdout.fileno())
    with open(os.devnull, 'w') as quiet:
        os.dup2(quiet.fileno(), sys.stdout.fileno())
        os.dup2(quiet.fileno(), sys.stderr.fileno())
    try:
        from backend import engine
        from backend.local_handwriting_worker import recognize
        payload = sys.stdin.buffer.read(engine.MAX_BYTES + 1)
        engine.validate_bytes(payload)
        findings = recognize(payload, sys.argv[1])
        body = json.dumps({'findings': [asdict(f) for f in findings]})
        with os.fdopen(result_fd, 'w') as output:
            result_fd = None
            output.write(body)
        return 0
    except Exception:
        return 1
    finally:
        if result_fd is not None:
            os.close(result_fd)


if __name__ == '__main__':
    sys.exit(main())
