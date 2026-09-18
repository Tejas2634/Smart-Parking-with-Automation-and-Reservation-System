import sys
import os
import uvicorn

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

if __name__ == "__main__":
    print("=" * 65)
    print(" [Smart Parking System] ANPR & Location Tracer Web Platform")
    print("=" * 65)
    print(" Rates: Bike: Rs. 30/hour | Car: Rs. 50/hour")
    print(" Local URL:   http://127.0.0.1:8000")
    print(" API Docs:    http://127.0.0.1:8000/docs")
    print("=" * 65)

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )
