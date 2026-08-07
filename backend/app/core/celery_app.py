#celery_app.py
from celery import Celery
from app.core.config import settings

celery_app = Celery("gynsys", broker=settings.CELERY_BROKER_URL)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Caracas", 
    enable_utc=True,
)

from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    "run-daily-notification-check": {
        "task": "app.tasks.notifications.run_daily_notification_check",
        "schedule": crontab(hour=4, minute=0),
    },
    "process-notification-queue": {
        "task": "app.tasks.notifications.process_notification_queue",
        "schedule": crontab(minute='*/1'),
    },
    "recover-stale-processing": {
        "task": "app.tasks.notifications.recover_stale_processing",
        "schedule": crontab(minute='*/10'),
    },
    "check-appointment-reminders": {
        "task": "app.tasks.email_tasks.check_and_send_appointment_reminders",
        "schedule": crontab(minute='*/15'),
    },
    "check-scheduled-reminders": {
        "task": "app.tasks.scheduled_appointment_reminders.check_scheduled_reminders",
        "schedule": crontab(hour=9, minute=0),
    },
}
# Auto-discover tasks and ensure modules are loaded
celery_app.autodiscover_tasks(['app'])

# Explicitly import task modules to ensure they register their tasks with the app instance
try:
    import app.tasks.email_tasks
    import app.tasks.notifications
    import app.tasks.campaigns
    import app.tasks.scheduled_appointment_reminders
except ImportError:
    pass
