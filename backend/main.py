# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware

# app = FastAPI(title="Papyris Backend API")

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# @app.get("/health")
# def health_check():
#     return {"status": "ok", "service": "backend"}

# @app.get("/")
# def home():
#     return {"message": "Papyris backend running"}

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import jwt
from datetime import datetime, timedelta

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,          # ALLOW frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JWT_SECRET = "016249cd8c61975d617619beda6b80a0"
JWT_ALGORITHM = "HS256"

class LoginRequest(BaseModel):
    username: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/auth/login")
def login(payload: LoginRequest):
    token = jwt.encode(
        {
            "user_id": payload.username,
            "exp": datetime.utcnow() + timedelta(hours=8)
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": payload.username
    }
