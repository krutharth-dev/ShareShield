"""Unified API. In-memory capabilities authorize private, expiring temporary files.

Run a single worker per container. Restart/sleep invalidates sessions. Do not expose
this experimental service to real private documents before deployment QA.
"""
from __future__ import annotations
import asyncio
import hashlib
import os
import re
import secrets
import shutil
import tempfile
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated
from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Form, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, ConfigDict
from backend.app.services.integrated import analyze_document, redact_document
from backend.verification.pdf_verifier import verify_pdf, VerificationInput

ROOT=Path(tempfile.mkdtemp(prefix='shareshield-')); ROOT.chmod(0o700)
TTL=900; MAX_BYTES=8*1024*1024; records={}; gate=asyncio.Semaphore(1)

def cleanup():
    for fid,r in list(records.items()):
        if time.time()>r['expires']:
            shutil.rmtree(r['dir'],ignore_errors=True);records.pop(fid,None)

@asynccontextmanager
async def lifespan(app):
    async def janitor():
        while True:
            await asyncio.sleep(30);cleanup()
    task=asyncio.create_task(janitor())
    yield
    task.cancel();shutil.rmtree(ROOT,ignore_errors=True);records.clear()

app=FastAPI(title='ShareShield',version='1.0.0',lifespan=lifespan)

@app.middleware('http')
async def protect(request:Request,call_next):
    origin=request.headers.get('origin')
    allowed=os.environ.get('SHARESHIELD_ORIGIN','http://localhost:5173')
    if request.method=='POST' and origin and origin!=allowed:
        return JSONResponse({'detail':'Cross-origin request rejected'},status_code=403)
    try:
        if int(request.headers.get('content-length','0'))>MAX_BYTES+65536:
            return JSONResponse({'detail':'Upload too large'},status_code=413)
    except ValueError:
        return JSONResponse({'detail':'Invalid content length'},status_code=400)
    if request.method=='POST':
        chunks=[];total=0
        async for chunk in request.stream():
            total+=len(chunk)
            if total>MAX_BYTES+65536:
                return JSONResponse({'detail':'Upload too large'},status_code=413)
            chunks.append(chunk)
        request._body=b''.join(chunks)
    response=await call_next(request)
    response.headers['Cache-Control']='no-store'
    response.headers['X-Content-Type-Options']='nosniff'
    return response

@app.get('/health')
@app.get('/api/health')
def health():
    import pytesseract
    try: langs=pytesseract.get_languages(config='')
    except Exception: langs=[]
    return {'status':'ok' if 'eng' in langs else 'degraded','mode':'python','languages':langs,'formats':['pdf','png','jpeg'],'demo_only':True}

@app.post('/api/v1/analyze')
async def analyze(files:Annotated[list[UploadFile],File(...)],language:Annotated[str,Form()]='eng'):
    cleanup()
    if len(files)!=1: raise HTTPException(400,'Send one file per request; the client manages the batch queue.')
    if len(records)>=20 or gate.locked():raise HTTPException(429,'Processing capacity reached; retry later.')
    upload=files[0];suffix=Path(upload.filename or '').suffix.lower()
    if suffix not in {'.pdf','.png','.jpg','.jpeg'}:raise HTTPException(415,'Unsupported format')
    fid=secrets.token_hex(16);folder=ROOT/fid;folder.mkdir(mode=0o700)
    source=folder/('input'+suffix)
    try:
        async with gate:
            size=0
            with source.open('wb') as f:
                while chunk:=await upload.read(65536):
                    size+=len(chunk)
                    if size>MAX_BYTES:raise HTTPException(413,'File exceeds 8 MB')
                    f.write(chunk)
            source.chmod(0o600)
            if not size:raise HTTPException(400,'Empty file')
            header=source.read_bytes()[:8]
            valid=(suffix=='.pdf' and header.startswith(b'%PDF-')) or (suffix=='.png' and header.startswith(b'\x89PNG\r\n\x1a\n')) or (suffix in {'.jpg','.jpeg'} and header.startswith(b'\xff\xd8\xff'))
            if not valid:raise HTTPException(415,'File signature mismatch')
            findings,warnings=await asyncio.to_thread(analyze_document,source,language)
            token=secrets.token_urlsafe(32)
            records[fid]={'dir':folder,'source':source,'token':hashlib.sha256(token.encode()).digest(),'findings':findings,'expires':time.time()+TTL,'language':language,'output':None}
            public=[{k:v for k,v in f.items() if k not in {'value'}} for f in findings]
            return {'files':[{'file_id':fid,'filename':Path(upload.filename).name,'status':'ready','findings':public,'warnings':warnings,'language':language,'expires_in':TTL,'access_token':token}]}
    except HTTPException:
        shutil.rmtree(folder,ignore_errors=True);raise
    except Exception:
        shutil.rmtree(folder,ignore_errors=True);raise HTTPException(422,'Document processing failed; check format, language availability and document limits.')
    finally:await upload.close()

def authorized(fid,authorization):
    cleanup()
    if not re.fullmatch('[a-f0-9]{32}',fid):raise HTTPException(404,'Unknown or expired file')
    r=records.get(fid)
    token=authorization[7:] if authorization and authorization.startswith('Bearer ') else ''
    if not r or not secrets.compare_digest(r['token'],hashlib.sha256(token.encode()).digest()):raise HTTPException(404,'Unknown or expired file')
    return r

class Selection(BaseModel):
    model_config=ConfigDict(extra='forbid')
    finding_ids:list[str]=Field(max_length=500)

@app.post('/api/v1/files/{file_id}/redact')
async def redact(file_id:str,selection:Selection,authorization:Annotated[str|None,Header()]=None):
    r=authorized(file_id,authorization)
    if gate.locked():raise HTTPException(429,'Processing busy; retry later')
    selected=set(selection.finding_ids);available={f['id']:f for f in r['findings']}
    if len(selected)!=len(selection.finding_ids) or not selected<=available.keys():raise HTTPException(422,'Invalid finding selection')
    regions=[box for fid in selected for box in available[fid]['regions']]
    values=[available[fid]['value'] for fid in selected]
    output=r['dir']/('redacted-'+secrets.token_hex(8)+r['source'].suffix)
    async with gate:
        try:
            actual=await asyncio.to_thread(redact_document,r['source'],output,regions)
            if actual.suffix=='.pdf':
                report=await asyncio.to_thread(verify_pdf,VerificationInput(actual,selected_findings=values,ocr_language=r['language'],timeout_seconds=90))
            else:
                fresh,_=await asyncio.to_thread(analyze_document,actual,r['language'])
                report={'status':'FLAG' if fresh else 'UNVERIFIED','checks':[{'name':'saved_image_ocr','status':'passed'}],'warnings':['Standalone image verification has not completed independent validation.'],'remaining_findings':fresh}
            # Never send raw residual values or exception traces to the browser.
            report['remaining_count']=len(report.pop('remaining_findings',[]))
            for c in report.get('checks',[]):
                if c.get('status')=='failed':c['detail']='Required verification check failed.'
            report['sha256']=hashlib.sha256(actual.read_bytes()).hexdigest()
            r['output']=actual
            return {'file_id':file_id,'download_url':f'/api/v1/files/{file_id}/download','verification':report}
        except Exception:
            output.unlink(missing_ok=True);raise HTTPException(422,'Redaction or verification failed')

@app.get('/api/v1/files/{file_id}/download')
def download(file_id:str,authorization:Annotated[str|None,Header()]=None):
    r=authorized(file_id,authorization)
    if not r['output']:raise HTTPException(404,'No exported output')
    return FileResponse(r['output'],filename='redacted'+r['output'].suffix)

@app.delete('/api/v1/files/{file_id}')
def remove(file_id:str,authorization:Annotated[str|None,Header()]=None):
    r=authorized(file_id,authorization);shutil.rmtree(r['dir'],ignore_errors=True);records.pop(file_id,None)
    return {'deleted':True}
