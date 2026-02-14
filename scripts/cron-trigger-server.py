#!/usr/bin/env python3
"""
Cron Trigger Server
HTTP server qui permet de déclencher les crons manuellement
Écoute sur localhost:9998 (accessible uniquement depuis le host et les conteneurs)
"""

import subprocess
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime

# Configuration
PORT = 9998
SCRIPTS_DIR = "/opt/qadhya/scripts"
LOG_FILE = "/var/log/qadhya/cron-trigger-server.log"

# Map des crons disponibles
CRON_SCRIPTS = {
    "monitor-openai": {
        "script": f"{SCRIPTS_DIR}/cron-monitor-openai.sh",
        "description": "Monitoring Budget OpenAI",
    },
    "check-alerts": {
        "script": f"{SCRIPTS_DIR}/cron-check-alerts.sh",
        "description": "Vérification Alertes Système",
    },
    "refresh-mv-metadata": {
        "script": f"{SCRIPTS_DIR}/cron-refresh-mv-metadata.sh",
        "description": "Rafraîchissement Vues Matérialisées",
    },
    "reanalyze-kb-failures": {
        "script": f"{SCRIPTS_DIR}/cron-reanalyze-kb-failures.sh",
        "description": "Réanalyse Échecs KB",
    },
    "index-kb-progressive": {
        "script": f"{SCRIPTS_DIR}/index-kb-progressive.sh",
        "description": "Indexation KB Progressive",
    },
    "acquisition-weekly": {
        "script": f"{SCRIPTS_DIR}/cron-acquisition-weekly.sh",
        "description": "Acquisition Hebdomadaire",
    },
    "cleanup-executions": {
        "script": f"{SCRIPTS_DIR}/cron-cleanup-executions.sh",
        "description": "Nettoyage Anciennes Exécutions",
    },
}


def log_message(message):
    """Log avec timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] {message}\n"
    print(log_line, end="")
    try:
        with open(LOG_FILE, "a") as f:
            f.write(log_line)
    except Exception as e:
        print(f"Failed to write to log file: {e}")


class CronTriggerHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        """Override to use custom logging"""
        log_message(f"{self.address_string()} - {format % args}")

    def do_GET(self):
        """Health check endpoint"""
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            response = {
                "status": "healthy",
                "service": "cron-trigger-server",
                "port": PORT,
                "available_crons": len(CRON_SCRIPTS),
            }
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_error(404, "Not Found")

    def do_POST(self):
        """Trigger cron execution"""
        if self.path != "/trigger":
            self.send_error(404, "Not Found")
            return

        try:
            # Parse request body
            content_length = int(self.headers["Content-Length"])
            body = self.rfile.read(content_length)
            data = json.loads(body.decode())

            cron_name = data.get("cronName")
            if not cron_name:
                self.send_error(400, "cronName is required")
                return

            # Validate cron exists
            if cron_name not in CRON_SCRIPTS:
                self.send_error(400, f"Unknown cron: {cron_name}")
                return

            cron_config = CRON_SCRIPTS[cron_name]
            script = cron_config["script"]

            # Verify script exists (for bash scripts)
            if script.endswith(".sh") and not os.path.exists(script):
                log_message(f"❌ Script not found: {script}")
                self.send_error(500, f"Script not found: {script}")
                return

            # Execute script in background (fire and forget)
            log_message(f"▶️  Triggering cron: {cron_name} ({cron_config['description']})")

            # Récupérer CRON_SECRET du container Next.js
            try:
                result = subprocess.run(
                    ["docker", "exec", "qadhya-nextjs", "env"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                cron_secret = None
                for line in result.stdout.split("\n"):
                    if line.startswith("CRON_SECRET="):
                        cron_secret = line.split("=", 1)[1]
                        break

                if not cron_secret:
                    log_message(f"⚠️  CRON_SECRET not found in container, script may fail API calls")
            except Exception as e:
                log_message(f"⚠️  Failed to retrieve CRON_SECRET: {e}")
                cron_secret = None

            # Préparer environnement pour le script
            script_env = os.environ.copy()
            if cron_secret:
                script_env["CRON_SECRET"] = cron_secret
                log_message(f"✅ CRON_SECRET injected into script environment")

            # Injecter CRON_API_BASE pour production
            script_env["CRON_API_BASE"] = "https://qadhya.tn"
            log_message(f"✅ CRON_API_BASE set to production URL")

            # Use subprocess.Popen for true background execution
            log_dir = "/var/log/qadhya"
            log_file_path = f"{log_dir}/{cron_name}.log"

            with open(log_file_path, "a") as log_file:
                subprocess.Popen(
                    ["bash", script],
                    shell=False,
                    env=script_env,
                    stdout=log_file,
                    stderr=subprocess.STDOUT,
                    start_new_session=True,  # Detach from parent
                )

            log_message(f"✅ Cron started: {cron_name}")

            # Return success immediately
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            response = {
                "success": True,
                "cronName": cron_name,
                "description": cron_config["description"],
                "message": "Cron execution started in background",
                "logFile": log_file_path,
            }
            self.wfile.write(json.dumps(response).encode())

        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
        except Exception as e:
            log_message(f"❌ Error triggering cron: {str(e)}")
            self.send_error(500, f"Internal server error: {str(e)}")


def run_server():
    """Start HTTP server"""
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, CronTriggerHandler)
    log_message(f"🚀 Cron Trigger Server starting on port {PORT}")
    log_message(f"📂 Scripts directory: {SCRIPTS_DIR}")
    log_message(f"📝 Log file: {LOG_FILE}")
    log_message(f"✅ {len(CRON_SCRIPTS)} crons configured")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        log_message("🛑 Server stopped by user")
        httpd.server_close()


if __name__ == "__main__":
    run_server()
