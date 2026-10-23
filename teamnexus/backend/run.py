import os
from app import create_app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"=====================================================")
    print(f"  AI TARGET STRIKE — Backend Core Engine Active")
    print(f"  Listening on http://localhost:{port}")
    print(f"  Default Admin: admin / adminPassword2026!")
    print(f"=====================================================")
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
