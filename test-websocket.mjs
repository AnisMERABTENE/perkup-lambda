// Test WebSocket manuellement depuis Node.js
import WebSocket from 'ws';

const token = 'VOTRE_TOKEN_JWT_ICI'; // Remplacer par un vrai token
const wsUrl = `wss://0p6v60p0l3.execute-api.eu-west-1.amazonaws.com/prod?token=${token}`;

console.log('🔌 Test connexion WebSocket...');
console.log('URL:', wsUrl);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✅ WebSocket connecté !');
});

ws.on('message', (data) => {
  console.log('📨 Message reçu:', data.toString());
});

ws.on('error', (error) => {
  console.error('❌ Erreur WebSocket:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`❌ WebSocket fermé: ${code} ${reason}`);
});

// Timeout après 10 secondes
setTimeout(() => {
  console.log('⏱️ Timeout - fermeture connexion');
  ws.close();
  process.exit(0);
}, 10000);
