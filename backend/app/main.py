from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import ProgrammingError
from app.core.config import settings
from app.api.v1.projects import router as projects_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.resources import router as resources_router
from app.api.v1.users import router as users_router
from app.api.v1.project_workspace import router as project_workspace_router
from app.api.v1.workspaces import router as workspaces_router

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
app.include_router(resources_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(project_workspace_router, prefix=settings.API_V1_STR)
app.include_router(workspaces_router, prefix=settings.API_V1_STR)


@app.exception_handler(ProgrammingError)
async def database_programming_error(request, error: ProgrammingError):
    if getattr(error.orig, "pgcode", None) in {"42P01", "42703"} and any(
        name in (error.statement or "")
        for name in ("workspaces", "workspace_id")
    ):
        return JSONResponse(status_code=503, content={
            "detail": "Workspace schema is not ready. A separately approved database migration is required."
        })
    if getattr(error.orig, "pgcode", None) in {"42P01", "42703"} and any(name in (error.statement or "") for name in ("users", "project_memberships", "assignee_id")):
        return JSONResponse(status_code=503, content={"detail": "User integration schema is not ready. A separately approved database migration is required."})
    if getattr(error.orig, "pgcode", None) == "42P01" and "project_resources" in (error.statement or ""):
        return JSONResponse(status_code=503, content={
            "detail": "Project Resources is awaiting its database migration. Please contact the workspace administrator."
        })
    return JSONResponse(status_code=500, content={"detail": "A database error occurred."})

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
