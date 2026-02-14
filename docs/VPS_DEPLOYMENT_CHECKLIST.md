# Checklist Déploiement Nouveau VPS

Guide complet pour déployer Qadhya sur un nouveau VPS depuis zéro.

## 📋 Prérequis

- VPS Ubuntu/Debian avec accès root SSH
- Domaine DNS configuré pointant vers le VPS
- Clés API (OpenAI, Groq, Gemini, etc.)

## 🔧 Installation Système

### 1. Mise à jour système
```bash
apt update && apt upgrade -y
apt install -y git curl wget docker.io docker-compose ufw fail2ban
systemctl enable docker
systemctl start docker
```

### 2. Configuration Firewall UFW ⚠️ CRITIQUE

```bash
# Activer UFW
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# 🚨 RÈGLE CRITIQUE pour Manual Trigger Crons
ufw allow from 172.16.0.0/12 to any port 9998 comment 'Cron Trigger Server from Docker'

# Facultatif: Ollama depuis Docker
ufw allow from 172.16.0.0/12 to any port 11434 comment 'Ollama from Docker'

# Activer
ufw --force enable
ufw status numbered
```

**⚠️ IMPORTANT** : Sans la règle port 9998, le manual trigger des crons NE FONCTIONNERA PAS !

### 3. Création utilisateur deploy (optionnel)
```bash
adduser deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
```

## 🐳 Installation Application

### 1. Cloner repository
```bash
cd /opt
git clone https://github.com/salmenktata/moncabinet.git qadhya
cd qadhya
```

### 2. Configuration environnement
```bash
# Copier template
cp .env.example .env.production.local

# Éditer avec nano/vim
nano .env.production.local
```

**Variables critiques à configurer** :
```env
# Base de données
DATABASE_URL=postgresql://moncabinet:PASSWORD@postgres:5432/qadhya
DB_USER=moncabinet
DB_PASSWORD=<générer mot de passe fort>

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=<générer mot de passe fort>

# Next-Auth
NEXTAUTH_SECRET=<générer avec: openssl rand -base64 32>
NEXTAUTH_URL=https://votredomaine.tn

# Crons
CRON_SECRET=<générer avec: openssl rand -base64 32>
CRON_TRIGGER_SERVER_URL=http://host.docker.internal:9998/trigger

# Clés API
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
GOOGLE_API_KEY=AIza...
DEEPSEEK_API_KEY=...

# Ollama
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

### 3. Installation Ollama (optionnel mais recommandé)
```bash
curl -fsSL https://ollama.com/install.sh | sh
systemctl enable ollama
systemctl start ollama

# Pull modèles requis
ollama pull qwen2.5:3b
ollama pull qwen3-embedding:0.6b
```

### 4. Créer réseau Docker
```bash
docker network create moncabinet_qadhya-network
```

### 5. Démarrer services
```bash
docker-compose up -d postgres redis minio
sleep 10  # Attendre que PostgreSQL démarre
```

### 6. Initialiser base de données
```bash
# Créer base qadhya
docker exec qadhya-postgres createdb -U moncabinet qadhya

# Appliquer migrations (depuis projet local ou via dump)
# Option A: Import dump existant
docker exec -i qadhya-postgres psql -U moncabinet -d qadhya < backup_prod.sql

# Option B: Migrations Prisma
npx prisma migrate deploy
```

### 7. Créer buckets MinIO
```bash
docker exec qadhya-minio mc alias set prod http://minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}
docker exec qadhya-minio mc mb prod/documents
docker exec qadhya-minio mc mb prod/web-files
docker exec qadhya-minio mc mb prod/avatars
docker exec qadhya-minio mc mb prod/uploads
```

### 8. Démarrer application Next.js
```bash
docker-compose up -d nextjs
```

### 9. Vérifier santé
```bash
# Attendre 40s que l'app démarre
sleep 40

# Vérifier health check
curl http://localhost:3000/api/health | jq '.'

# Devrait retourner:
# {
#   "status": "healthy",
#   "services": {
#     "database": "healthy",
#     "storage": "healthy",
#     "api": "healthy"
#   }
# }
```

## 🔐 Configuration Nginx + SSL

### 1. Installer Nginx et Certbot
```bash
apt install -y nginx certbot python3-certbot-nginx
```

### 2. Configuration Nginx
```bash
cat > /etc/nginx/sites-available/qadhya <<'EOF'
server {
    listen 80;
    server_name votredomaine.tn www.votredomaine.tn;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -s /etc/nginx/sites-available/qadhya /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 3. SSL avec Let's Encrypt
```bash
certbot --nginx -d votredomaine.tn -d www.votredomaine.tn
```

## 🤖 Configuration Cron Trigger Server

### 1. Créer service systemd
```bash
cat > /etc/systemd/system/cron-trigger-server.service <<'EOF'
[Unit]
Description=Qadhya Cron Trigger Server
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/qadhya
ExecStart=/usr/bin/python3 /opt/qadhya/scripts/cron-trigger-server.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable cron-trigger-server
systemctl start cron-trigger-server
systemctl status cron-trigger-server
```

### 2. Vérifier trigger server
```bash
# Test depuis host
curl http://localhost:9998/health
# {"status": "healthy", "service": "cron-trigger-server", ...}

# Test depuis container (doit fonctionner grâce à UFW)
docker exec qadhya-nextjs sh -c 'wget -q -O- http://host.docker.internal:9998/health'
```

## 📊 Configuration Crontabs

```bash
# Éditer crontab root
crontab -e

# Ajouter les crons
0 8 * * * /opt/qadhya/scripts/cron-monitor-openai.sh >> /var/log/qadhya/openai-monitor.log 2>&1
*/30 * * * * /opt/qadhya/scripts/cron-check-alerts.sh >> /var/log/qadhya/alerts.log 2>&1
0 */6 * * * /opt/qadhya/scripts/cron-refresh-mv-metadata.sh >> /var/log/qadhya/mv-refresh.log 2>&1
0 */4 * * * /opt/qadhya/scripts/cron-reanalyze-kb-failures.sh >> /var/log/qadhya/kb-reanalyze.log 2>&1
*/5 * * * * /opt/qadhya/scripts/index-kb-progressive.sh >> /var/log/qadhya/kb-index.log 2>&1
0 2 * * 1 cd /opt/qadhya && npx tsx scripts/cron-acquisition-weekly.ts >> /var/log/qadhya/acquisition.log 2>&1
0 3 * * * /opt/qadhya/scripts/cron-cleanup-executions.sh >> /var/log/qadhya/cleanup.log 2>&1

# Créer répertoire logs
mkdir -p /var/log/qadhya
```

## 🔍 Vérifications Post-Déploiement

### 1. Health Checks
```bash
# API
curl https://votredomaine.tn/api/health

# PostgreSQL
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c "SELECT COUNT(*) FROM knowledge_base;"

# MinIO
docker exec qadhya-minio mc ls prod/

# Redis
docker exec qadhya-redis redis-cli ping
```

### 2. Test Manual Trigger
```bash
# Depuis dashboard: https://votredomaine.tn/super-admin/monitoring?tab=crons
# Cliquer "Exécuter" sur un cron → Devrait créer ligne dans DB

# Ou via API
curl -X POST https://votredomaine.tn/api/admin/cron-executions/trigger \
  -H 'Content-Type: application/json' \
  -d '{"cronName":"monitor-openai"}'

# Vérifier DB
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c \
  "SELECT * FROM cron_executions ORDER BY started_at DESC LIMIT 1;"
```

### 3. Logs
```bash
# Container logs
docker logs qadhya-nextjs --tail 50
docker logs qadhya-postgres --tail 20

# Cron logs
tail -f /var/log/qadhya/*.log

# Trigger server logs
journalctl -u cron-trigger-server -f
```

## 🚨 Troubleshooting

### Manual Trigger ne fonctionne pas

**Symptôme** : Bouton "Exécuter" dashboard → success mais aucune exécution créée

**Diagnostic** :
```bash
# 1. Vérifier règle UFW port 9998
ufw status | grep 9998
# Doit afficher: 9998  ALLOW  172.16.0.0/12

# 2. Vérifier trigger server
systemctl status cron-trigger-server
curl http://localhost:9998/health

# 3. Test fetch depuis container
docker exec qadhya-nextjs node -e "
fetch('http://host.docker.internal:9998/health')
  .then(r => r.json())
  .then(d => console.log('SUCCESS:', d))
  .catch(e => console.error('FAILED:', e.message))
"
# Doit afficher: SUCCESS: {"status":"healthy"...}
```

**Solution** : Ajouter règle UFW si manquante
```bash
ufw allow from 172.16.0.0/12 to any port 9998 comment 'Cron Trigger Server from Docker'
```

### Container ne démarre pas

**Diagnostic** :
```bash
docker logs qadhya-nextjs --tail 100
docker inspect qadhya-nextjs

# Vérifier réseau
docker network inspect moncabinet_qadhya-network
```

### Erreur "PostgreSQL not ready"

**Solution** :
```bash
# Vérifier PostgreSQL
docker exec qadhya-postgres pg_isready -U moncabinet

# Recréer container avec bon réseau
docker stop qadhya-nextjs
docker rm qadhya-nextjs
docker-compose up -d nextjs
```

## 📚 Ressources

- Documentation complète : `/opt/qadhya/docs/`
- Mémoire bugs : `~/.claude/projects/.../memory/bugs-fixes.md`
- Monitoring dashboard : `https://votredomaine.tn/super-admin/monitoring`
- Logs production : `/var/log/qadhya/`

---

**Dernière mise à jour** : 14 février 2026
**Version Qadhya** : 1.0.0 (commit 929a7d7)
