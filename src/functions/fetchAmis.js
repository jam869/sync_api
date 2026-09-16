async function resoudreAmis(pool, { idMembre, friendsLimit, friendsOffset }) {
    const amisSql = `
        SELECT
            CASE
                WHEN a.id_membre_a = ?
                THEN a.id_membre_b
                ELSE a.id_membre_a
            END AS id_ami,
            me.url AS fp_url,
            m.pseudo,
            m.id_publique AS ami_id_publique,
            a.temps_creation,
            (
                SELECT SUM(version)
                FROM versions_donnees
                WHERE nom_table = 'amities' AND id_membre = ?
            ) AS version_totale
        FROM amities a
        INNER JOIN membres m
            ON m.id = CASE WHEN a.id_membre_a = ? THEN a.id_membre_b ELSE a.id_membre_a END
        LEFT JOIN medias me ON me.id = m.id_fp
        WHERE a.id_membre_a = ? OR a.id_membre_b = ?
        LIMIT ? OFFSET ?`
    
    const [rows] = await pool.query(amisSql, [
      idMembre, idMembre, idMembre, idMembre, idMembre, friendsLimit, friendsOffset,
    ]);

    const ids = rows.map(a => a.id_ami);

    return {rows, ids}    
}

module.exports = resoudreAmis