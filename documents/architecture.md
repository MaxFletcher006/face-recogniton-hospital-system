flowchart TD
    User([User])

    User --> V

    subgraph V["VIEW"]
        LoginView[Login View]
        AppointmentView[Appointment View]
        LabView[Lab Order View]
    end

    subgraph C["CONTROLLER"]
        AuthCtrl[Auth Controller]
        AppointCtrl[Appointment Controller]
        LabCtrl[Lab Controller]
    end

    subgraph M["MODEL"]
        UserModel[(User)]
        AppointModel[(Appointment)]
        DoctorModel[(Doctor)]
        LabModel[(Lab Order)]
    end

    LoginView --> AuthCtrl
    AppointmentView --> AppointCtrl
    LabView --> LabCtrl

    AuthCtrl --> UserModel
    AppointCtrl --> AppointModel
    AppointCtrl --> DoctorModel
    LabCtrl --> LabModel

    UserModel -.-> LoginView
    AppointModel -.-> AppointmentView
    LabModel -.-> LabView