# TaskManager (POC)

This repository contains a proof-of-concept TaskManager application. The backend is a Django + Django REST Framework API (SQLite for the POC). The frontend will be a React + TypeScript SPA that consumes the API.

Quick start (Windows / PowerShell):

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd backend
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

API root: `http://127.0.0.1:8000/api/`
