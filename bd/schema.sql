/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.20-12.3.3-MariaDB, for Linux (x86_64)
--
-- Host: 127.0.0.1    Database: syncdb_dev
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `albums`
--

DROP TABLE IF EXISTS `albums`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `albums` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `id_publique` varchar(10) DEFAULT NULL,
  `id_media` bigint NOT NULL,
  `type` enum('image','video') DEFAULT NULL,
  PRIMARY KEY (`id`,`id_media`),
  UNIQUE KEY `id_publique` (`id_publique`),
  KEY `id_media` (`id_media`),
  CONSTRAINT `albums_ibfk_1` FOREIGN KEY (`id_media`) REFERENCES `medias` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `alertes`
--

DROP TABLE IF EXISTS `alertes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `alertes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_publique` varchar(36) NOT NULL,
  `id_evenement` bigint unsigned NOT NULL,
  `id_membre` bigint unsigned NOT NULL,
  `minutes_avant` int NOT NULL,
  `statut` enum('en_attente','envoyee','annulee','echouee') NOT NULL DEFAULT 'en_attente',
  `id_notification` bigint unsigned DEFAULT NULL,
  `temps_creation` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_publique` (`id_publique`),
  KEY `id_evenement` (`id_evenement`),
  KEY `id_membre` (`id_membre`),
  KEY `id_notification` (`id_notification`),
  CONSTRAINT `alertes_ibfk_1` FOREIGN KEY (`id_evenement`) REFERENCES `evenements` (`id`) ON DELETE CASCADE,
  CONSTRAINT `alertes_ibfk_2` FOREIGN KEY (`id_membre`) REFERENCES `membres` (`id`) ON DELETE CASCADE,
  CONSTRAINT `alertes_ibfk_3` FOREIGN KEY (`id_notification`) REFERENCES `notifications` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `amities`
--

DROP TABLE IF EXISTS `amities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `amities` (
  `id_membre_a` bigint unsigned NOT NULL,
  `id_membre_b` bigint unsigned NOT NULL,
  `temps_creation` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_membre_a`,`id_membre_b`),
  KEY `fk_amities_b` (`id_membre_b`),
  CONSTRAINT `fk_amities_a` FOREIGN KEY (`id_membre_a`) REFERENCES `membres` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_amities_b` FOREIGN KEY (`id_membre_b`) REFERENCES `membres` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_amities_ordre` CHECK ((`id_membre_a` < `id_membre_b`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_amities_ai` AFTER INSERT ON `amities` FOR EACH ROW BEGIN
    INSERT INTO versions_donnees (nom_table, id_membre, version)
    VALUES ('amities', NEW.id_membre_a, 1)
    ON DUPLICATE KEY UPDATE version = version + 1;

    INSERT INTO versions_donnees (nom_table, id_membre, version)
    VALUES ('amities', NEW.id_membre_b, 1)
    ON DUPLICATE KEY UPDATE version = version + 1;
END 
*/;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_amities_ad` AFTER DELETE ON `amities` FOR EACH ROW BEGIN
    
    
    
    
    IF EXISTS (SELECT 1 FROM membres WHERE id = OLD.id_membre_a) THEN
        INSERT INTO versions_donnees (nom_table, id_membre, version)
        VALUES ('amities', OLD.id_membre_a, 1)
        ON DUPLICATE KEY UPDATE version = version + 1;
    END IF;
 
    IF EXISTS (SELECT 1 FROM membres WHERE id = OLD.id_membre_b) THEN
        INSERT INTO versions_donnees (nom_table, id_membre, version)
        VALUES ('amities', OLD.id_membre_b, 1)
        ON DUPLICATE KEY UPDATE version = version + 1;
    END IF;
END 
*/;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `calendriers`
--

DROP TABLE IF EXISTS `calendriers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `calendriers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_publique` varchar(36) NOT NULL,
  `id_membre` bigint unsigned NOT NULL,
  `type` enum('google','fichier','systeme','outlook') NOT NULL,
  `nom` varchar(100) DEFAULT NULL,
  `api_token` varchar(500) DEFAULT NULL,
  `refresh_token` varchar(500) DEFAULT NULL,
  `refresh_seconds_interval` int NOT NULL DEFAULT '3600',
  `statut` enum('actif','erreur','desactive') NOT NULL DEFAULT 'actif',
  `derniere_synchro` datetime DEFAULT NULL,
  `temps_creation` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_publique` (`id_publique`),
  KEY `id_membre` (`id_membre`),
  CONSTRAINT `calendriers_ibfk_1` FOREIGN KEY (`id_membre`) REFERENCES `membres` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `conversations`
--

DROP TABLE IF EXISTS `conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `conversations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_publique` varchar(20) NOT NULL,
  `titre` varchar(255) DEFAULT NULL,
  `couverture_id` bigint NOT NULL,
  `serial_number` bigint unsigned NOT NULL DEFAULT '0',
  `temps_creation` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_publique` (`id_publique`),
  UNIQUE KEY `couverture_id` (`couverture_id`),
  UNIQUE KEY `couverture_id_2` (`couverture_id`),
  CONSTRAINT `fk_conversations_medias` FOREIGN KEY (`couverture_id`) REFERENCES `medias` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `demandes_amis`
--

DROP TABLE IF EXISTS `demandes_amis`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `demandes_amis` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_publique` varchar(20) NOT NULL,
  `id_demandeur` bigint unsigned NOT NULL,
  `id_destinataire` bigint unsigned NOT NULL,
  `statut` enum('en_attente','acceptee','refusee','supprimee') NOT NULL DEFAULT 'en_attente',
  `temps_creation` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_publique` (`id_publique`),
  UNIQUE KEY `uq_demande_paire` (`id_demandeur`,`id_destinataire`),
  KEY `idx_demande_destinataire` (`id_destinataire`,`statut`),
  CONSTRAINT `fk_demande_demandeur` FOREIGN KEY (`id_demandeur`) REFERENCES `membres` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_demande_destinataire` FOREIGN KEY (`id_destinataire`) REFERENCES `membres` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_demandes_amis_ai` AFTER INSERT ON `demandes_amis` FOR EACH ROW BEGIN
    INSERT INTO versions_donnees (nom_table, id_membre, version)
    VALUES ('demandes_amis', NEW.id_destinataire, 1)
    ON DUPLICATE KEY UPDATE version = version + 1;
 
    INSERT INTO versions_donnees (nom_table, id_membre, version)
    VALUES ('demandes_amis', NEW.id_demandeur, 1)
    ON DUPLICATE KEY UPDATE version = version + 1;
END 
*/;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_demandes_amis_au` AFTER UPDATE ON `demandes_amis` FOR EACH ROW BEGIN
    IF NEW.statut <> OLD.statut THEN
        
        INSERT INTO versions_donnees (nom_table, id_membre, version)
			SELECT 'notifications', id_receveur, 1
			FROM notifications
			WHERE source = NEW.id_demandeur
			  AND id_metier = NEW.id_publique
		ON DUPLICATE KEY UPDATE version = version + 1;
 
        
        INSERT INTO versions_donnees (nom_table, id_membre, version)
        VALUES ('demandes_amis', NEW.id_destinataire, 1)
        ON DUPLICATE KEY UPDATE version = version + 1;
 
        INSERT INTO versions_donnees (nom_table, id_membre, version)
        VALUES ('demandes_amis', NEW.id_demandeur, 1)
        ON DUPLICATE KEY UPDATE version = version + 1;
    END IF;
END 
*/;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `disponibilites`
--

DROP TABLE IF EXISTS `disponibilites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `disponibilites` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_publique` varchar(20) NOT NULL,
  `id_membre` bigint unsigned NOT NULL,
  `debut` datetime NOT NULL,
  `fin` datetime NOT NULL,
  `regle_recurrence` varchar(500) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `temps_creation` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_publique` (`id_publique`),
  KEY `idx_dispo_membre_plage` (`id_membre`,`debut`,`fin`),
  CONSTRAINT `fk_dispo_membre` FOREIGN KEY (`id_membre`) REFERENCES `membres` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `disponibilites_exceptions`
--

DROP TABLE IF EXISTS `disponibilites_exceptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `disponibilites_exceptions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_publique` varchar(20) NOT NULL,
  `id_parent` bigint unsigned NOT NULL,
  `debut_occurence` datetime NOT NULL,
  `type` enum('modifie','annule') NOT NULL,
  `debut` datetime DEFAULT NULL,
  `fin` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_publique` (`id_publique`),
  KEY `fk_dispoex_parent` (`id_parent`),
  CONSTRAINT `fk_dispoex_parent` FOREIGN KEY (`id_parent`) REFERENCES `disponibilites` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `evenements`
--

DROP TABLE IF EXISTS `evenements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `evenements` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_publique` varchar(20) NOT NULL,
  `id_conversation` bigint unsigned DEFAULT NULL,
  `slug` varchar(255) NOT NULL,
  `titre` varchar(255) NOT NULL,
  `description` text,
  `debut` datetime NOT NULL,
  `fin` datetime NOT NULL,
  `prive` tinyint(1) NOT NULL DEFAULT '1',
  `regle_recurrence` varchar(500) DEFAULT NULL,
  `createur_id` bigint unsigned NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_publique` (`id_publique`),
  UNIQUE KEY `slug` (`slug`),
  KEY `fk_ev_conversation` (`id_conversation`),
  KEY `idx_ev_plage` (`debut`,`fin`),
  KEY `idx_ev_createur` (`createur_id`),
  CONSTRAINT `fk_ev_conversation` FOREIGN KEY (`id_conversation`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ev_createur` FOREIGN KEY (`createur_id`) REFERENCES `membres` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_evenements_au` AFTER UPDATE ON `evenements` FOR EACH ROW BEGIN
    
    INSERT INTO versions_donnees (nom_table, id_membre, version)
    SELECT 'evenements', id_membre, 1
    FROM participants_evenements
    WHERE id_evenement = NEW.id
    ON DUPLICATE KEY UPDATE version = version + 1;
END 
*/;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_evenements_ad` AFTER UPDATE ON `evenements` FOR EACH ROW BEGIN
	IF(OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN 
		DELETE FROM conversations WHERE id = OLD.id_conversation;
        DELETE FROM participants_evenements WHERE id_evenement = OLD.id;
	END IF;
END 
*/;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `evenements_exceptions`
--

DROP TABLE IF EXISTS `evenements_exceptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `evenements_exceptions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_publique` varchar(20) NOT NULL,
  `id_parent` bigint unsigned NOT NULL,
  `debut_occurence` datetime NOT NULL,
  `type` enum('modifie','annule') NOT NULL,
  `debut` datetime DEFAULT NULL,
  `fin` datetime DEFAULT NULL,
  `description` text,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_publique` (`id_publique`),
  KEY `fk_ex_parent` (`id_parent`),
  CONSTRAINT `fk_ex_parent` FOREIGN KEY (`id_parent`) REFERENCES `evenements` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_evenements_exceptions_ai` AFTER INSERT ON `evenements_exceptions` FOR EACH ROW BEGIN
    
    INSERT INTO versions_donnees (nom_table, id_membre, version)
		SELECT 'evenements', id_membre, 1
		FROM participants_evenements
    WHERE id_evenement = NEW.id_parent
    ON DUPLICATE KEY UPDATE version = version + 1;
END 
*/;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_evenements_exceptions_au` AFTER UPDATE ON `evenements_exceptions` FOR EACH ROW BEGIN
    INSERT INTO versions_donnees (nom_table, id_membre, version)
		SELECT 'evenements', id_membre, 1
		FROM participants_evenements
		WHERE id_evenement = NEW.id_parent
    ON DUPLICATE KEY UPDATE version = version + 1;
END 
*/;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `evenements_externes`
--

DROP TABLE IF EXISTS `evenements_externes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `evenements_externes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_publique` varchar(36) NOT NULL,
  `id_calendrier` int NOT NULL,
  `source_id` varchar(255) DEFAULT NULL,
  `titre` varchar(100) NOT NULL,
  `debut` datetime NOT NULL,
  `fin` datetime NOT NULL,
  `description` varchar(1000) DEFAULT NULL,
  `derniere_synchro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `temps_creation` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_publique` (`id_publique`),
  UNIQUE KEY `uq_source_evenement` (`id_calendrier`,`source_id`),
  CONSTRAINT `evenements_externes_ibfk_1` FOREIGN KEY (`id_calendrier`) REFERENCES `calendriers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invitations_evenement`
--

DROP TABLE IF EXISTS `invitations_evenement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `invitations_evenement` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_publique` varchar(20) NOT NULL,
  `id_evenement` bigint unsigned NOT NULL,
  `id_invitant` bigint unsigned NOT NULL,
  `id_invite` bigint unsigned NOT NULL,
  `statut` enum('en_attente','acceptee','refusee') NOT NULL DEFAULT 'en_attente',
  `expiration` datetime NOT NULL,
  `temps_creation` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_publique` (`id_publique`),
  KEY `fk_inv_ev` (`id_evenement`),
  KEY `fk_inv_invitant` (`id_invitant`),
  KEY `idx_inv_invite` (`id_invite`,`statut`),
  CONSTRAINT `fk_inv_ev` FOREIGN KEY (`id_evenement`) REFERENCES `evenements` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv_invitant` FOREIGN KEY (`id_invitant`) REFERENCES `membres` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv_invite` FOREIGN KEY (`id_invite`) REFERENCES `membres` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_invitations_evenement_au` AFTER UPDATE ON `invitations_evenement` FOR EACH ROW BEGIN
    IF NEW.statut <> OLD.statut THEN
        INSERT INTO versions_donnees (nom_table, id_membre, version)
        SELECT 'notifications', id_receveur, 1
        FROM notifications
        WHERE source = NEW.id_invitant
          AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.id_metier')) = NEW.id_publique
        ON DUPLICATE KEY UPDATE version = version + 1;
    END IF;
END 
*/;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `medias`
--

DROP TABLE IF EXISTS `medias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `medias` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `type` enum('image','video','audio') DEFAULT NULL,
  `duree_secondes` int DEFAULT NULL,
  `taille_octets` int NOT NULL,
  `url` varchar(256) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `membres`
--

DROP TABLE IF EXISTS `membres`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `membres` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_publique` varchar(20) NOT NULL,
  `pseudo` varchar(50) NOT NULL,
  `mot_de_passe` varchar(255) NOT NULL,
  `courriel` varchar(255) NOT NULL,
  `email_confirme` tinyint(1) NOT NULL DEFAULT '0',
  `nom` varchar(100) DEFAULT NULL,
  `prenom` varchar(100) DEFAULT NULL,
  `bio` varchar(500) DEFAULT NULL,
  `fuseau_horaire` varchar(64) NOT NULL DEFAULT 'UTC',
  `role` enum('membre','admin') NOT NULL DEFAULT 'membre',
  `id_fp` bigint DEFAULT NULL,
  `push_token` varchar(255) DEFAULT NULL,
  `stockage_utilise` bigint NOT NULL DEFAULT '0',
  `temps_creation` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `statut_disponibilite` enum('disponible','indisponible') NOT NULL DEFAULT 'disponible',
  `indisponible_jusqua` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_publique` (`id_publique`),
  UNIQUE KEY `pseudo` (`pseudo`),
  UNIQUE KEY `courriel` (`courriel`),
  KEY `fk_membres_image` (`id_fp`),
  CONSTRAINT `fk_membres_medias` FOREIGN KEY (`id_fp`) REFERENCES `medias` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `membres_organisations`
--

DROP TABLE IF EXISTS `membres_organisations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `membres_organisations` (
  `id_organisation` bigint unsigned NOT NULL,
  `id_membre` bigint unsigned NOT NULL,
  `role` enum('employeur','employe') NOT NULL,
  PRIMARY KEY (`id_organisation`,`id_membre`),
  KEY `fk_mo_membre` (`id_membre`),
  CONSTRAINT `fk_mo_membre` FOREIGN KEY (`id_membre`) REFERENCES `membres` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mo_org` FOREIGN KEY (`id_organisation`) REFERENCES `organisations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `id_media` bigint DEFAULT NULL,
  `id_publique` varchar(36) NOT NULL,
  `id_conversation` bigint unsigned NOT NULL,
  `id_auteur` bigint unsigned NOT NULL,
  `type` enum('texte','vocal','image','video','album') DEFAULT NULL,
  `temps_envoi` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_publique` (`id_publique`),
  KEY `id_conversation` (`id_conversation`),
  KEY `id_auteur` (`id_auteur`),
  KEY `id_media` (`id_media`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`id_conversation`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`id_auteur`) REFERENCES `membres` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_ibfk_3` FOREIGN KEY (`id_media`) REFERENCES `medias` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `messages_lus`
--

DROP TABLE IF EXISTS `messages_lus`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages_lus` (
  `id_message` bigint NOT NULL,
  `id_membre` bigint unsigned NOT NULL,
  `lu_a` datetime NOT NULL,
  PRIMARY KEY (`id_message`,`id_membre`),
  KEY `id_membre` (`id_membre`),
  CONSTRAINT `messages_lus_ibfk_1` FOREIGN KEY (`id_message`) REFERENCES `messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_lus_ibfk_2` FOREIGN KEY (`id_membre`) REFERENCES `membres` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `messages_texte`
--

DROP TABLE IF EXISTS `messages_texte`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages_texte` (
  `id_message` bigint NOT NULL,
  `contenu` varchar(2000) NOT NULL,
  PRIMARY KEY (`id_message`),
  CONSTRAINT `messages_texte_ibfk_1` FOREIGN KEY (`id_message`) REFERENCES `messages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_publique` varchar(20) NOT NULL,
  `id_receveur` bigint unsigned NOT NULL,
  `source` bigint unsigned DEFAULT NULL,
  `message` varchar(500) NOT NULL,
  `payload` json NOT NULL,
  `statut` enum('non_lue','lue') NOT NULL DEFAULT 'non_lue',
  `date_envoi` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `id_metier` varchar(10) GENERATED ALWAYS AS (json_unquote(json_extract(`payload`,_utf8mb4'$.id_metier'))) STORED,
  `statut_envoi` enum('en_attente','envoyee','echouee','abandonnee') DEFAULT 'en_attente',
  `nb_tentatives` int DEFAULT '0',
  `derniere_tentative_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_publique` (`id_publique`),
  KEY `idx_notif_receveur` (`id_receveur`,`deleted_at`,`statut`),
  KEY `idx_notifications_source_idmetier` (`source`,`id_metier`),
  CONSTRAINT `fk_notif_receveur` FOREIGN KEY (`id_receveur`) REFERENCES `membres` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notif_source` FOREIGN KEY (`source`) REFERENCES `membres` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_notifications_ai` AFTER INSERT ON `notifications` FOR EACH ROW BEGIN
	INSERT INTO versions_donnees (nom_table, id_membre, version)
	VALUES ('notifications', NEW.id_receveur, 1)
	ON DUPLICATE KEY UPDATE version = version + 1;
END 
*/;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_notifications_au` AFTER UPDATE ON `notifications` FOR EACH ROW BEGIN
    
    INSERT INTO versions_donnees (nom_table, id_membre, version)
    VALUES ('notifications', NEW.id_receveur, 1)
    ON DUPLICATE KEY UPDATE version = version + 1;
END 
*/;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `organisations`
--

DROP TABLE IF EXISTS `organisations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `organisations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_publique` varchar(20) NOT NULL,
  `nom` varchar(255) NOT NULL,
  `temps_creation` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_publique` (`id_publique`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `parametres`
--

DROP TABLE IF EXISTS `parametres`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `parametres` (
  `id_membre` bigint unsigned NOT NULL,
  `notifications_push` tinyint(1) NOT NULL DEFAULT '1',
  `notifications_email` tinyint(1) NOT NULL DEFAULT '0',
  `visibilite_horaire` enum('public','selection','prive','prive_amis_amis') NOT NULL DEFAULT 'public',
  `theme` enum('clair','sombre','auto') NOT NULL DEFAULT 'auto',
  `langue` varchar(5) NOT NULL DEFAULT 'fr-CA',
  `autres_prefs` json DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id_membre`),
  CONSTRAINT `parametres_ibfk_1` FOREIGN KEY (`id_membre`) REFERENCES `membres` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `participants_conversations`
--

DROP TABLE IF EXISTS `participants_conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `participants_conversations` (
  `id_conversation` bigint unsigned NOT NULL,
  `id_membre` bigint unsigned NOT NULL,
  `role` enum('editeur','lecteur') NOT NULL DEFAULT 'lecteur',
  `temps_creation` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_conversation`,`id_membre`),
  KEY `fk_partconv_membre` (`id_membre`),
  CONSTRAINT `fk_partconv_conv` FOREIGN KEY (`id_conversation`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_partconv_membre` FOREIGN KEY (`id_membre`) REFERENCES `membres` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `participants_evenements`
--

DROP TABLE IF EXISTS `participants_evenements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `participants_evenements` (
  `id_evenement` bigint unsigned NOT NULL,
  `id_membre` bigint unsigned NOT NULL,
  `privilege` enum('editeur','lecteur') NOT NULL DEFAULT 'lecteur',
  `statut` enum('en_attente','acceptee','refusee') NOT NULL DEFAULT 'en_attente',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_evenement`,`id_membre`),
  KEY `fk_partev_membre` (`id_membre`),
  CONSTRAINT `fk_partev_ev` FOREIGN KEY (`id_evenement`) REFERENCES `evenements` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_partev_membre` FOREIGN KEY (`id_membre`) REFERENCES `membres` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_participants_evenements_ai` AFTER INSERT ON `participants_evenements` FOR EACH ROW BEGIN
    
    INSERT INTO versions_donnees (nom_table, id_membre, version)
    SELECT 'evenements', id_membre, 1
    FROM participants_evenements
    WHERE id_evenement = NEW.id_evenement
    ON DUPLICATE KEY UPDATE version = version + 1;
END 
*/;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_participants_evenements_au` AFTER UPDATE ON `participants_evenements` FOR EACH ROW BEGIN
	
    INSERT INTO versions_donnees (nom_table, id_membre, version)
    SELECT 'evenements', id_membre, 1
    FROM participants_evenements
    WHERE id_evenement = NEW.id_evenement
    ON DUPLICATE KEY UPDATE version = version + 1;
END 
*/;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `regles_dnd`
--

DROP TABLE IF EXISTS `regles_dnd`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `regles_dnd` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `id_membre` bigint unsigned NOT NULL,
  `jour_semaine` int NOT NULL,
  `debut` datetime NOT NULL,
  `fin` datetime NOT NULL,
  `active` tinyint DEFAULT '1',
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_regles_dnd_membres` (`id_membre`),
  CONSTRAINT `fk_regles_dnd_membres` FOREIGN KEY (`id_membre`) REFERENCES `membres` (`id`),
  CONSTRAINT `ck_regles_dnd_jour_semaine` CHECK (((`jour_semaine` <= 6) and (`jour_semaine` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tokens_rafraichissement`
--

DROP TABLE IF EXISTS `tokens_rafraichissement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tokens_rafraichissement` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_membre` bigint unsigned NOT NULL,
  `token` varchar(512) NOT NULL,
  `blacklist` tinyint(1) NOT NULL DEFAULT '0',
  `temps_creation` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tokraf_membre` (`id_membre`),
  CONSTRAINT `fk_tokraf_membre` FOREIGN KEY (`id_membre`) REFERENCES `membres` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tokens_recuperation`
--

DROP TABLE IF EXISTS `tokens_recuperation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tokens_recuperation` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_membre` bigint unsigned NOT NULL,
  `token` varchar(255) NOT NULL,
  `expiration` datetime NOT NULL,
  `utilise` tinyint(1) NOT NULL DEFAULT '0',
  `temps_creation` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `fk_tokrec_membre` (`id_membre`),
  KEY `idx_tokrec_token` (`token`),
  CONSTRAINT `fk_tokrec_membre` FOREIGN KEY (`id_membre`) REFERENCES `membres` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `versions_donnees`
--

DROP TABLE IF EXISTS `versions_donnees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `versions_donnees` (
  `nom_table` varchar(50) NOT NULL,
  `id_membre` bigint unsigned NOT NULL,
  `version` bigint NOT NULL DEFAULT '1',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`nom_table`,`id_membre`),
  KEY `fk_version_membre` (`id_membre`),
  CONSTRAINT `fk_version_membre` FOREIGN KEY (`id_membre`) REFERENCES `membres` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `widgets_instances`
--

DROP TABLE IF EXISTS `widgets_instances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `widgets_instances` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_type` bigint unsigned NOT NULL,
  `id_proprietaire` bigint unsigned NOT NULL,
  `config` json DEFAULT NULL,
  `ordre` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `fk_wi_type` (`id_type`),
  KEY `fk_wi_proprietaire` (`id_proprietaire`),
  CONSTRAINT `fk_wi_proprietaire` FOREIGN KEY (`id_proprietaire`) REFERENCES `membres` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wi_type` FOREIGN KEY (`id_type`) REFERENCES `widgets_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `widgets_types`
--

DROP TABLE IF EXISTS `widgets_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `widgets_types` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `type` varchar(100) NOT NULL,
  `admin` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'syncdb_dev'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-09-12 14:05:36
