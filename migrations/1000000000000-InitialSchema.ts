import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1000000000000 implements MigrationInterface {
  name = 'InitialSchema1000000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enum Types ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE client_app_status         AS ENUM ('ACTIVE','INACTIVE','BLOCKED');
      CREATE TYPE api_key_status            AS ENUM ('ACTIVE','REVOKED','EXPIRED');
      CREATE TYPE api_key_type              AS ENUM ('SERVER','ADMIN','WORKER');
      CREATE TYPE auth_method_type          AS ENUM ('API_KEY','HMAC','JWT');
      CREATE TYPE client_permission_type    AS ENUM (
        'SEND_MESSAGE','READ_TEMPLATE','READ_TEMPLATE_VARIABLE',
        'READ_DELIVERY_STATUS','READ_LOG','USE_CHAT','ADMIN_ACCESS'
      );
      CREATE TYPE channel_type              AS ENUM ('EMAIL','SMS','KAKAO','CHAT');
      CREATE TYPE message_type              AS ENUM ('TEMPLATE','RAW');
      CREATE TYPE channel_group_type        AS ENUM ('SINGLE','MULTI');
      CREATE TYPE message_priority          AS ENUM ('LOW','NORMAL','HIGH','URGENT');
      CREATE TYPE recipient_type            AS ENUM ('TO','CC','BCC');
      CREATE TYPE recipient_status          AS ENUM ('READY','INVALID','BLOCKED');
      CREATE TYPE message_request_status    AS ENUM (
        'RECEIVED','VALIDATED','QUEUED','PROCESSING',
        'COMPLETED','PARTIAL_FAILED','FAILED','CANCELED'
      );
      CREATE TYPE message_dispatch_status   AS ENUM (
        'QUEUED','PROCESSING','SENT','DELIVERED',
        'SUCCESS','FAILED','RETRY_WAIT','CANCELED'
      );
      CREATE TYPE payload_encryption_status AS ENUM ('PLAIN','MASKED','ENCRYPTED');
      CREATE TYPE dispatch_log_type         AS ENUM (
        'REQUEST','RESPONSE','RETRY','SUCCESS','FAIL','CALLBACK','STATUS_CHANGE'
      );
      CREATE TYPE dispatch_log_status       AS ENUM ('PROCESSING','SUCCESS','FAILED');
      CREATE TYPE outbox_aggregate_type     AS ENUM (
        'MESSAGE_REQUEST','MESSAGE_DISPATCH','CHAT_MESSAGE'
      );
      CREATE TYPE outbox_event_type         AS ENUM (
        'MESSAGE_REQUEST_CREATED','MESSAGE_REQUEST_CANCELED',
        'MESSAGE_DISPATCH_QUEUED','MESSAGE_DISPATCH_RETRY_SCHEDULED',
        'MESSAGE_DISPATCH_COMPLETED','CHAT_MESSAGE_CREATED'
      );
      CREATE TYPE outbox_status             AS ENUM ('PENDING','PUBLISHED','FAILED');
      CREATE TYPE template_category         AS ENUM (
        'AUTH','BILLING','SYSTEM','MARKETING','SUPPORT','SECURITY','ETC'
      );
      CREATE TYPE content_format            AS ENUM ('TEXT','HTML','JSON');
      CREATE TYPE template_channel_status   AS ENUM ('DRAFT','ACTIVE','INACTIVE','DEPRECATED');
      CREATE TYPE template_variable_data_type AS ENUM (
        'STRING','NUMBER','BOOLEAN','DATE','DATETIME','OBJECT','ARRAY'
      );
      CREATE TYPE template_access_scope     AS ENUM ('PUBLIC','PRIVATE','RESTRICTED');
      CREATE TYPE provider_type             AS ENUM (
        'AWS_SES','SMS_VENDOR','KAKAO_VENDOR','INTERNAL_CHAT'
      );
      CREATE TYPE chat_room_type            AS ENUM ('DIRECT','GROUP','SUPPORT');
      CREATE TYPE chat_room_status          AS ENUM ('ACTIVE','INACTIVE','CLOSED');
      CREATE TYPE chat_participant_role     AS ENUM ('OWNER','ADMIN','MEMBER');
      CREATE TYPE chat_participant_status   AS ENUM ('JOINED','LEFT','BLOCKED');
      CREATE TYPE chat_message_type         AS ENUM ('TEXT','IMAGE','FILE','SYSTEM');
      CREATE TYPE chat_message_status       AS ENUM ('SENT','DELIVERED','READ','DELETED');
      CREATE TYPE admin_action_type         AS ENUM (
        'CREATE_TEMPLATE','UPDATE_TEMPLATE','ACTIVATE_TEMPLATE','DEACTIVATE_TEMPLATE',
        'CREATE_CLIENT_APP','UPDATE_CLIENT_APP','BLOCK_CLIENT_APP',
        'CREATE_API_KEY','REVOKE_API_KEY',
        'GRANT_TEMPLATE_ACCESS','REVOKE_TEMPLATE_ACCESS',
        'RETRY_DISPATCH','CANCEL_DISPATCH'
      );
      CREATE TYPE admin_target_type         AS ENUM (
        'TEMPLATE','TEMPLATE_CHANNEL','MESSAGE_REQUEST','MESSAGE_DISPATCH',
        'CLIENT_APP','API_KEY','CLIENT_TEMPLATE_ACCESS','CLIENT_CHANNEL_POLICY'
      );
    `);

    // ── Client Auth Tables ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE tb_client_app (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        app_code              VARCHAR(100) NOT NULL UNIQUE,
        app_name              VARCHAR(150) NOT NULL,
        description           TEXT,
        owner_name            VARCHAR(100),
        owner_email           VARCHAR(255),
        status                client_app_status NOT NULL DEFAULT 'ACTIVE',
        auth_method           auth_method_type NOT NULL DEFAULT 'API_KEY',
        is_ip_whitelist_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE tb_client_api_key (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_app_id UUID NOT NULL,
        key_id        VARCHAR(120) NOT NULL UNIQUE,
        key_name      VARCHAR(120) NOT NULL,
        key_type      api_key_type NOT NULL DEFAULT 'SERVER',
        secret_hash   TEXT NOT NULL,
        secret_hint   VARCHAR(20),
        status        api_key_status NOT NULL DEFAULT 'ACTIVE',
        issued_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        expired_at    TIMESTAMPTZ,
        last_used_at  TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_tb_client_api_key_client_app_id ON tb_client_api_key(client_app_id);
    `);

    await queryRunner.query(`
      CREATE TABLE tb_client_ip_whitelist (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_app_id UUID NOT NULL,
        ip_address    CIDR NOT NULL,
        description   TEXT,
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_tb_client_ip_whitelist_client_app_id_ip_address UNIQUE (client_app_id, ip_address)
      );
      CREATE INDEX idx_tb_client_ip_whitelist_client_app_id ON tb_client_ip_whitelist(client_app_id);
    `);

    await queryRunner.query(`
      CREATE TABLE tb_client_permission (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_app_id   UUID NOT NULL,
        permission_type client_permission_type NOT NULL,
        is_allowed      BOOLEAN NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_tb_client_permission_client_app_id_permission_type UNIQUE (client_app_id, permission_type)
      );
      CREATE INDEX idx_tb_client_permission_client_app_id ON tb_client_permission(client_app_id);
    `);

    await queryRunner.query(`
      CREATE TABLE tb_client_channel_policy (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_app_id UUID NOT NULL,
        channel_type  channel_type NOT NULL,
        is_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
        daily_limit   INTEGER,
        monthly_limit INTEGER,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_tb_client_channel_policy_client_app_id_channel_type UNIQUE (client_app_id, channel_type)
      );
      CREATE INDEX idx_tb_client_channel_policy_client_app_id ON tb_client_channel_policy(client_app_id);
    `);

    // ── Template Tables ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE tb_message_template (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_code VARCHAR(120) NOT NULL UNIQUE,
        template_name VARCHAR(150) NOT NULL,
        category      template_category NOT NULL DEFAULT 'ETC',
        description   TEXT,
        access_scope  template_access_scope NOT NULL DEFAULT 'PUBLIC',
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        created_by    UUID,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_tb_message_template_category ON tb_message_template(category);
    `);

    await queryRunner.query(`
      CREATE TABLE tb_message_template_channel (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id             UUID NOT NULL,
        channel_type            channel_type NOT NULL,
        provider_type           provider_type NOT NULL,
        provider_template_code  VARCHAR(150),
        subject                 VARCHAR(200),
        content                 TEXT NOT NULL,
        content_format          content_format NOT NULL DEFAULT 'TEXT',
        version                 INTEGER NOT NULL DEFAULT 1,
        status                  template_channel_status NOT NULL DEFAULT 'DRAFT',
        is_default              BOOLEAN NOT NULL DEFAULT FALSE,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_tb_message_template_channel_template_id_channel_type_version
          UNIQUE (template_id, channel_type, version)
      );
      CREATE INDEX idx_tb_message_template_channel_template_id ON tb_message_template_channel(template_id);
      CREATE INDEX idx_tb_message_template_channel_channel_type ON tb_message_template_channel(channel_type);
    `);

    await queryRunner.query(`
      CREATE TABLE tb_message_template_variable (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id   UUID NOT NULL,
        variable_key  VARCHAR(120) NOT NULL,
        variable_name VARCHAR(150) NOT NULL,
        data_type     template_variable_data_type NOT NULL DEFAULT 'STRING',
        is_required   BOOLEAN NOT NULL DEFAULT TRUE,
        description   TEXT,
        sample_value  TEXT,
        display_order INTEGER NOT NULL DEFAULT 1,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_tb_message_template_variable_template_id_variable_key
          UNIQUE (template_id, variable_key)
      );
      CREATE INDEX idx_tb_message_template_variable_template_id ON tb_message_template_variable(template_id);
    `);

    await queryRunner.query(`
      CREATE TABLE tb_client_template_access (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_app_id UUID NOT NULL,
        template_id   UUID NOT NULL,
        is_allowed    BOOLEAN NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_tb_client_template_access_client_app_id_template_id
          UNIQUE (client_app_id, template_id)
      );
      CREATE INDEX idx_tb_client_template_access_client_app_id ON tb_client_template_access(client_app_id);
      CREATE INDEX idx_tb_client_template_access_template_id ON tb_client_template_access(template_id);
    `);

    // ── Message Tables ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE tb_message_request (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id            VARCHAR(150) NOT NULL UNIQUE,
        client_app_id         UUID NOT NULL,
        template_id           UUID,
        template_code         VARCHAR(120),
        message_type          message_type NOT NULL DEFAULT 'TEMPLATE',
        channel_group_type    channel_group_type NOT NULL DEFAULT 'SINGLE',
        requested_by_user_id  UUID,
        requested_by_system   VARCHAR(120),
        priority              message_priority NOT NULL DEFAULT 'NORMAL',
        status                message_request_status NOT NULL DEFAULT 'RECEIVED',
        callback_url          TEXT,
        metadata              JSONB,
        requested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        validated_at          TIMESTAMPTZ,
        queued_at             TIMESTAMPTZ,
        completed_at          TIMESTAMPTZ,
        canceled_at           TIMESTAMPTZ,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_tb_message_request_client_app_id ON tb_message_request(client_app_id);
      CREATE INDEX idx_tb_message_request_status        ON tb_message_request(status);
      CREATE INDEX idx_tb_message_request_requested_at  ON tb_message_request(requested_at);
      CREATE INDEX idx_tb_message_request_template_code ON tb_message_request(template_code);
    `);

    await queryRunner.query(`
      CREATE TABLE tb_message_payload (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_request_id  UUID NOT NULL UNIQUE,
        payload_json        JSONB NOT NULL,
        masked_payload_json JSONB,
        encryption_status   payload_encryption_status NOT NULL DEFAULT 'PLAIN',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_tb_message_payload_message_request_id ON tb_message_payload(message_request_id);
    `);

    await queryRunner.query(`
      CREATE TABLE tb_message_recipient (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_request_id  UUID NOT NULL,
        recipient_type      recipient_type NOT NULL DEFAULT 'TO',
        user_id             UUID,
        receiver_name       VARCHAR(120),
        email               VARCHAR(255),
        phone_number        VARCHAR(30),
        kakao_phone_number  VARCHAR(30),
        status              recipient_status NOT NULL DEFAULT 'READY',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_tb_message_recipient_message_request_id ON tb_message_recipient(message_request_id);
      CREATE INDEX idx_tb_message_recipient_email               ON tb_message_recipient(email);
      CREATE INDEX idx_tb_message_recipient_phone_number        ON tb_message_recipient(phone_number);
    `);

    await queryRunner.query(`
      CREATE TABLE tb_message_dispatch (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_request_id  UUID NOT NULL,
        recipient_id        UUID NOT NULL,
        template_channel_id UUID,
        channel_type        channel_type NOT NULL,
        provider_type       provider_type NOT NULL,
        status              message_dispatch_status NOT NULL DEFAULT 'QUEUED',
        retry_count         INTEGER NOT NULL DEFAULT 0,
        max_retry_count     INTEGER NOT NULL DEFAULT 3,
        next_retry_at       TIMESTAMPTZ,
        last_error_code     VARCHAR(100),
        last_error_message  TEXT,
        provider_message_id VARCHAR(150),
        queued_at           TIMESTAMPTZ,
        processing_at       TIMESTAMPTZ,
        sent_at             TIMESTAMPTZ,
        delivered_at        TIMESTAMPTZ,
        success_at          TIMESTAMPTZ,
        failed_at           TIMESTAMPTZ,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_tb_message_dispatch_message_request_id ON tb_message_dispatch(message_request_id);
      CREATE INDEX idx_tb_message_dispatch_recipient_id        ON tb_message_dispatch(recipient_id);
      CREATE INDEX idx_tb_message_dispatch_status              ON tb_message_dispatch(status);
      CREATE INDEX idx_tb_message_dispatch_channel_type        ON tb_message_dispatch(channel_type);
      CREATE INDEX idx_tb_message_dispatch_next_retry_at       ON tb_message_dispatch(next_retry_at);
      CREATE INDEX idx_tb_message_dispatch_created_at          ON tb_message_dispatch(created_at);
    `);

    await queryRunner.query(`
      CREATE TABLE tb_message_dispatch_log (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dispatch_id      UUID NOT NULL,
        log_type         dispatch_log_type NOT NULL,
        status           dispatch_log_status NOT NULL,
        provider_code    VARCHAR(100),
        provider_message TEXT,
        raw_request      JSONB,
        raw_response     JSONB,
        logged_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_tb_message_dispatch_log_dispatch_id ON tb_message_dispatch_log(dispatch_id);
      CREATE INDEX idx_tb_message_dispatch_log_logged_at   ON tb_message_dispatch_log(logged_at);
    `);

    await queryRunner.query(`
      CREATE TABLE tb_message_outbox (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        aggregate_type outbox_aggregate_type NOT NULL,
        aggregate_id   UUID NOT NULL,
        event_type     outbox_event_type NOT NULL,
        event_key      VARCHAR(150) NOT NULL,
        payload        JSONB NOT NULL,
        status         outbox_status NOT NULL DEFAULT 'PENDING',
        published_at   TIMESTAMPTZ,
        error_message  TEXT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_tb_message_outbox_status_created_at ON tb_message_outbox(status, created_at);
    `);

    await queryRunner.query(`
      CREATE TABLE tb_message_dlq (
        id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_request_id UUID NOT NULL,
        dispatch_id        UUID NOT NULL,
        recipient_id       UUID NOT NULL,
        channel_type       channel_type NOT NULL,
        error_code         VARCHAR(100) NOT NULL,
        error_message      TEXT NOT NULL,
        retry_count        INTEGER NOT NULL,
        original_event     JSONB NOT NULL,
        failed_at          TIMESTAMPTZ NOT NULL,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_tb_message_dlq_channel_failed_at      ON tb_message_dlq(channel_type, failed_at);
      CREATE INDEX idx_tb_message_dlq_message_request_id     ON tb_message_dlq(message_request_id);
    `);

    // ── Admin Tables ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE tb_admin_audit_log (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_user_id UUID NOT NULL,
        action_type  admin_action_type NOT NULL,
        target_type  admin_target_type NOT NULL,
        target_id    UUID,
        before_data  JSONB,
        after_data   JSONB,
        ip_address   INET,
        user_agent   TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_tb_admin_audit_log_admin_user_id           ON tb_admin_audit_log(admin_user_id);
      CREATE INDEX idx_tb_admin_audit_log_target_type_target_id   ON tb_admin_audit_log(target_type, target_id);
    `);

    // ── Chat Tables ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE tb_chat_room (
        id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_code          VARCHAR(120) NOT NULL UNIQUE,
        room_name          VARCHAR(150),
        room_type          chat_room_type NOT NULL DEFAULT 'DIRECT',
        status             chat_room_status NOT NULL DEFAULT 'ACTIVE',
        created_by_user_id UUID NOT NULL,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_tb_chat_room_status ON tb_chat_room(status);
    `);

    await queryRunner.query(`
      CREATE TABLE tb_chat_room_participant (
        id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id   UUID NOT NULL,
        user_id   UUID NOT NULL,
        role      chat_participant_role NOT NULL DEFAULT 'MEMBER',
        status    chat_participant_status NOT NULL DEFAULT 'JOINED',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        left_at   TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_tb_chat_room_participant_room_id_user_id UNIQUE (room_id, user_id)
      );
      CREATE INDEX idx_tb_chat_room_participant_room_id ON tb_chat_room_participant(room_id);
      CREATE INDEX idx_tb_chat_room_participant_user_id ON tb_chat_room_participant(user_id);
    `);

    await queryRunner.query(`
      CREATE TABLE tb_chat_message (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id        UUID NOT NULL,
        sender_user_id UUID NOT NULL,
        message_type   chat_message_type NOT NULL DEFAULT 'TEXT',
        content        TEXT NOT NULL,
        metadata       JSONB,
        status         chat_message_status NOT NULL DEFAULT 'SENT',
        sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_tb_chat_message_room_id_sent_at ON tb_chat_message(room_id, sent_at);
    `);

    await queryRunner.query(`
      CREATE TABLE tb_chat_attachment (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id  UUID NOT NULL,
        file_url    TEXT NOT NULL,
        file_name   VARCHAR(255) NOT NULL,
        file_size   BIGINT NOT NULL,
        mime_type   VARCHAR(100) NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE tb_chat_message_read (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL,
        user_id    UUID NOT NULL,
        read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_tb_chat_message_read_message_id_user_id UNIQUE (message_id, user_id)
      );
      CREATE INDEX idx_tb_chat_message_read_message_id ON tb_chat_message_read(message_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS tb_chat_message_read;
      DROP TABLE IF EXISTS tb_chat_attachment;
      DROP TABLE IF EXISTS tb_chat_message;
      DROP TABLE IF EXISTS tb_chat_room_participant;
      DROP TABLE IF EXISTS tb_chat_room;
      DROP TABLE IF EXISTS tb_admin_audit_log;
      DROP TABLE IF EXISTS tb_message_dlq;
      DROP TABLE IF EXISTS tb_message_outbox;
      DROP TABLE IF EXISTS tb_message_dispatch_log;
      DROP TABLE IF EXISTS tb_message_dispatch;
      DROP TABLE IF EXISTS tb_message_recipient;
      DROP TABLE IF EXISTS tb_message_payload;
      DROP TABLE IF EXISTS tb_message_request;
      DROP TABLE IF EXISTS tb_client_template_access;
      DROP TABLE IF EXISTS tb_message_template_variable;
      DROP TABLE IF EXISTS tb_message_template_channel;
      DROP TABLE IF EXISTS tb_message_template;
      DROP TABLE IF EXISTS tb_client_channel_policy;
      DROP TABLE IF EXISTS tb_client_permission;
      DROP TABLE IF EXISTS tb_client_ip_whitelist;
      DROP TABLE IF EXISTS tb_client_api_key;
      DROP TABLE IF EXISTS tb_client_app;

      DROP TYPE IF EXISTS admin_target_type;
      DROP TYPE IF EXISTS admin_action_type;
      DROP TYPE IF EXISTS chat_message_status;
      DROP TYPE IF EXISTS chat_message_type;
      DROP TYPE IF EXISTS chat_participant_status;
      DROP TYPE IF EXISTS chat_participant_role;
      DROP TYPE IF EXISTS chat_room_status;
      DROP TYPE IF EXISTS chat_room_type;
      DROP TYPE IF EXISTS provider_type;
      DROP TYPE IF EXISTS template_access_scope;
      DROP TYPE IF EXISTS template_variable_data_type;
      DROP TYPE IF EXISTS template_channel_status;
      DROP TYPE IF EXISTS content_format;
      DROP TYPE IF EXISTS template_category;
      DROP TYPE IF EXISTS outbox_status;
      DROP TYPE IF EXISTS outbox_event_type;
      DROP TYPE IF EXISTS outbox_aggregate_type;
      DROP TYPE IF EXISTS dispatch_log_status;
      DROP TYPE IF EXISTS dispatch_log_type;
      DROP TYPE IF EXISTS payload_encryption_status;
      DROP TYPE IF EXISTS message_dispatch_status;
      DROP TYPE IF EXISTS message_request_status;
      DROP TYPE IF EXISTS recipient_status;
      DROP TYPE IF EXISTS recipient_type;
      DROP TYPE IF EXISTS message_priority;
      DROP TYPE IF EXISTS channel_group_type;
      DROP TYPE IF EXISTS message_type;
      DROP TYPE IF EXISTS channel_type;
      DROP TYPE IF EXISTS client_permission_type;
      DROP TYPE IF EXISTS auth_method_type;
      DROP TYPE IF EXISTS api_key_type;
      DROP TYPE IF EXISTS api_key_status;
      DROP TYPE IF EXISTS client_app_status;
    `);
  }
}
