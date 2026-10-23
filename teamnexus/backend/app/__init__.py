from flask import Flask, jsonify
from flask_cors import CORS
from app.utils.sqlite_db import init_db
from app.routes.api_routes import api_bp
from app.routes.admin_routes import admin_bp

def create_app():
    app = Flask(__name__)
    app.config['JSON_SORT_KEYS'] = False
    
    # Enable CORS for all frontend origins
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # Initialize SQLite Database & Tables
    init_db()

    # Register Blueprints
    app.register_blueprint(api_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')

    @app.route('/')
    def root():
        return jsonify({
            "system": "AI TARGET STRIKE — Event Management & 2-Player Game System",
            "version": "2.0.0",
            "status": "ONLINE",
            "endpoints": {
                "registration": "/api/register",
                "public_queue": "/api/queue/public",
                "leaderboard": "/api/leaderboard",
                "sse_stream": "/api/events/stream",
                "admin": "/api/admin/*"
            }
        })

    return app
