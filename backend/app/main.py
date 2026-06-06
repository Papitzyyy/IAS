from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.api.v1 import auth, tags, students, audit, responders, staff, student_portal
from app.core.config import settings

app = FastAPI(
    title="CRCY Scan and Help API",
    version="1.0.0",
    description="EVSU Student Medical Tag System — Backend API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    messages = []
    for err in exc.errors():
        loc = [str(x) for x in err.get("loc", []) if x != "body"]
        msg = err.get("msg", "Invalid value")
        if loc:
            messages.append(f"{'.'.join(loc)}: {msg}")
        else:
            messages.append(msg)
    return JSONResponse(
        status_code=422,
        content={"detail": " ".join(messages) if messages else "Validation failed."},
    )


app.include_router(auth.router,       prefix="/api/v1/auth",       tags=["Authentication"])
app.include_router(tags.router,       prefix="/api/v1",            tags=["QR Tags"])
app.include_router(students.router,   prefix="/api/v1/students",   tags=["Students"])
app.include_router(audit.router,      prefix="/api/v1/audit",      tags=["Audit Logs"])
app.include_router(responders.router, prefix="/api/v1/responders", tags=["Responders"])
app.include_router(staff.router,      prefix="/api/v1/staff",      tags=["Staff"])
app.include_router(student_portal.router, prefix="/api/v1/student-portal", tags=["Student Portal"])


@app.get("/api/v1/diagnostic/test-outbound")
def test_outbound():
    """Test if Render can make outbound HTTPS requests at all"""
    import urllib.request
    try:
        res = urllib.request.urlopen("https://api.resend.com", timeout=5.0)
        return {"status": "success", "code": res.getcode()}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/health")
def health_check():
    return {"status": "ok"}


# In development, serve the frontend and provide a root redirect.
# In production, Netlify serves the frontend separately.
if settings.APP_ENV != "production":
    @app.get("/")
    def root():
        return RedirectResponse(url="/pages/login.html")

    # Serve frontend — must be mounted last
    _FRONTEND = Path(__file__).resolve().parent.parent.parent / "frontend"
    app.mount("/", StaticFiles(directory=str(_FRONTEND), html=True), name="frontend")
