from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.projects import router as projects_router
from app.api.v1.tasks import router as tasks_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(projects_router, prefix=settings.API_V1_STR)
app.include_router(tasks_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["system"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "database": "Neon PostgreSQL (Connected)",
    }

@app.get("/", tags=["system"])
def root():
    return {
        "message": "Welcome to Management Web Project Command Center API",
        "docs": f"{settings.API_V1_STR}/docs",
    }
