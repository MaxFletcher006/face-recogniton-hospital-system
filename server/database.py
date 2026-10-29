import os
from pathlib import Path
from dotenv import load_dotenv
from sqlmodel import Field, SQLModel, create_engine, Session

#DATABASE_URL = os.getenv("DATABASE_URL")
DATABASE_URL = "postgresql://neondb_owner:npg_oKqJ4efAPF5W@ep-gentle-dust-anztia4w-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    firstname: str = Field(index=True)
    lastname: str = Field(index=True)
    phone_number: str = Field(unique=True, index=True)
    register: str = Field(unique=True, index=True)
    password_hash: str
    dan_status: bool = Field(default=False)

class Hospital(SQLModel, table=True):
    hospitalID: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)

class Doctor(SQLModel, table=True):
    doctorID: int | None = Field(default=None, primary_key=True)
    firstname: str = Field(default=None, index=True)
    lastname: str = Field(default=None, index=True)
    field: str = Field(default=None, index=True)
    hospitalID: int | None = Field(default=None, foreign_key="hospital.hospitalID")

class Appointment(SQLModel, table=True):
    appointmentID: int | None = Field(default=None, primary_key=True)
    appointmentTime: str = Field(default=None)
    appointmentDate: str = Field(default=None)
    userID: int | None = Field(default=None, foreign_key="user.id") 
    doctorID: int | None = Field(default=None, foreign_key="doctor.doctorID")
    doctorFirstname: str = Field(default=None)
    hospitalID: int | None = Field(default=None, foreign_key="hospital.hospitalID")
    status: str = Field(default=None, index=True)

class Laboratory(SQLModel, table=True):
    labID: int | None = Field(default=None, primary_key=True)
    type: str = Field(default=None, index=True)
    hospitalID: int | None = Field(default=None, foreign_key="hospital.hospitalID")

class LabTest(SQLModel, table=True):
    testID: int | None = Field(default=None, primary_key=True)
    labID: int | None = Field(default=None, foreign_key="laboratory.labID")
    name: str = Field(default=None)

class LabOrder(SQLModel, table=True):
    orderID: int | None = Field(default=None, primary_key=True) 
    testID: int | None = Field(default=None, foreign_key="labtest.testID")
    userID: int = Field(default=None, index=True)
    labID: int | None = Field(default=None, foreign_key="laboratory.labID")
    labType: str = Field(default=None)
    status: str = Field(default=None)

engine = create_engine(DATABASE_URL)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

if __name__ == "__main__":
    create_db_and_tables()
    print("Database initiated")