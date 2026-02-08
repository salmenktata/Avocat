# Accès aux Bases de Données PostgreSQL

Ce document explique comment accéder simultanément aux bases de données locale et de production.

## Configuration des Ports

| Base de données | Port | Container/Tunnel | Description |
|----------------|------|------------------|-------------|
| **Local (dev)** | 5433 | `moncabinet-postgres` (Docker) | Base de données de développement locale |
| **Production** | 5434 | SSH tunnel | Accès à la base de données de production via tunnel SSH |

## Base de Données Locale (par défaut)

La base de données locale tourne dans un container Docker et est **toujours active** pendant le développement.

```bash
# Déjà configuré dans .env.local
DATABASE_URL=postgresql://moncabinet:dev_password_change_in_production@localhost:5433/moncabinet

# Accès direct
docker exec moncabinet-postgres psql -U moncabinet -d moncabinet
```

## Base de Données Production (optionnel)

Pour accéder à la base de données de production, vous devez créer un **tunnel SSH** sur le port 5434.

### Démarrer le tunnel

```bash
# Via npm script (recommandé)
npm run tunnel:start

# Ou directement
./scripts/tunnel-prod-db.sh start
```

### Vérifier l'état du tunnel

```bash
npm run tunnel:status
```

### Arrêter le tunnel

```bash
npm run tunnel:stop
```

### Utiliser la base de données de production

Une fois le tunnel actif, modifiez temporairement votre `.env.local` :

```bash
# Commenter la DATABASE_URL locale
# DATABASE_URL=postgresql://moncabinet:dev_password_change_in_production@localhost:5433/moncabinet

# Utiliser la production
DATABASE_URL=postgresql://moncabinet:PROD_PASSWORD@localhost:5434/moncabinet
```

**⚠️ ATTENTION** : Ne commitez JAMAIS cette modification ! C'est uniquement pour des tests ponctuels.

## Scripts Utiles

### Indexation de la base de connaissances en production

```bash
# Via tunnel SSH (port 5434)
npm run tunnel:start
node scripts/index-kb-via-tunnel.ts
```

### Synchronisation des sources web

```bash
# Copier les sources de dev vers prod
npm run sync-web-sources
```

## Prévention des Conflits de Ports

**IMPORTANT** : Ne créez JAMAIS de tunnel SSH sur le port 5433, car il est déjà utilisé par le container Docker local.

Si vous voyez l'erreur `ECONNRESET`, vérifiez les processus sur le port 5433 :

```bash
lsof -i :5433 -P -n
```

Si vous voyez deux processus (Docker + SSH), arrêtez le tunnel SSH :

```bash
# Trouver le PID du tunnel SSH
ps aux | grep "ssh.*5433"

# Arrêter le tunnel
kill <PID>

# Redémarrer le serveur Next.js
npm run dev
```

## Résolution des Problèmes

### Erreur "read ECONNRESET"

**Cause** : Conflit de port ou connexions PostgreSQL stales.

**Solution** :
1. Vérifier qu'il n'y a pas de tunnel SSH sur le port 5433
2. Redémarrer le container PostgreSQL : `docker restart moncabinet-postgres`
3. Redémarrer le serveur Next.js

### Tunnel SSH ne se connecte pas

**Vérifications** :
1. Vous avez accès SSH au VPS : `ssh root@84.247.165.187`
2. Le port 5434 est libre localement : `lsof -i :5434`
3. PostgreSQL tourne sur le VPS : `systemctl status postgresql`

### Performance lente via tunnel

Le tunnel SSH ajoute de la latence. Pour des opérations lourdes (indexation, migrations), préférez exécuter directement sur le VPS :

```bash
# SSH sur le VPS
ssh root@84.247.165.187

# Exécuter le script dans le container
docker exec moncabinet-nextjs node scripts/votre-script.js
```
