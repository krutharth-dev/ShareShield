import asyncio
from fastapi.testclient import TestClient
from backend.app import app
from backend import engine
from backend.upload_guard import UploadGuard


def test_chunked_multipart_is_limited_during_receive():
    def chunks():
        yield b'--x\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\n\r\n'
        for _ in range(15):
            yield b'a' * (1024 * 1024)
        yield b'\r\n--x--\r\n'
    with TestClient(app) as client:
        response = client.post('/analyze', content=chunks(),
                               headers={'Content-Type': 'multipart/form-data; boundary=x'})
    assert response.status_code == 413, response.text
    assert 'byte limit' in response.text


def test_upload_capacity_and_cleanup():
    async def scenario():
        started, release = asyncio.Event(), asyncio.Event()
        async def downstream(scope, receive, send):
            started.set()
            await release.wait()
        guard = UploadGuard(downstream, engine.MAX_BYTES, max_active=1)
        scope = {'type':'http', 'method':'POST', 'path':'/analyze'}
        async def receive(): return {'type':'http.request', 'body':b'', 'more_body':False}
        messages = []
        async def send(message): messages.append(message)
        task = asyncio.create_task(guard(scope, receive, send))
        await started.wait()
        await guard(scope, receive, send)
        assert messages[0]['status'] == 503
        task.cancel()
        try: await task
        except asyncio.CancelledError: pass
        assert guard.active == 0
    asyncio.run(scenario())


def test_stalled_upload_times_out_and_releases_slot():
    from starlette.exceptions import HTTPException
    async def scenario():
        async def downstream(scope, receive, send): await receive()
        async def receive(): await asyncio.Event().wait()
        async def send(message): pass
        guard = UploadGuard(downstream, 100, receive_timeout=.01)
        try:
            await guard({'type':'http','method':'POST','path':'/analyze'}, receive, send)
        except HTTPException as exc:
            assert exc.status_code == 408
        else:
            raise AssertionError('stalled upload did not time out')
        assert guard.active == 0
    asyncio.run(scenario())
