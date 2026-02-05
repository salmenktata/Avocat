# ⚡ Quickstart VPS - MonCabinet

Guide ultra-rapide pour développeurs expérimentés.

---

## 📦 En Bref

**Objectif** : Déployer MonCabinet sur VPS Contabo (Next.js 15 + PostgreSQL 15 + MinIO)

**Temps** : 8-10h total

**Coût** : ~27€/mois

---

## 🚀 Déploiement Express

### 1. Prérequis (15 min)

```bash
# Commander VPS Contabo L (30GB RAM)
# Configurer DNS : A record moncabinet.tn → <IP_VPS>

# Générer clé SSH
ssh-keygen -t ed25519 -C "admin@moncabinet.tn"

# Tester connexion
ssh root@<IP_VPS>
```

### 2. Setup VPS (2h)

```bash
# Update système
apt update && apt upgrade -y

# Créer user
adduser moncabinet && usermod -aG sudo moncabinet
mkdir -p /home/moncabinet/.ssh
cp ~/.ssh/authorized_keys /home/moncabinet/.ssh/
chown -R moncabinet:moncabinet /home/moncabinet/.ssh

# Sécuriser SSH
nano /etc/ssh/sshd_config  # PermitRootLogin no
systemctl restart sshd

# Firewall
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw enable

# Stack logicielle
curl -fsSL https://get.docker.com | sh
usermod -aG docker moncabinet
apt install -y nginx certbot python3-certbot-nginx git

# NVM + Node 18
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
source ~/.bashrc
nvm install 18 && nvm use 18
```

### 3. Application (2h)

```bash
# Cloner repo
mkdir -p /opt/moncabinet && chown moncabinet:moncabinet /opt/moncabinet
su - moncabinet
cd /opt/moncabinet
git clone <repo> .

# Config .env.production
cp .env.production.example .env.production
# Générer secrets
openssl rand -base64 32  # DB_PASSWORD, NEXTAUTH_SECRET, etc.
nano .env.production  # Remplir toutes variables
chmod 600 .env.production

# Build
export $(grep -v '^#' .env.production | xargs)
npm ci
docker-compose build
docker-compose up -d

# Health check
sleep 30
curl http://localhost:3000/api/health | jq
```

### 4. Nginx + SSL (1h)

```bash
# SSL
systemctl stop nginx
certbot certonly --standalone -d moncabinet.tn -d www.moncabinet.tn

# Config Nginx
cp docs/nginx-moncabinet.conf /etc/nginx/sites-available/moncabinet.tn
ln -s /etc/nginx/sites-available/moncabinet.tn /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl start nginx

# Test
curl -I https://moncabinet.tn
```

### 5. Migration Données (2h)

```bash
# Prérequis : SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY dans .env.production
npm install -g tsx
tsx scripts/migrate-from-supabase.ts

# Vérifier
docker exec -it moncabinet-postgres psql -U moncabinet -d moncabinet
SELECT COUNT(*) FROM users;
```

### 6. Backups (15 min)

```bash
# Tester backup
./backup.sh

# Crontab
crontab -e
# Ajouter: 0 3 * * * /opt/moncabinet/backup.sh >> /var/log/moncabinet-backup.log 2>&1
```

---

## 📁 Fichiers Clés

```
Avocat/
├── Dockerfile                          # Image Next.js
├── docker-compose.yml                  # PostgreSQL + MinIO + Next.js
├── .env.production                     # Variables production (NE PAS COMMIT)
├── deploy.sh                           # Déploiement auto
├── backup.sh                           # Backups auto
├── lib/
│   ├── db/postgres.ts                  # Client PostgreSQL
│   └── storage/minio.ts                # Client MinIO
├── app/api/
│   ├── auth/[...nextauth]/route.ts     # NextAuth.js
│   ├── health/route.ts                 # Health check
│   └── cron/send-notifications/route.ts # Cron notifications
├── middleware.ts                        # Auth middleware
├── scripts/migrate-from-supabase.ts    # Migration
└── docs/
    ├── DEPLOYMENT_VPS.md               # Guide complet (65p)
    ├── QUICK_COMMANDS.md               # Commandes rapides
    └── nginx-moncabinet.conf           # Config Nginx
```

---

## 🔑 Variables .env.production

```bash
# App
NEXT_PUBLIC_APP_URL=https://moncabinet.tn

# PostgreSQL
DATABASE_URL=postgresql://moncabinet:PASSWORD@postgres:5432/moncabinet
DB_USER=moncabinet
DB_PASSWORD=<openssl rand -base64 32>

# MinIO
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=<random 16 chars>
MINIO_SECRET_KEY=<openssl rand -base64 32>
MINIO_ROOT_USER=<same as access_key>
MINIO_ROOT_PASSWORD=<same as secret_key>

# NextAuth
NEXTAUTH_URL=https://moncabinet.tn
NEXTAUTH_SECRET=<openssl rand -base64 32>

# Resend
RESEND_API_KEY=re_<your_key>

# Google
GOOGLE_CLIENT_ID=<your_client_id>
GOOGLE_CLIENT_SECRET=<your_secret>

# WhatsApp
WHATSAPP_WEBHOOK_VERIFY_TOKEN=<openssl rand -hex 10>
WHATSAPP_APP_SECRET=<your_meta_secret>

# Cron
CRON_SECRET=<openssl rand -base64 32>
```

---

## 🎯 Commandes Essentielles

```bash
# Logs
docker-compose logs -f --tail=100

# Redémarrer
docker-compose restart

# Déployer
./deploy.sh

# Backup
./backup.sh

# Health check
curl https://moncabinet.tn/api/health | jq

# PostgreSQL
docker exec -it moncabinet-postgres psql -U moncabinet -d moncabinet

# MinIO
docker exec -it moncabinet-minio mc ls myminio/documents
```

---

## 🐛 Troubleshooting

```bash
# Container ne démarre pas
docker-compose logs <service>
docker-compose build --no-cache <service>
docker-compose up -d --force-recreate <service>

# Application inaccessible
curl http://localhost:3000/api/health  # Next.js OK ?
systemctl status nginx                 # Nginx OK ?
ufw status                             # Firewall OK ?

# Certificat SSL
certbot certificates
certbot renew
systemctl reload nginx

# Disque plein
df -h
docker system prune -a --volumes
```

---

## 📚 Documentation Complète

**Vous êtes pressé ?** Ce quickstart suffit.

**Besoin de détails ?** Consultez :
- [`docs/DEPLOYMENT_VPS.md`](docs/DEPLOYMENT_VPS.md) - Guide complet 65 pages
- [`docs/QUICK_COMMANDS.md`](docs/QUICK_COMMANDS.md) - Référence commandes
- [`docs/FAQ_VPS.md`](docs/FAQ_VPS.md) - Solutions problèmes courants

---

## 🎉 C'est Tout !

Si tous les steps sont ✅, votre app est en production sur `https://moncabinet.tn`

**Félicitations ! 🚀**

---

**Temps total** : 8-10h
**Difficulté** : Intermédiaire (Docker + Linux requis)
**Support** : docs/ ou GitHub Issues
