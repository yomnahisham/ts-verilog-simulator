from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Dict, Optional
import uuid
from datetime import datetime, timedelta
import json

router = APIRouter()

# In-memory storage for waveforms
waveforms: Dict[str, dict] = {}

@router.post("/upload")
async def upload_waveform(file: UploadFile = File(...)):
    """Upload a VCD file and store it in memory."""
    try:
        content = await file.read()
        waveform_id = str(uuid.uuid4())
        expiration = datetime.utcnow() + timedelta(days=365)  # 1 year expiration
        
        waveforms[waveform_id] = {
            "content": content.decode(),
            "filename": file.filename,
            "uploaded_at": datetime.utcnow().isoformat(),
            "expires_at": expiration.isoformat()
        }
        
        return {
            "waveform_id": waveform_id,
            "share_url": f"/waveform/{waveform_id}",
            "expires_at": expiration.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{waveform_id}")
async def get_waveform(waveform_id: str):
    """Retrieve a waveform by its ID."""
    if waveform_id not in waveforms:
        raise HTTPException(status_code=404, detail="Waveform not found")
    
    waveform = waveforms[waveform_id]
    expiration = datetime.fromisoformat(waveform["expires_at"])
    
    if datetime.utcnow() > expiration:
        del waveforms[waveform_id]
        raise HTTPException(status_code=404, detail="Waveform has expired")
    
    return {
        "content": waveform["content"],
        "filename": waveform["filename"],
        "uploaded_at": waveform["uploaded_at"],
        "expires_at": waveform["expires_at"]
    } 