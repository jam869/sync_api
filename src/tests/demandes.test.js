// tests/amis.test.js
const request = require('supertest');
const app = require('../app'); // ton app Express, sans app.listen()
const pool = require('../db/pool');

describe('PATCH /amis/demandes/:id', () => {
  let tokenA, tokenB, tokenC, idDemandePublique;

  beforeAll(async () => {
    // Créer 3 membres de test directement en DB
    // A envoie une demande à B, C n'a rien à voir avec cette demande
    tokenA = await creerMembreEtObtenirToken('userA');
    tokenB = await creerMembreEtObtenirToken('userB');
    tokenC = await creerMembreEtObtenirToken('userC');

    const res = await request(app)
      .post('/amis/demandes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ id_destinataire: idPubliqueDe('userB') });

    idDemandePublique = /* récupérer l'id créé, via un SELECT direct en DB */;
  });

  afterAll(async () => {
    await nettoyerDonneesDeTest();
    await pool.end();
  });

  test('le vrai destinataire (B) peut accepter la demande', async () => {
    const res = await request(app)
      .patch(`/amis/demandes/${idDemandePublique}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ statut: 'acceptee' });

    expect(res.status).toBe(200);

    // Vérifie l'état réel en DB, pas juste le status code
    const [rows] = await pool.query(
      'SELECT statut FROM demandes_amis WHERE id_publique = ?', 
      [idDemandePublique]
    );
    expect(rows[0].statut).toBe('acceptee');
  });

  test('un tiers (C) ne peut PAS accepter une demande qui ne lui est pas destinée', async () => {
    const res = await request(app)
      .patch(`/amis/demandes/${idDemandePublique}`)
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ statut: 'acceptee' });

    expect(res.status).toBe(403);
  });

  test('le demandeur (A) lui-même ne peut pas accepter sa propre demande', async () => {
    const res = await request(app)
      .patch(`/amis/demandes/${idDemandePublique}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ statut: 'acceptee' });

    expect(res.status).toBe(403);
  });
});