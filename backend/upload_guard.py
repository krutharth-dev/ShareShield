"""Bound uploads while receiving, before multipart parsing/spooling."""
import asyncio
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

PATHS = {'/analyze', '/preview', '/text-preview', '/redact', '/verify'}


class UploadGuard:
    def __init__(self, app, max_bytes, max_active=3, receive_timeout=15, total_receive_seconds=60):
        self.app, self.max_bytes, self.max_active = app, max_bytes, max_active
        self.active = 0
        self.receive_timeout = receive_timeout
        self.total_receive_seconds = total_receive_seconds

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope['method'] != 'POST' or scope['path'] not in PATHS:
            return await self.app(scope, receive, send)
        if self.active >= self.max_active:
            response = JSONResponse({'detail': 'Upload capacity is busy. Retry shortly.'}, 503,
                                    headers={'Retry-After': '3', 'Cache-Control': 'no-store'})
            return await response(scope, receive, send)
        self.active += 1
        consumed = 0
        deadline = asyncio.get_running_loop().time() + self.total_receive_seconds
        limit = self.max_bytes * (2 if scope['path'] == '/verify' else 1) + 1024 * 1024
        async def bounded_receive():
            nonlocal consumed
            remaining = deadline - asyncio.get_running_loop().time()
            try:
                message = await asyncio.wait_for(receive(), min(self.receive_timeout, remaining))
            except asyncio.TimeoutError as exc:
                raise HTTPException(408, 'Upload timed out; retry with a stable connection') from exc
            if message['type'] == 'http.request':
                consumed += len(message.get('body', b''))
                if consumed > limit:
                    raise HTTPException(413, 'Upload request exceeds the byte limit')
            return message
        try:
            await self.app(scope, bounded_receive, send)
        finally:
            self.active -= 1
