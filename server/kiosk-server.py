from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, HTTPException, Form, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, create_engine
from sqlalchemy.pool import QueuePool
from database import User, Doctor, Hospital, Laboratory, Appointment, LabOrder, LabTest
from pydantic import BaseModel
from deepface import DeepFace
from typing import Annotated, Any
from dotenv import load_dotenv
import bcrypt
import os
import uuid
import shutil
import threading
import numpy as np

load_dotenv()

DATABASE_URL = str(os.getenv("DATABASE_URL"))

if DATABASE_URL is None:
    raise ValueError("Database URL is not provided")

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={
        "connect_timeout": 10,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    }
)

# ── Face embedding cache ──────────────────────────────────────────────────────
# Maps register → list of L2-normalized Facenet512 embeddings
face_cache: dict[str, list[np.ndarray]] = {}
face_cache_lock = threading.Lock()

FACE_THRESHOLD = 0.72   # cosine similarity threshold for Facenet512


def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom > 0 else 0.0


def get_embedding(img_path: str, enforce: bool = True) -> list[float] | None:
    try:
        result: Any = DeepFace.represent(
            img_path=img_path,
            model_name="Facenet512",
            detector_backend="opencv",
            enforce_detection=enforce,
            align=True,
        )

        if not result:
            return None

        embedding = result[0].get("embedding")

        if embedding is None:
            return None

        return embedding

    except Exception as e:
        print(f"Embedding error: {e}")
        return None

def build_face_cache() -> None:
    if not os.path.exists("datasets"):
        return
    new_cache: dict[str, list[np.ndarray]] = {}
    for fname in sorted(os.listdir("datasets")):
        if not fname.endswith(".jpg"):
            continue
        path = os.path.join("datasets", fname)
        emb = get_embedding(path, enforce=False)
        if emb is None:
            continue
        register = fname.split("_scan_")[0].replace(".jpg", "")
        new_cache.setdefault(register, []).append(np.array(emb, dtype=np.float32))

    with face_cache_lock:
        face_cache.clear()
        face_cache.update(new_cache)

    total = sum(len(v) for v in new_cache.values())
    print(f"[FaceCache] {len(new_cache)} users | {total} embeddings loaded")


@asynccontextmanager
async def lifespan(app: FastAPI):
    threading.Thread(target=build_face_cache, daemon=True).start()
    yield


# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(lifespan=lifespan)
router = APIRouter()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DB session ────────────────────────────────────────────────────────────────
def get_session():
    with Session(engine) as session:
        yield session

SessionDep = Annotated[Session, Depends(get_session)]

# ── Pydantic models ───────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    firstname: str
    lastname: str
    phone_number: str
    register: str
    password: str
    dan_status: bool

class LoginRequest(BaseModel):
    register: str
    password: str

class DANRequest(BaseModel):
    register: str

class MakeAppointment(BaseModel):
    appointmentTime: str
    appointmentDate: str
    doctorID: int
    doctorFirstname: str
    userID: int
    hospitalID: int
    status: str

class ChangeAppointment(BaseModel):
    appointmentID: int
    appointmentTime: str
    appointmentDate: str
    doctorID: int
    userID: int
    hospitalID: int
    status: str

class LabOrderRequest(BaseModel):
    userID: int
    labID: int
    labType: str
    testID: int

# ── Helpers ───────────────────────────────────────────────────────────────────
def get_user_images(register: str) -> list[str]:
    paths = []
    base = f"datasets/{register}.jpg"
    if os.path.exists(base):
        paths.append(base)
    i = 1
    while True:
        labeled = f"datasets/{register}_scan_{i}.jpg"
        if os.path.exists(labeled):
            paths.append(labeled)
            i += 1
        else:
            break
    return paths


def save_labeled_scan(register: str, temp_path: str) -> str:
    i = 1
    while True:
        dest = f"datasets/{register}_scan_{i}.jpg"
        if not os.path.exists(dest):
            shutil.copy(temp_path, dest)
            return dest
        i += 1


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def greetings():
    return {"message": "Welcome to the Kiosk Server"}


@app.post("/register")
def create_user(user_data: UserCreate, session: SessionDep):
    hashed = bcrypt.hashpw(user_data.password.encode(), bcrypt.gensalt()).decode()
    new_user = User(
        firstname=user_data.firstname,
        lastname=user_data.lastname,
        phone_number=user_data.phone_number,
        register=user_data.register,
        password_hash=hashed,
    )
    try:
        session.add(new_user)
        session.commit()
        session.refresh(new_user)
        return {"message": f"{new_user.firstname} registered successful", "user_id": new_user.id}
    except Exception as e:
        session.rollback()
        print(f"Register error: {e}")
        raise HTTPException(status_code=400, detail="Хэрэглэгч бүртгэгдсэн байна")


@app.post("/login")
def login(data: LoginRequest, session: SessionDep):
    db_user = session.exec(select(User).where(User.register == data.register)).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Хэрэглэгч олдсонгүй")

    if not bcrypt.checkpw(data.password.encode(), db_user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="Нууц үг эсвэл Регистрийн дугаар буруу байна")

    return {
        "message": f"{db_user.firstname} logged in",
        "firstname": db_user.firstname,
        "id": db_user.id,
        "register": db_user.register,
        "dan_status": db_user.dan_status,
    }


@app.post("/auth-and-upload/")
async def auth_and_upload(
    register: str = Form(...),
    photo: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    user = session.exec(select(User).where(User.register == register)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.dan_status:
        return {"message": f"{register} already activated DAN"}

    file_path = None
    try:
        user.dan_status = True
        session.add(user)

        os.makedirs("datasets", exist_ok=True)
        contents = await photo.read()
        file_path = os.path.join("datasets", f"{register}.jpg")
        with open(file_path, "wb") as f:
            f.write(contents)

        session.commit()
        session.refresh(user)

        # Add embedding to live cache
        emb = get_embedding(file_path, enforce=False)
        if emb is not None:
            with face_cache_lock:
                face_cache.setdefault(register, []).append(np.array(emb, dtype=np.float32))

        return {"message": f"Auth successful and photo uploaded for {register}", "dan_status": user.dan_status}

    except Exception as e:
        session.rollback()
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/face-auth")
async def face_auth(photo: UploadFile = File(...), session: Session = Depends(get_session)):
    temp_path = f"temp_scan_{uuid.uuid4()}.jpg"
    with open(temp_path, "wb") as f:
        f.write(await photo.read())

    try:
        # Extract query embedding
        query_emb = get_embedding(temp_path, enforce=True)
        if query_emb is None:
            os.remove(temp_path)
            return {"success": False, "detail": "Нүүр царай илрэсэнгүй"}

        query_vec = np.array(query_emb, dtype=np.float32)

        best_register: str | None = None
        best_score = 0.0

        with face_cache_lock:
            for register, embeddings in face_cache.items():
                for emb in embeddings:
                    score = cosine_sim(query_vec, emb)
                    if score > best_score:
                        best_score = score
                        best_register = register

        if best_register and best_score >= FACE_THRESHOLD:
            user = session.exec(select(User).where(User.register == best_register)).first()
            if user:
                saved_path = save_labeled_scan(user.register, temp_path)
                # Incrementally update cache with the new scan
                new_emb = get_embedding(saved_path, enforce=False)
                if new_emb is not None:
                    with face_cache_lock:
                        face_cache.setdefault(user.register, []).append(
                            np.array(new_emb, dtype=np.float32)
                        )
                os.remove(temp_path)
                return {"success": True, "firstname": user.firstname, "id": user.id, "register": user.register}

        os.remove(temp_path)
        return {"success": False, "detail": "Тохирох царай олдсонгүй. Та бүртгэл үүсгэх эсвэл ДАН системийн баталгаажуулалтаа хийнэ үү !"}

    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return {"success": False, "detail": f"Алдаа: {str(e)}"}


# ── Appointment routes ────────────────────────────────────────────────────────
@app.post("/appointments/make")
def make_appointment(appointment: MakeAppointment, session: SessionDep):
    # Guard against double-booking
    conflict = session.exec(
        select(Appointment).where(
            Appointment.doctorID == appointment.doctorID,
            Appointment.appointmentDate == appointment.appointmentDate,
            Appointment.appointmentTime == appointment.appointmentTime,
            Appointment.status != "Cancelled",
        )
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="Цагийг авсан байна")

    new_appointment = Appointment(
        appointmentDate=appointment.appointmentDate,
        appointmentTime=appointment.appointmentTime,
        userID=appointment.userID,
        doctorID=appointment.doctorID,
        doctorFirstname=appointment.doctorFirstname,
        hospitalID=appointment.hospitalID,
        status=appointment.status,
    )
    try:
        session.add(new_appointment)
        session.commit()
        return {"message": f"UserID: {new_appointment.userID} made appointment on DoctorID: {new_appointment.doctorID}"}
    except Exception as e:
        session.rollback()
        print(f"Appointment error: {e}")
        raise HTTPException(status_code=500, detail="Error occured")


@app.post("/appointments/cancel")
def cancel_appointment(appointmentID: int, session: SessionDep):
    appointment = session.exec(select(Appointment).where(Appointment.appointmentID == appointmentID)).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    try:
        appointment.status = "Cancelled"
        session.add(appointment)
        session.commit()
        return {"message": f"{appointmentID} has cancelled"}
    except Exception as e:
        session.rollback()
        print(f"Cancel error: {e}")
        raise HTTPException(status_code=500, detail="Error occured")


@app.put("/appointments/change")
def change_appointment(new_appointment: ChangeAppointment, session: SessionDep):
    conflict = session.exec(
        select(Appointment).where(
            Appointment.appointmentTime == new_appointment.appointmentTime,
            Appointment.appointmentDate == new_appointment.appointmentDate,
            Appointment.doctorID == new_appointment.doctorID,
            Appointment.status != "Cancelled",
        )
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="Цагийг авсан байна")

    appointment = session.exec(select(Appointment).where(Appointment.appointmentID == new_appointment.appointmentID)).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    try:
        appointment.appointmentDate = new_appointment.appointmentDate
        appointment.appointmentTime = new_appointment.appointmentTime
        appointment.doctorID = new_appointment.doctorID
        appointment.hospitalID = new_appointment.hospitalID
        appointment.status = new_appointment.status
        session.add(appointment)
        session.commit()
        return "Appointment updated"
    except Exception as e:
        print(f"Change error: {e}")
        raise HTTPException(status_code=500, detail="Error occured")


# ── Lab routes ────────────────────────────────────────────────────────────────
@app.post("/lab-order/create")
def new_laborder(order: LabOrderRequest, session: SessionDep):
    new_order = LabOrder(
        userID=order.userID,
        labID=order.labID,
        labType=order.labType,
        testID=order.testID,
        status="Pending",
    )
    try:
        session.add(new_order)
        session.commit()
        return {"message": f"Lab order confirmed. UserID: {new_order.userID}"}
    except Exception as e:
        session.rollback()
        print(f"Lab order error: {e}")
        raise HTTPException(status_code=500, detail="Error occured")


@app.post("/lab-order/cancel")
def cancel_laborder(orderID: int, session: SessionDep):
    order = session.exec(select(LabOrder).where(LabOrder.orderID == orderID)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        order.status = "Cancelled"
        session.add(order)
        session.commit()
        return f"OrderID: {orderID} has cancelled"
    except Exception as e:
        session.rollback()
        print(f"Lab cancel error: {e}")
        raise HTTPException(status_code=500, detail="Error occured")


# ── Query routes ──────────────────────────────────────────────────────────────
@app.get("/hospitals")
def get_hospitals(session: SessionDep):
    return session.exec(select(Hospital)).all()


@app.get("/appointments")
def get_user_appointments(userID: int, session: SessionDep):
    return session.exec(select(Appointment).where(Appointment.userID == userID)).all()


@app.get("/appointments/slots")
def get_booked_slots(doctorID: int, date: str, session: SessionDep):
    """Returns list of already-booked time slots for a doctor on a given date."""
    taken = session.exec(
        select(Appointment).where(
            Appointment.doctorID == doctorID,
            Appointment.appointmentDate == date,
            Appointment.status != "Cancelled",
        )
    ).all()
    return [a.appointmentTime for a in taken]


@app.get("/doctors")
def get_doctors(hospitalID: int, session: SessionDep):
    return session.exec(select(Doctor).where(Doctor.hospitalID == hospitalID)).all()


@app.get("/laboratories")
def get_laboratories(session: SessionDep):
    return session.exec(select(Laboratory)).all()


@app.get("/lab-orders")
def get_laborders(session: SessionDep, userID: int | None = None):
    if userID is not None:
        return session.exec(select(LabOrder).where(LabOrder.userID == userID)).all()
    return session.exec(select(LabOrder)).all()


@app.get("/lab-tests")
def get_lab_tests(labID: int, session: SessionDep):
    return session.exec(select(LabTest).where(LabTest.labID == labID)).all()
