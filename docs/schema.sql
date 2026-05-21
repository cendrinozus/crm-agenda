-- CRM Agenda — MySQL schema
-- Run via: flask db upgrade (Flask-Migrate handles this automatically)
-- This file is for reference / direct import

CREATE DATABASE IF NOT EXISTS crm_agenda CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE crm_agenda;

CREATE TABLE IF NOT EXISTS users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    google_id       VARCHAR(128) UNIQUE NOT NULL,
    email           VARCHAR(256) UNIQUE NOT NULL,
    name            VARCHAR(256),
    picture         TEXT,
    access_token    TEXT,
    refresh_token   TEXT,
    token_expiry    DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_google_id (google_id),
    INDEX idx_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clients (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    name        VARCHAR(256) NOT NULL,
    company     VARCHAR(256),
    email       VARCHAR(256),
    phone       VARCHAR(64),
    notes       TEXT,
    aliases     JSON,
    color       VARCHAR(16) DEFAULT '#3B82F6',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    FULLTEXT INDEX ft_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS meetings (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT NOT NULL,
    client_id        INT,
    google_event_id  VARCHAR(256) UNIQUE,
    title            VARCHAR(512),
    start_time       DATETIME,
    end_time         DATETIME,
    location         VARCHAR(512),
    description      TEXT,
    attendees        JSON,
    status           VARCHAR(32) DEFAULT 'confirmed',
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
    INDEX idx_user_client (user_id, client_id),
    INDEX idx_start_time (start_time)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS meeting_notes (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id      INT NOT NULL,
    note_text       TEXT,
    next_actions    TEXT,
    voice_file      VARCHAR(512),
    transcript      TEXT,
    ai_summary      TEXT,
    ai_next_agenda  TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    INDEX idx_meeting_id (meeting_id)
) ENGINE=InnoDB;
