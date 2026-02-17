#!/bin/sh
set -e

echo "🔐 Vérification utilisateur par défaut..."

# Attendre que PostgreSQL soit prêt
until node -e "const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>{console.log('✅ PostgreSQL prêt');c.end();process.exit(0)}).catch(()=>{console.log('⏳ Attente PostgreSQL...');process.exit(1)})" 2>/dev/null; do
  sleep 2
done

# Recovery jobs orphelins (Phase 2.3)
echo "🔄 Recovery jobs orphelins..."
if [ -f "/app/scripts/recover-orphaned-jobs-startup.sh" ]; then
  bash /app/scripts/recover-orphaned-jobs-startup.sh || echo "⚠️  Recovery jobs échoué, continue"
else
  echo "⚠️  Script recovery introuvable, skip"
fi

# Créer l'utilisateur par défaut
node - <<'SCRIPT'
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    
    const email = 'salmen.ktata@gmail.com';
    const password = '724@Lnb.13';
    const passwordHash = await bcrypt.hash(password, 10);
    
    const checkUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (checkUser.rows.length > 0) {
      await client.query(
        'UPDATE users SET password_hash = $1, nom = $2, prenom = $3, updated_at = NOW() WHERE email = $4',
        [passwordHash, 'Ktata', 'Salmen', email]
      );
    } else {
      await client.query(
        'INSERT INTO users (email, password_hash, nom, prenom, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
        [email, passwordHash, 'Ktata', 'Salmen']
      );
    }
    
    console.log('✅ Utilisateur admin configuré');
    await client.end();
  } catch (err) {
    console.error('❌ Erreur seed:', err.message);
    await client.end();
  }
})();
SCRIPT

echo "🚀 Démarrage du serveur..."
exec "$@"
