#!/usr/bin/env node

/**
 * Script manuel de nettoyage du storage
 *
 * Usage:
 *   node scripts/cleanup-storage-manual.js
 *   npm run storage:cleanup
 *
 * Ce script génère un bookmarklet que vous pouvez exécuter dans le navigateur
 * pour nettoyer manuellement le storage.
 */

console.log('\n🧹 Script de Nettoyage du Storage\n')
console.log('=' .repeat(60))
console.log('\n📋 OPTIONS:\n')

console.log('1️⃣  Bookmarklet (à ajouter dans les favoris du navigateur)')
console.log('   Créez un nouveau favori avec cette URL:\n')

const bookmarklet = `javascript:(function(){const getItemSize=(k,v)=>new Blob([k,v]).size;const formatBytes=b=>b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(2)+' MB';const analyze=()=>{let total=0,items=[];for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i),v=sessionStorage.getItem(k);if(!k||!v)continue;const s=getItemSize(k,v);total+=s;items.push({k,s})}items.sort((a,b)=>b.s-a.s);console.clear();console.log('📊 Storage Analysis');console.log('Total:',formatBytes(total));console.log('Items:',items.length);console.log('\\nTop 5:');items.slice(0,5).forEach((i,n)=>console.log(\`  \${n+1}. \${i.k}: \${formatBytes(i.s)}\`));const confirm=window.confirm(\`Storage: \${formatBytes(total)} (\${items.length} items)\\n\\nNettoyer les items > 30 min?\`);if(confirm){const now=Date.now(),cleaned=[];for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);if(k.endsWith('_ts')){const ts=parseInt(sessionStorage.getItem(k),10);if(now-ts>1800000){const base=k.replace('_ts','');sessionStorage.removeItem(k);sessionStorage.removeItem(base);cleaned.push(base)}}else if(!['session_cache','session_cache_ts'].includes(k)){try{const v=JSON.parse(sessionStorage.getItem(k));if(v.state?.timestamp&&now-v.state.timestamp>1800000){sessionStorage.removeItem(k);cleaned.push(k)}}catch{}}}alert(\`✅ Nettoyé \${cleaned.length} items\`);analyze()}};analyze()})();`

console.log(`   ${bookmarklet}\n`)

console.log('2️⃣  Console du navigateur (copier-coller ce code):\n')

const consoleScript = `
// Analyse et nettoyage du storage
(function() {
  const getItemSize = (key, value) => new Blob([key, value]).size;
  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const analyzeAndCleanup = () => {
    let totalSize = 0;
    const items = [];

    // Analyser sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      const value = sessionStorage.getItem(key);
      if (!key || !value) continue;

      const size = getItemSize(key, value);
      totalSize += size;
      items.push({ key, size, value });
    }

    items.sort((a, b) => b.size - a.size);

    console.clear();
    console.group('📊 Storage Analysis');
    console.log('Total size:', formatBytes(totalSize));
    console.log('Items count:', items.length);
    console.log('\\nTop 5 largest items:');
    items.slice(0, 5).forEach((item, i) => {
      console.log(\`  \${i+1}. \${item.key}: \${formatBytes(item.size)}\`);
    });
    console.groupEnd();

    // Demander confirmation pour le nettoyage
    const shouldCleanup = confirm(
      \`Storage: \${formatBytes(totalSize)} (\${items.length} items)\\n\\n\` +
      \`Nettoyer les items > 30 minutes?\`
    );

    if (!shouldCleanup) return;

    // Nettoyer les items anciens
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const essentialKeys = ['session_cache', 'session_cache_ts'];
    let cleaned = 0;

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (essentialKeys.includes(key)) continue;

      // Vérifier timestamp
      if (key.endsWith('_ts')) {
        const timestamp = parseInt(sessionStorage.getItem(key), 10);
        if ((now - timestamp) > maxAge) {
          const baseKey = key.replace('_ts', '');
          sessionStorage.removeItem(key);
          sessionStorage.removeItem(baseKey);
          cleaned++;
        }
      } else {
        try {
          const parsed = JSON.parse(sessionStorage.getItem(key));
          if (parsed.state?.timestamp && (now - parsed.state.timestamp) > maxAge) {
            sessionStorage.removeItem(key);
            cleaned++;
          }
        } catch {
          // Pas un JSON avec timestamp
        }
      }
    }

    alert(\`✅ Nettoyé \${cleaned} items\`);

    // Re-analyser après nettoyage
    let newTotal = 0;
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      const value = sessionStorage.getItem(key);
      if (key && value) newTotal += getItemSize(key, value);
    }

    console.log('\\n✅ Après nettoyage:');
    console.log('Nouvelle taille:', formatBytes(newTotal));
    console.log('Gain:', formatBytes(totalSize - newTotal));
  };

  analyzeAndCleanup();
})();
`

console.log(consoleScript)

console.log('\n3️⃣  Depuis l\'application (si StorageCleanupProvider est désactivé):\n')
console.log('   import { cleanupOldItems } from "@/lib/utils/storage-cleanup"')
console.log('   cleanupOldItems(sessionStorage, 30 * 60 * 1000)\n')

console.log('=' .repeat(60))
console.log('\n💡 Le nettoyage automatique est déjà actif dans l\'application')
console.log('   via StorageCleanupProvider (toutes les 5 minutes).\n')
