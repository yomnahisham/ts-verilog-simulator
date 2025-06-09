from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Dict, Optional, List
import uuid
from datetime import datetime, timedelta
import json
import os
import shutil
import tempfile

router = APIRouter()

# Create waveforms directory in a temporary location that's guaranteed to be writable
WAVEFORMS_DIR = os.path.join(tempfile.gettempdir(), 'verilog_waveforms')
os.makedirs(WAVEFORMS_DIR, exist_ok=True)

def is_valid_vcd(content: bytes) -> bool:
    """Check if the content appears to be a valid VCD file."""
    try:
        # Check for VCD header
        header = content.decode('utf-8', errors='ignore')[:100]
        return '$date' in header or '$version' in header
    except:
        return False

@router.post("/upload")
async def upload_waveform(file: UploadFile = File(...)):
    """Upload a VCD file and store it in the filesystem."""
    try:
        content = await file.read()
        
        # Validate VCD file
        if not is_valid_vcd(content):
            raise HTTPException(status_code=400, detail="Invalid VCD file format")
            
        waveform_id = str(uuid.uuid4())
        expiration = datetime.utcnow() + timedelta(days=365)  # 1 year expiration
        
        # Create a directory for this waveform
        waveform_dir = os.path.join(WAVEFORMS_DIR, waveform_id)
        os.makedirs(waveform_dir, exist_ok=True)
        
        # Save the VCD file
        vcd_path = os.path.join(waveform_dir, 'waveform.vcd')
        with open(vcd_path, 'wb') as f:
            f.write(content)
        
        # Save metadata
        metadata = {
            "filename": file.filename,
            "uploaded_at": datetime.utcnow().isoformat(),
            "expires_at": expiration.isoformat()
        }
        metadata_path = os.path.join(waveform_dir, 'metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f)
        
        return {
            "waveform_id": waveform_id,
            "share_url": f"/api/v1/waveform/{waveform_id}",
            "expires_at": expiration.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{waveform_id}")
async def get_waveform(waveform_id: str):
    """Retrieve a waveform by its ID."""
    waveform_dir = os.path.join(WAVEFORMS_DIR, waveform_id)
    if not os.path.exists(waveform_dir):
        raise HTTPException(status_code=404, detail="Waveform not found")
    
    # Read metadata
    metadata_path = os.path.join(waveform_dir, 'metadata.json')
    try:
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading metadata: {str(e)}")
    
    # Check expiration
    expiration = datetime.fromisoformat(metadata["expires_at"])
    if datetime.utcnow() > expiration:
        # Clean up expired waveform
        try:
            shutil.rmtree(waveform_dir)
        except Exception as e:
            print(f"Error cleaning up expired waveform: {str(e)}")
        raise HTTPException(status_code=404, detail="Waveform has expired")
    
    # Read VCD file
    vcd_path = os.path.join(waveform_dir, 'waveform.vcd')
    try:
        with open(vcd_path, 'rb') as f:
            content = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading VCD file: {str(e)}")
    
    return {
        "content": content.decode('utf-8', errors='ignore'),
        "filename": metadata["filename"],
        "uploaded_at": metadata["uploaded_at"],
        "expires_at": metadata["expires_at"]
    }

@router.get("/")
async def list_waveforms():
    """List all available waveforms."""
    try:
        waveforms = []
        for waveform_id in os.listdir(WAVEFORMS_DIR):
            waveform_dir = os.path.join(WAVEFORMS_DIR, waveform_id)
            if not os.path.isdir(waveform_dir):
                continue
                
            metadata_path = os.path.join(waveform_dir, 'metadata.json')
            if not os.path.exists(metadata_path):
                continue
                
            try:
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                    
                # Check expiration
                expiration = datetime.fromisoformat(metadata["expires_at"])
                if datetime.utcnow() > expiration:
                    # Clean up expired waveform
                    try:
                        shutil.rmtree(waveform_dir)
                    except Exception as e:
                        print(f"Error cleaning up expired waveform: {str(e)}")
                    continue
                    
                waveforms.append({
                    "waveform_id": waveform_id,
                    "filename": metadata["filename"],
                    "uploaded_at": metadata["uploaded_at"],
                    "expires_at": metadata["expires_at"]
                })
            except Exception as e:
                print(f"Error reading metadata for {waveform_id}: {str(e)}")
                continue
                
        return {"waveforms": waveforms}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{waveform_id}")
async def delete_waveform(waveform_id: str):
    """Delete a waveform by its ID."""
    waveform_dir = os.path.join(WAVEFORMS_DIR, waveform_id)
    if not os.path.exists(waveform_dir):
        raise HTTPException(status_code=404, detail="Waveform not found")
        
    try:
        shutil.rmtree(waveform_dir)
        return {"message": "Waveform deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting waveform: {str(e)}") 