"""Bounded, expiring in-memory reviews. Never persist source documents.

Selections refer to the exact detection snapshot the user reviewed, not a
fresh (potentially different) OCR result. Tokens are unguessable and bound to
both source bytes and format. Restart/expiry requires an explicit new review.
"""
from collections import OrderedDict
from copy import deepcopy
import secrets
import threading
import time
from fastapi import HTTPException
from backend.engine import fingerprint

TTL_SECONDS = 600
MAX_REVIEWS = 16
_lock = threading.Lock()
_reviews = OrderedDict()


def _expire():
    now = time.monotonic()
    for token in list(_reviews):
        if _reviews[token][0] <= now:
            del _reviews[token]


def save(data, ext, findings, notes):
    with _lock:
        _expire()
        while len(_reviews) >= MAX_REVIEWS:
            _reviews.popitem(last=False)
        token = secrets.token_urlsafe(32)
        _reviews[token] = (time.monotonic() + TTL_SECONDS, fingerprint(data), ext,
                           deepcopy(findings), list(notes))
        return token


def get(token, data, ext):
    with _lock:
        _expire()
        entry = _reviews.get(token)
        if entry is None:
            raise HTTPException(409, "Review expired or server restarted. Analyze again and review the new findings.")
        _, digest, source_ext, findings, notes = entry
        if source_ext != ext or digest != fingerprint(data):
            raise HTTPException(409, "File differs from the reviewed copy. Analyze again.")
        return deepcopy(findings), list(notes)
