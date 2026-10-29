sequenceDiagram
    actor User
    participant DAN
    participant Hospital
    participant Doctor
    participant Laboratory

    User->>Hospital: register()
    Hospital-->>User: registered

    User->>Hospital: loginByFace()
    User-->>DAN: getDANdata()
    DAN-->>User: verifyUser() 
    
    User->>Doctor: makeAppointment()
    Doctor-->>Doctor: getSchedule()
    Doctor-->>User: Appointment confirmed

    Note over User, Doctor: Үзлэгийн цаг батлагдсан

    User->>Doctor: Visit appointment
    Doctor->>Laboratory: orderTest(LabOrder)
    Laboratory-->>Laboratory: processTest(LabOrder)
    Laboratory-->>Doctor: Test results

    Doctor-->>User: Diagnosis + results

    alt Appointment цуцлах
        User->>Doctor: cancelAppointment()
        Doctor-->>User: Appointment cancelled
    end