from pymongo import MongoClient, ASCENDING, IndexModel
from config import Config
import logging

logger = logging.getLogger(__name__)

class Database:
    _instance = None
    client = None
    db = None

    @classmethod
    def get_db(cls):
        if cls.db is None:
            cls.initialize()
        return cls.db

    @classmethod
    def initialize(cls):
        try:
            cls.client = MongoClient(Config.MONGO_URI, serverSelectionTimeoutMS=5000)
            # Ping database to check connection
            cls.client.admin.command('ping')
            cls.db = cls.client[Config.DB_NAME]
            logger.info(f"Connected to MongoDB successfully: {Config.DB_NAME}")
            cls.setup_indexes()
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise e

    @classmethod
    def setup_indexes(cls):
        db = cls.db
        try:
            # Users indexes
            db.users.create_index([("email", ASCENDING)], unique=True)

            # Teams indexes
            db.teams.create_index([("team_id", ASCENDING)], unique=True)
            db.teams.create_index([("qr_token", ASCENDING)], unique=True)
            db.teams.create_index([("status", ASCENDING)])
            db.teams.create_index([("event_id", ASCENDING)])
            db.teams.create_index([("created_at", ASCENDING)])

            # Members indexes
            db.members.create_index([("team_id", ASCENDING)])
            db.members.create_index([("register_number", ASCENDING)])
            db.members.create_index([("email", ASCENDING)])

            # Audit logs indexes
            db.audit_logs.create_index([("timestamp", ASCENDING)])
            db.audit_logs.create_index([("team_id", ASCENDING)])

            logger.info("MongoDB indexes verified and ensured.")
        except Exception as e:
            logger.warning(f"Index creation warning: {e}")

def get_db():
    return Database.get_db()
