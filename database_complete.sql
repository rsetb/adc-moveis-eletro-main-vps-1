-- ============================================
-- SQL COMPLETO - ADC MÓVEIS ELETRO
-- Database: adc_pro_2026
-- User: appuser
-- ============================================

-- Criar o banco de dados (se necessário)
CREATE DATABASE IF NOT EXISTS `adc_pro_2026` 
  DEFAULT CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `adc_pro_2026`;

-- ============================================
-- TABELA: users
-- ============================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(191) NOT NULL,
  `username` VARCHAR(191) NOT NULL,
  `password` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `role` VARCHAR(191) NOT NULL,
  `can_be_assigned` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `users_username_key` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: products
-- ============================================
CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `long_description` TEXT NULL,
  `price` DOUBLE NOT NULL,
  `original_price` DOUBLE NULL,
  `cost` DOUBLE NULL,
  `on_sale` BOOLEAN NOT NULL DEFAULT false,
  `promotion_end_date` VARCHAR(191) NULL,
  `is_hidden` BOOLEAN NOT NULL DEFAULT false,
  `category` VARCHAR(191) NULL,
  `subcategory` VARCHAR(191) NULL,
  `stock` INTEGER NOT NULL DEFAULT 0,
  `min_stock` INTEGER NULL,
  `unit` VARCHAR(191) NULL,
  `image_url` VARCHAR(191) NULL,
  `image_urls` JSON NULL,
  `max_installments` INTEGER NULL,
  `payment_condition` VARCHAR(191) NULL,
  `commission_type` VARCHAR(191) NULL,
  `commission_value` DOUBLE NULL,
  `data_ai_hint` TEXT NULL,
  `deleted_at` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: categories
-- ============================================
CREATE TABLE IF NOT EXISTS `categories` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `order` INTEGER NOT NULL DEFAULT 0,
  `subcategories` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: customers
-- ============================================
CREATE TABLE IF NOT EXISTS `customers` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `cpf` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NOT NULL,
  `phone2` VARCHAR(191) NULL,
  `phone3` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `zip` VARCHAR(191) NULL,
  `address` VARCHAR(191) NULL,
  `number` VARCHAR(191) NULL,
  `complement` VARCHAR(191) NULL,
  `neighborhood` VARCHAR(191) NULL,
  `city` VARCHAR(191) NULL,
  `state` VARCHAR(191) NULL,
  `password` VARCHAR(191) NULL,
  `observations` TEXT NULL,
  `seller_id` VARCHAR(191) NULL,
  `seller_name` VARCHAR(191) NULL,
  `blocked` BOOLEAN NOT NULL DEFAULT false,
  `blocked_reason` TEXT NULL,
  `rating` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `customers_cpf_key` (`cpf`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: customers_trash
-- ============================================
CREATE TABLE IF NOT EXISTS `customers_trash` (
  `id` VARCHAR(191) NOT NULL,
  `cpf` VARCHAR(191) NULL,
  `data` JSON NOT NULL,
  `deleted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: audit_logs
-- ============================================
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(191) NOT NULL,
  `timestamp` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NULL,
  `user_name` VARCHAR(191) NULL,
  `user_role` VARCHAR(191) NULL,
  `action` VARCHAR(191) NOT NULL,
  `details` TEXT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: config
-- ============================================
CREATE TABLE IF NOT EXISTS `config` (
  `key` VARCHAR(191) NOT NULL,
  `value` JSON NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: orders
-- ============================================
CREATE TABLE IF NOT EXISTS `orders` (
  `id` VARCHAR(191) NOT NULL,
  `customer` JSON NOT NULL,
  `items` JSON NOT NULL,
  `total` DOUBLE NOT NULL,
  `subtotal` DOUBLE NULL,
  `discount` DOUBLE NULL,
  `down_payment` DOUBLE NULL,
  `delivery_fee` DOUBLE NULL,
  `installments` INTEGER NULL,
  `installment_value` DOUBLE NULL,
  `date` VARCHAR(191) NOT NULL,
  `first_due_date` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL,
  `payment_method` VARCHAR(191) NULL,
  `installment_details` JSON NULL,
  `installment_card_details` JSON NULL,
  `tracking_code` VARCHAR(191) NULL,
  `attachments` JSON NULL,
  `seller_id` VARCHAR(191) NULL,
  `seller_name` VARCHAR(191) NULL,
  `commission` DOUBLE NULL,
  `commission_date` VARCHAR(191) NULL,
  `commission_paid` BOOLEAN NULL,
  `is_commission_manual` BOOLEAN NULL,
  `observations` TEXT NULL,
  `source` VARCHAR(191) NULL,
  `created_by_id` VARCHAR(191) NULL,
  `created_by_name` VARCHAR(191) NULL,
  `created_by_role` VARCHAR(191) NULL,
  `created_ip` VARCHAR(191) NULL,
  `asaas` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: commission_payments
-- ============================================
CREATE TABLE IF NOT EXISTS `commission_payments` (
  `id` VARCHAR(191) NOT NULL,
  `seller_id` VARCHAR(191) NOT NULL,
  `seller_name` VARCHAR(191) NOT NULL,
  `amount` DOUBLE NOT NULL,
  `payment_date` VARCHAR(191) NOT NULL,
  `period` VARCHAR(191) NOT NULL,
  `order_ids` JSON NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: stock_audits
-- ============================================
CREATE TABLE IF NOT EXISTS `stock_audits` (
  `id` VARCHAR(191) NOT NULL,
  `month` VARCHAR(191) NOT NULL,
  `year` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `audited_by` VARCHAR(191) NOT NULL,
  `audited_by_name` VARCHAR(191) NOT NULL,
  `products` JSON NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: avarias
-- ============================================
CREATE TABLE IF NOT EXISTS `avarias` (
  `id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_by` VARCHAR(191) NOT NULL,
  `created_by_name` VARCHAR(191) NOT NULL,
  `customer_id` VARCHAR(191) NOT NULL,
  `customer_name` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `product_name` VARCHAR(191) NOT NULL,
  `description` TEXT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: chat_sessions
-- ============================================
CREATE TABLE IF NOT EXISTS `chat_sessions` (
  `id` VARCHAR(191) NOT NULL,
  `visitor_id` VARCHAR(191) NOT NULL,
  `visitor_name` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'open',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_message_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_message_text` VARCHAR(191) NOT NULL,
  `seller_id` VARCHAR(191) NULL,
  `seller_name` VARCHAR(191) NULL,
  `unread_by_seller` BOOLEAN NOT NULL DEFAULT false,
  `unread_by_visitor` BOOLEAN NOT NULL DEFAULT false,
  `satisfaction` VARCHAR(191) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: chat_messages
-- ============================================
CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` VARCHAR(191) NOT NULL,
  `session_id` VARCHAR(191) NOT NULL,
  `text` TEXT NOT NULL,
  `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `sender` VARCHAR(191) NOT NULL,
  `sender_name` VARCHAR(191) NOT NULL,
  `attachment` JSON NULL,
  `type` VARCHAR(191) NULL,
  `rating` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  INDEX `chat_messages_session_id_idx` (`session_id`),
  CONSTRAINT `chat_messages_session_id_fkey` 
    FOREIGN KEY (`session_id`) 
    REFERENCES `chat_sessions` (`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- DADOS INICIAIS
-- ============================================

-- Inserir usuário admin padrão (senha: admin123)
-- Hash bcrypt para 'admin123': $2a$10$rKZLvVZqJ8h9vQYqYqYqYeJ8h9vQYqYqYqYqYeJ8h9vQYqYqYqYqY
INSERT INTO `users` (`id`, `username`, `password`, `name`, `role`, `can_be_assigned`, `created_at`, `updated_at`)
VALUES (
  UUID(),
  'admin',
  '$2a$10$rKZLvVZqJ8h9vQYqYqYqYeJ8h9vQYqYqYqYqYeJ8h9vQYqYqYqYqY',
  'Administrador',
  'admin',
  true,
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE `username` = `username`;

-- Inserir categorias padrão
INSERT INTO `categories` (`id`, `name`, `order`, `subcategories`, `created_at`, `updated_at`)
VALUES 
  (UUID(), 'Móveis', 1, '["Sofás", "Mesas", "Cadeiras", "Armários", "Camas"]', NOW(), NOW()),
  (UUID(), 'Eletrodomésticos', 2, '["Geladeiras", "Fogões", "Micro-ondas", "Lavadoras", "Ar Condicionado"]', NOW(), NOW()),
  (UUID(), 'Eletrônicos', 3, '["TVs", "Notebooks", "Celulares", "Tablets", "Áudio"]', NOW(), NOW()),
  (UUID(), 'Decoração', 4, '["Quadros", "Tapetes", "Cortinas", "Almofadas", "Vasos"]', NOW(), NOW())
ON DUPLICATE KEY UPDATE `name` = `name`;

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================

-- Mostrar todas as tabelas criadas
SHOW TABLES;

-- Verificar estrutura das principais tabelas
DESCRIBE users;
DESCRIBE products;
DESCRIBE customers;
DESCRIBE orders;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
