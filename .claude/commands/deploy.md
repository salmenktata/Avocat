# Skill: Deploy to VPS

Déploiement rapide sur le VPS Contabo.

## Instructions

Quand l'utilisateur invoque `/deploy`, effectuer les actions suivantes :

### 1. Vérifier les changements locaux

```bash
git status --short
```

### 2. Si des changements existent, demander confirmation pour commit

Si l'utilisateur confirme, commit avec un message approprié :
```bash
git add -A && git commit -m "deploy: Mise à jour production"
```

### 3. Push vers GitHub

```bash
git push origin main
```

### 4. Le CI/CD GitHub Actions se déclenche automatiquement

Afficher le lien vers le workflow :
```bash
gh run list --limit 1
```

### 5. Option: Déploiement manuel direct (si --manual)

Si l'utilisateur ajoute `--manual` ou si le CI/CD échoue :

```bash
sshpass -p 'IeRfA8Z46gsYSNh7' ssh root@84.247.165.187 "cd /opt/moncabinet && git pull && docker compose build nextjs && docker compose up -d nextjs"
```

### 6. Vérifier le déploiement

```bash
curl -s http://84.247.165.187/api/health
```

## Arguments

- `--manual` : Déployer directement sur le VPS sans passer par GitHub Actions
- `--status` : Vérifier uniquement le status du VPS sans déployer
- `--logs` : Afficher les logs du container nextjs

## Informations VPS

- **IP**: 84.247.165.187
- **User**: root
- **Domaine**: moncabinet.tn
- **App path**: /opt/moncabinet
